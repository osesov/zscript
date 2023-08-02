import { ZsDebugExchange } from './ZsDebugExchange';
import { ZsDebugExchangeTcp } from './exchange/zsDebugExchangeTcp';
import { ZsDebugExchangeSim } from './exchange/zsDebugExchangeSim';
import { TypedEmitter } from 'tiny-typed-emitter';
import * as child_process from 'child_process'
import treeKill = require('tree-kill');
import { addNewLine, CommandBody, CommandHelp, CommandInfo, mergeCommands } from './util';

export interface ZsDebugVariable {
    name: string
    obj: boolean
    func: boolean
    value: string | number
}

export interface ZsDebugStackFrame {
    name: string
    remoteFile?: string
    line?: number
    isNative: boolean
    variables: ZsDebugVariable[]
}

export interface ZsDebugBreakpoint {
    line: number;
    logMessage?: string;
}

export interface Breakpoint extends ZsDebugBreakpoint {
    id: number;
}

export interface HitBreakpoint {
    id: number;
    file: string;
    line: number
}

export interface SourceLocation {
    file: string;
    line: number
}

interface Notify {
    resolve(frame: string): void
    reject(reason: any): void
}

export interface ZsDebugConfig {
    showDevDebugOutput?: boolean
    connectionType?: 'sim' | 'tcp' | string
    host?: string
    port?: number

    showApplicationOutput ?: boolean
    showApplicationLogs ?: boolean
    stopAtEntry?: boolean
    pathSubstitutions?: { [k: string]: string }

    program ?: string
    arguments ?: string[]
    cwd ?: string
    env ?: { [k: string]: string }
}

export namespace logger
{
    export interface Core
    {
        important(msg: string): void
        debug(msg: string): void
        info(msg: string): void
        error(msg: string): void
    }

    export interface ChildProcess
    {
        stdout(msg: string): void
        stderr(msg: string): void
    }


    export interface Comm
    {
        debug(msg: string): void
    }
}
export interface Logger {
    core: logger.Core
    child_process: logger.ChildProcess
    comm: logger.Comm
}

// see https://stackoverflow.com/a/61609010

interface ZsDebugRuntimeEvents {
    'start': () => void
    'connected': () => void
    'pause': () => void
    'resume': () => void
    'startpoint': () => void

    // 'log': (data: string) => void
    'step': (data: SourceLocation) => void // VM stopped
    'exception': (data: SourceLocation) => void
    'breakpoint': (data: HitBreakpoint) => void
    'breakpointMessage': (data: string) => void
    'processExit': (code: number | null) => void
}

export declare interface ZsDebugger {
    on<T extends keyof ZsDebugRuntimeEvents>(event: T, listener: ZsDebugRuntimeEvents[T]): this;
    off<T extends keyof ZsDebugRuntimeEvents>(event: T, listener: ZsDebugRuntimeEvents[T]): this;
}

export class ZsDebugger extends TypedEmitter<ZsDebugRuntimeEvents>

{
    private logger: Logger;
    private breakpointId = 0;
    private protocol: ZsDebugExchange
    private breakpoints: { [k: string]: Breakpoint[] } = {}
    private nextFrame: Notify | null = null;

    private started = false;
    private paused = false;
    private stack: ZsDebugStackFrame[] | null = null;
    private config: ZsDebugConfig

    private pathMap: { [k: string]: string }
    private process: child_process.ChildProcess | null = null

    constructor(logger: Logger, config: ZsDebugConfig) {
        super()

        this.logger = logger;
        this.config = config
        this.pathMap = config.pathSubstitutions ?? {}

        switch (config.connectionType ?? "tcp") {
            case 'sim':
                this.logger.core.info("Use sim connection");
                this.protocol = new ZsDebugExchangeSim();
                break;

            case 'tcp':
                this.logger.core.info(`Use TCP connection ${config.port}:${config.port}`)
                this.protocol = new ZsDebugExchangeTcp(this.logger, config.host, config.port);
                break;

            default:
                throw Error("Unknown connectionType:" + config.connectionType);
        }
        this.protocol.on('data', (frame) => this.onFrame(frame));
        this.protocol.on('error', (reason: any) => this.getFrameHandler()?.reject(reason))
        this.protocol.on('connect', () => this.emit('connected'))
    }

    asyncEmit<T extends keyof ZsDebugRuntimeEvents>(event: T, ...args: Parameters<ZsDebugRuntimeEvents[T]>): void {
        Promise.resolve().then(() => super.emit(event, ...args));
    }

    disconnect(): void {
        this.protocol.disconnect();
        if (this.process) {

            const process = this.process;
            const pid = process.pid;
            this.process = null;

            if (pid) {
                const timeout = (msec) => new Promise<boolean>((resolve) => setTimeout(() => resolve(false), msec));
                const processDone = new Promise<boolean>((resolve) => process.on('close', () => resolve(true)));
                treeKill(pid, 'SIGTERM');

                Promise.any([processDone, timeout(5000)])
                .then((completed) => {
                    if (!completed)
                        treeKill(pid, 'SIGKILL');

                    return Promise.any([processDone, timeout(5000)])
                })
                .then( (completed) => this.logger.core.error(`Unable to wait for process completion ${pid}`))
            }
        }
        this.started = false;
        this.runningState();
    }

    private getFrameHandler(): Notify | null {
        const currentHandler = this.nextFrame;
        this.nextFrame = null;
        return currentHandler;
    }

    async exchangeFrame(str: string | undefined): Promise<string> {
        if (this.nextFrame !== null) {
            throw new Error("Too many readers at a time!")
        }

        if (str)
            this.protocol.sendString(str)

        return new Promise((resolve, reject) => {
            this.nextFrame = { resolve, reject };
        })
    }

    private onFrame(frame: string): void {
        if (this.nextFrame) {
            this.getFrameHandler()?.resolve(frame);
            return
        }

        // no waiters, use default handler
        if (frame.length === 0)
            return

        switch (frame[0]) {
            case 'l': // start
                return this.handleStart(frame);
            case 'b': // breakpoint
                return this.handleBreakpoint(frame);
            case 'e': // exception
                return this.handleException(frame);
            case 'p': // print
                return this.handlePrint(frame);
        }
    }

    private parseLocation(str: string): [string, number] {
        const [lineStr, file] = str.split(' ');
        const line = Number(lineStr);
        return [file, line];
    }

    private splitString(str: string, char: string): [string, string] {
        const pos = str.indexOf(char);
        if (pos < 0)
            return [str.trim(), ""];

        return [str.substring(0, pos).trim(), str.substring(pos + 1).trim()]
    }

    private handleStart(frame: string): void {
        this.interactiveState();

        const lines = frame.split('\n');
        const module_name = lines[0].split(' ')[1];

        if (lines.length < 2)
            throw Error("Unknown debug protocol: " + frame);

        if (lines[1] != "ver 2")
            throw Error("Unknown debug protocol: " + frame);

        if (!module_name)
            this.logger.core.important('Module seems to be build without debug info.\nCheck environment variables: CUSTOM_GS_KEYS contains "-D" and APP_DEFINES contains "-DGsPluginDebug" during build');

        if (this.started)
            this.sendBreakpoints();

        this.asyncEmit('start');
    }

    private handleBreakpoint(frame: string): void {
        this.interactiveState();

        const lines = frame.split('\n');

        if (lines.length < 2)
            throw Error("Unknown debug protocol: " + frame);

        const [remoteFile, line] = this.parseLocation(lines[1]);
        const breakpoints = this.breakpoints[remoteFile];

        // identify breakpoint
        let found = false;
        if (breakpoints) {
            for (const it of breakpoints) {
                if (it.line === line) {
                    found = true;

                    if (it.logMessage) {
                        this.asyncEmit('breakpointMessage', it.logMessage);
                        this.continueRequest();
                        continue;
                    }
                    this.asyncEmit('breakpoint', {
                        file: remoteFile,
                        line: it.line,
                        id: it.id
                    });
                }
            }
        }

        if (!found) {
            // this must be step or something...
            this.asyncEmit('step', {
                file: remoteFile, line: line
            });
        }
    }

    private handleException(frame: string): void {
        this.interactiveState();
        const lines = frame.split('\n');

        if (lines.length < 2)
            throw Error("Unknown debug protocol: " + frame);

        const [file, line] = this.parseLocation(lines[1]);

        this.asyncEmit('exception', { file, line });
    }

    private handlePrint(frame: string): void {
        // const lines = frame.substring(1).trim();
        this.logger.comm.debug(frame);
    }

    private sendBreakpoints() {
        // build protocol string
        const allBreakpoints: { file: string, line: number }[] = []

        let buffer = "";

        for (const bp in this.breakpoints) {
            for (const it of this.breakpoints[bp]) {
                allBreakpoints.push({ file: bp, line: it.line });
            }
        }

        buffer += 'b' + String(allBreakpoints.length) + '\n';

        allBreakpoints.forEach(e => {
            buffer += String(e.line) + ' ' + e.file + '\n'
        });

        this.protocol.sendString(buffer);
    }

    async setBreakpoints(source: string, breakpoints: ZsDebugBreakpoint[]): Promise<Breakpoint[]> {
        source = this.mapPathToRemote(source);

        if (breakpoints.length === 0)
            delete this.breakpoints[source]
        else
            this.breakpoints[source] = breakpoints.map(it => ({
                ...it, id: ++this.breakpointId
            }));

        if (this.started)
            this.sendBreakpoints();
        return this.breakpoints[source];
    }

    parseVariableString(line: string, sep: string): ZsDebugVariable {
        let [n, v] = this.splitString(line, sep)
        const isObj = v.startsWith("obj ");
        if (isObj)
            v = this.splitString(v, ' ')[1];

        const isFunc = v.startsWith("func ");
        if (isFunc)
            v = this.splitString(v, ' ')[1];
        return {
            name: n,
            obj: isObj,
            func: isFunc,
            value: v
        }
    }

    async getGlobalVariables(): Promise<ZsDebugVariable[]> {
        this.requireInteractiveState();
        const frame = await this.exchangeFrame('G')
        const lines = frame.split('\n');

        const variables: ZsDebugVariable[] = []

        for (const line of lines) {
            if (line === "")
                continue;

            if (line === "Globals:")
                continue;

            variables.push(this.parseVariableString(line, '='));
        }
        return variables;
    }

    async getRootVariables(): Promise<ZsDebugVariable[]> {
        this.requireInteractiveState();
        const frame = await this.exchangeFrame('R')
        const lines = frame.split('\n');

        const variables: ZsDebugVariable[] = []

        for (const line of lines) {
            if (line === "")
                continue;

            if (line === "Globals:")
                continue;

            variables.push(this.parseVariableString(line, '='));
        }
        return variables;
    }

    async getObjectVariable(id: string): Promise<ZsDebugVariable[]> {
        this.requireInteractiveState();
        const frame = await this.exchangeFrame('O' + id + '\n')
        const lines = frame.split('\n');

        const variables: ZsDebugVariable[] = []

        for (const line of lines) {
            if (line === "")
                continue;
            variables.push(this.parseVariableString(line, ':'));
        }

        return variables;
    }

    async getFunctionName(id: string): Promise<ZsDebugVariable[]> {
        this.requireInteractiveState();
        const frame = await this.exchangeFrame('D' + id + '\n')
        const lines = frame.split('\n');

        const variables: ZsDebugVariable[] = []

        for (const line of lines) {
            if (line === "")
                continue;
            variables.push(this.parseVariableString(line, ':'));
        }

        return variables;
    }

    async getStackTrace(): Promise<ZsDebugStackFrame[]> {
        this.requireInteractiveState();
        if (this.stack !== null)
            return this.stack;

        const frame = await this.exchangeFrame('S');
        const lines = frame.split('\n');
        const stackFrames: ZsDebugStackFrame[] = []

        for (const line of lines) {
            if (line.length === 0)
                continue;

            if (line === 'Stack:')
                continue;

            if (line.startsWith('--')) {
                const source = line.substring(2);

                if (source === "native code") {
                    stackFrames.push({
                        name: "native code",
                        isNative: true,
                        variables: []
                    })

                    continue;
                }

                const s = this.splitString(source, ' ');
                const [file, lineno] = s[1].split(':');

                stackFrames.push({
                    name: s[0],
                    isNative: false,
                    remoteFile: this.mapPathToHost(file),
                    line: Number(lineno),
                    variables: []
                })
            }

            else if (stackFrames.length > 0) {
                const currentFrame = stackFrames[stackFrames.length - 1];
                currentFrame.variables.push(this.parseVariableString(line, "="));
            }
        }

        return this.stack = stackFrames;
    }

    terminateRequest(): void {
        // this.requireInteractiveState()
        this.runningState();
        this.protocol.sendString('!')
    }

    stepRequest(): void {
        this.requireInteractiveState()
        this.runningState();
        this.protocol.sendString('s')
    }

    stepInRequest(): void {
        this.requireInteractiveState()
        this.runningState();
        this.protocol.sendString('d')
    }

    stepOutRequest(): void {
        this.requireInteractiveState()
        this.runningState();
        this.protocol.sendString('u')
    }

    continueRequest(): void {
        this.requireInteractiveState()
        this.runningState();
        this.protocol.sendString('g');
    }

    public configurationDone(): void {
        this.started = true;
        // initial breakpoints might be delayed until this point
        this.sendBreakpoints();
        if (!this.config.stopAtEntry)
            this.continueRequest();

        else
            this.emit('startpoint');
    }

    private mapPathToHost(fileName: string): string {
        for (const it in Object.entries(this.pathMap)) {
            const [hostPath, remotePath] = it;

            if (fileName.startsWith(remotePath))
                fileName = hostPath + fileName.substring(remotePath.length);
        }

        return fileName
    }

    private mapPathToRemote(fileName: string): string {
        for (const it in Object.entries(this.pathMap)) {
            const [hostPath, remotePath] = it;

            if (fileName.startsWith(hostPath))
                fileName = remotePath + fileName.substring(hostPath.length);
        }

        return fileName
    }

    private requireInteractiveState(): void {
        if (!this.paused)
            throw new Error("expected interactive state");
    }

    private interactiveState(): void {
        this.paused = true;
        this.stack = null;
        this.emit('pause');
    }

    private runningState(): void {
        this.paused = false;
        this.stack = null;
        this.emit('resume');
    }

    public launchApp() {
        if (!this.config.program) {
            return
        }

        const defaultEnv = {
            CUSTOM_GS_KEYS: "-D",
            APP_DEFINES: "-DGsPluginDebug"
        }

        const program = String(this.config.program)
        const cwd = this.config.cwd ?? process.cwd()
        const args = Array.isArray(this.config.arguments) ? this.config.arguments : []
        const env = Object.assign(defaultEnv, process.env, typeof this.config.env === "object" ? this.config.env : {})

        const options: child_process.SpawnOptionsWithoutStdio = {
            cwd: cwd,
            env: env,
            shell: true,
        }

        const spawnedProcess = child_process.spawn(program, args, options);
        spawnedProcess.stdout.on('data', (data: any) => this.logger.child_process.stdout(String(data)));
        spawnedProcess.stderr.on('data', (data: any) => this.logger.child_process.stderr(String(data)));
        spawnedProcess.on('close', (code) => {
            this.logger.core.info(`Process exit with ${code}`)
            this.asyncEmit('processExit', code)
        })
        spawnedProcess.on('error', (err: Error) => this.logger.core.error(`Process error: ${err}`));
        (spawnedProcess.stdin as any).setEncoding('utf-8');

        this.logger.core.info(`Started process: ${program}, pid: ${spawnedProcess.pid}`);
        this.process = spawnedProcess;
    }

    public sendInput(str: string)
    {
        if (!this.process || !this.process.stdin)
            return

        this.process.stdin.cork()
        this.process.stdin.write(addNewLine(str), () => {});
        this.process.stdin.uncork()
    }

    public getCommands(): CommandInfo
    {
        const commands : CommandInfo = mergeCommands(this.protocol.getCommands(), {
            in: {
                [CommandBody]: (args) => this.sendInput(args),
                [CommandHelp]: "Send input to child process via stdin"
            }
        })
        return commands;
    }
};
