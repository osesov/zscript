import { ErrorDestination, Handles, InitializedEvent, LoggingDebugSession, OutputEvent, Scope, StoppedEvent, TerminatedEvent, Thread, ThreadEvent } from "@vscode/debugadapter"
import { DebugProtocol } from '@vscode/debugprotocol';
import { ZsDebugger, ZsDebugStackFrame, Breakpoint, ZsDebugVariable, Logger, ZsDebugConfig, SourceLocation, logger } from './ZsDebugger';
import { DebugConfiguration } from 'vscode';
import { CommandBody, CommandHelp, CommandInfo, addNewLine, executeCommand, getCommandsHelp, mergeCommands } from "./util";

import * as vscode from 'vscode'

export interface FileAccessor {
    isWindows: boolean;
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, contents: Uint8Array): Promise<void>;
}

interface ZSAttachRequest extends DebugProtocol.AttachRequestArguments {

}

interface ZSLaunchRequest extends DebugProtocol.LaunchRequestArguments {

}

interface ZsRuntimeStackFrame {
    frame: ZsDebugStackFrame
    localsScope: Scope
    globalsScope: Scope
    rootsScope: Scope
}

type GetVariablesRequest = (args: DebugProtocol.VariablesArguments) => Promise<DebugProtocol.Variable[]> | DebugProtocol.Variable[]

function filterMessage(obj: DebugProtocol.Request | DebugProtocol.Response): boolean {
    switch (obj.command) {
        case 'output':
            return false;
    }

    return true;
}

function filterEvent(obj: DebugProtocol.Event): boolean {
    switch (obj.event) {
        case 'output':
            return false;
    }

    return true;
}

enum LogLevel {
    ERR = 0,
    INF = 1,
    DBG = 2
}

class LoggerImpl implements Logger {
    public readonly core: logger.Core
    public readonly child_process: logger.ChildProcess
    public readonly comm: logger.Comm

    constructor(private config: ZsDebugConfig,
        private sendEvent: (event: DebugProtocol.Event) => void,
        private connected: () => boolean,
        private diagnosticCollection: vscode.DiagnosticCollection) {

        this.core = {
            important: (msg: string): void => {
                this.sendEvent(new OutputEvent(addNewLine(msg), 'important'))
            },

            error: (msg: string): void => {
                if (this.config.showDevDebugOutput)
                    this.sendEvent(new OutputEvent("### ERR: " + addNewLine(msg), 'important'))
            },

            info: (msg: string): void => {
                if (this.config.showDevDebugOutput)
                    this.sendEvent(new OutputEvent("### INF: " + addNewLine(msg), 'console'))
            },

            debug: (msg: string): void => {
                if (this.config.showDevDebugOutput)
                    this.sendEvent(new OutputEvent("### DBG: " + addNewLine(msg), 'console'))
            }
        }

        this.child_process = {
            stdout: (msg: string): void => {
                if (!this.connected())
                    this.problemMatcher(msg)
                if (!this.connected() || this.config.showApplicationOutput)
                    this.sendEvent(new OutputEvent(addNewLine(msg), 'stdout'));
            },

            stderr: (msg: string): void => {
                if (!this.connected())
                    this.problemMatcher(msg)
                if (!this.connected() || this.config.showApplicationOutput)
                    this.sendEvent(new OutputEvent(addNewLine(msg), 'stderr'));
            },
            logs: (msg: string): void => {
                if (this.connected() && this.config.showApplicationLogs)
                    this.sendEvent(new OutputEvent(addNewLine(msg), 'console'))
            }
        }

        this.comm = {
            debug: (msg: string): void => {
                if (this.config.showDevNetworkOutput)
                    this.sendEvent(new OutputEvent(addNewLine(msg), 'console'))
            }
        }
    }

    private static problemRe = /^(Error|Warning):\s+(.*)[(]([0-9]+):([0-9]+)[)]\s+(.+)$/
    private diagnostics = new Map<string, vscode.Diagnostic[]>

    public clear()
    {
        this.diagnostics.clear();
        this.diagnosticCollection.clear()
    }

    problemMatcher(str: string): void
    {
        let m: RegExpExecArray | null;
        const lines = str.split('\n').map(e => e.trim());

        for (const text of lines) {
            if ((m = LoggerImpl.problemRe.exec(text)) == null) {
                continue;
            }

            const severity = m[1]
            const fileName = m[2];
            const lineno = m[3]
            const column = m[4]
            const message = m[5];

            if (!this.diagnostics.has(fileName)) {
                this.diagnostics.set(fileName, []);
            }

            const fileDiag = this.diagnostics.get(fileName) ?? [];
            const start = new vscode.Position(Number(lineno) - 1, Number(column) - 1);
            const end = new vscode.Position(Number(lineno), 0);

            const range = new vscode.Range(start, end)

            fileDiag.push( new vscode.Diagnostic(
                range,
                message,
                severity === "Error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
            ))
            this.diagnosticCollection.set( vscode.Uri.file(fileName), fileDiag)
        }
    }
}

export class ZsDebugAdapter extends LoggingDebugSession {
    // hardcode thread id
    private readonly threadID = 1;
    private reportProgress = false;
    private useInvalidatedEvent = false;
    private supportsVariableType = false;
    private connected = false;
    private runtime: ZsDebugger;
    private variableHandles = new Handles<GetVariablesRequest>();
    private stack: ZsRuntimeStackFrame[] | null = null
    private globals: DebugProtocol.Variable[] | null = null
    private roots: DebugProtocol.Variable[] | null = null
    private config: ZsDebugConfig
    private logger: LoggerImpl
    private diagnosticCollection: vscode.DiagnosticCollection

    public constructor(fileAccessor: FileAccessor, config: DebugConfiguration, diagnosticCollection: vscode.DiagnosticCollection) {
        super("zs-debug.txt");

        // zero-based lines and columns
        this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);

        this.diagnosticCollection = diagnosticCollection
        this.config = config as ZsDebugConfig;
        this.logger = new LoggerImpl(this.config, this.sendEvent.bind(this), () => this.connected, diagnosticCollection)

        this.runtime = new ZsDebugger(this.logger, this.config);
        this.runtime.on('breakpoint', (data) => this.onBreakpoint(data));
        this.runtime.on('start', () => this.sendEvent(new InitializedEvent()));
        this.runtime.on('pause', () => this.onPauseExecution());
        this.runtime.on('step', (location) => this.onStep(location));
        this.runtime.on('startpoint', () => this.onStartpoint())
        this.runtime.on('processExit', (code) => {
            this.sendEvent(new OutputEvent(`process exited with exit_code: ${code}\n`))
            this.sendEvent(new TerminatedEvent())
            this.connected = false;
        })

        this.runtime.on('connected', () => this.connected = true)
        this.runtime.on('disconnected', () => this.connected = false)
    }

    onPauseExecution(): void {
        this.variableHandles.reset();
        this.stack = null;
        this.globals = null;
        this.roots = null;
    }

    getVariables(args: DebugProtocol.VariablesArguments, remoteVariables: ZsDebugVariable[]): DebugProtocol.Variable[] {
        const variables: DebugProtocol.Variable[] = []

        remoteVariables.forEach(elem => {
            let variableReference = 0
            if (elem.obj) {
                variableReference = this.variableHandles.create((args) => this.getObjectVariable(args, String(elem.value)))
            }

            if (elem.func) {
                variableReference = this.variableHandles.create((args) => this.getFunctionName(args, String(elem.value)))
            }

            variables.push({
                name: elem.name,
                value: String(elem.value),
                variablesReference: variableReference
            })
        })

        return variables;
    }

    async getObjectVariable(args: DebugProtocol.VariablesArguments, oid: string): Promise<DebugProtocol.Variable[]> {
        return this.runtime.getObjectVariable(oid)
            .then((members) => this.getVariables(args, members));
    }

    async getFunctionName(args: DebugProtocol.VariablesArguments, oid: string): Promise<DebugProtocol.Variable[]> {
        return this.runtime.getFunctionName(oid)
            .then((members) => this.getVariables(args, members));
    }

    getLocalVariables(args: DebugProtocol.VariablesArguments, frame: ZsDebugStackFrame): DebugProtocol.Variable[] {
        return this.getVariables(args, frame.variables)
    }

    async getGlobalVariables(args: DebugProtocol.VariablesArguments): Promise<DebugProtocol.Variable[]> {
        if (this.globals)
            return this.globals;

        return Promise.resolve()
            .then(() => this.runtime.getGlobalVariables())
            .then(vars => this.getVariables(args, vars))
            .then(vars => this.globals = vars)
    }

    async getRootVariables(args: DebugProtocol.VariablesArguments): Promise<DebugProtocol.Variable[]> {
        if (this.roots)
            return this.roots;

        return Promise.resolve()
            .then(() => this.runtime.getRootVariables())
            .then(vars => this.getVariables(args, vars))
            .then(vars => this.roots = vars)
    }

    async getStackTrace(): Promise<ZsRuntimeStackFrame[]> {
        if (this.stack != null)
            return this.stack;

        return this.runtime.getStackTrace()
            .then((stack) => {
                const stackEx: ZsRuntimeStackFrame[] = []

                stack.forEach(frame => {
                    const frameInfo: ZsRuntimeStackFrame = {
                        frame: frame,
                        localsScope: new Scope("Locals", this.variableHandles.create((args) => this.getLocalVariables(args, frame)), false),
                        globalsScope: new Scope("Globals", this.variableHandles.create((args) => this.getGlobalVariables(args)), true),
                        rootsScope: new Scope("Roots", this.variableHandles.create((args) => this.getRootVariables(args)), true),
                    };

                    stackEx.push(frameInfo);
                })

                this.stack = stackEx;

                return stackEx;
            })
    }

    protected dispatchRequest(request: DebugProtocol.Request): void {
        if (this.config.showDevDebugOutput && filterMessage(request)) {
            super.sendEvent(new OutputEvent(`zsDebug.REQ ${request?.command}, request: ${JSON.stringify(request)}\n`))
        }
        super.dispatchRequest(request)
    }

    public sendRequest(command: string, args: any, timeout: number, cb: (response: DebugProtocol.Response) => void): void {
        if (this.config.showDevDebugOutput) {
            super.sendEvent(new OutputEvent(`zsDebug.SND ${command}, request ${JSON.stringify(args)}\n`))
        }
        super.sendRequest(command, args, timeout, cb)
    }

    public sendResponse(response: DebugProtocol.Response): void {
        if (this.config.showDevDebugOutput && filterMessage(response)) {
            super.sendEvent(new OutputEvent(`zsDebug.RSP ${response.command}, response: ${JSON.stringify(response)}\n`))
        }
        super.sendResponse(response)
    }

    public sendEvent(event: DebugProtocol.Event): void {
        super.sendEvent(event)
        if (this.config.showDevDebugOutput && filterEvent(event)) {
            super.sendEvent(new OutputEvent(`zsDebug.EVT ${event.event}, event: ${JSON.stringify(event)}\n`))
        }
    }

    protected sendErrorResponse(response: DebugProtocol.Response, codeOrMessage: number | DebugProtocol.Message, format?: string | undefined, variables?: any, dest?: ErrorDestination | undefined): void {
        if (this.config.showDevDebugOutput) {
            super.sendEvent(new OutputEvent(`zsDebug.ERR ${response}, codeOrMessage: ${JSON.stringify(codeOrMessage)}, format: ${format}, variables: ${JSON.stringify(variables)}, dest: ${dest}`))
        }
        super.sendErrorResponse(response, codeOrMessage, format, variables, dest)
    }

    /**
     * The 'initialize' request is the first request called by the frontend
     * to interrogate the features the debug adapter provides.
     */
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments, request?: DebugProtocol.InitializeRequest): void {

        if (args.supportsProgressReporting) {
            this.reportProgress = true;
        }
        if (args.supportsInvalidatedEvent) {
            this.useInvalidatedEvent = true;
        }

        if (args.supportsVariableType) {
            this.supportsVariableType = true;
        }

        // build and return the capabilities of this debug adapter:
        response.body = response.body || {};

        // the adapter implements the configurationDone request.
        response.body.supportsConfigurationDoneRequest = true;

        // The debug adapter supports function breakpoints.
        response.body.supportsFunctionBreakpoints = false;

        // The debug adapter supports conditional breakpoints.
        response.body.supportsConditionalBreakpoints = false;

        // make VS Code use 'evaluate' when hovering over source
        response.body.supportsEvaluateForHovers = true;

        // make VS Code show a 'step back' button
        response.body.supportsStepBack = false;

        // make VS Code support data breakpoints
        response.body.supportsDataBreakpoints = false; // TODO

        // make VS Code support completion in REPL
        response.body.supportsCompletionsRequest = false; // TODO
        response.body.completionTriggerCharacters = [".", "["];

        // make VS Code send cancel request
        response.body.supportsCancelRequest = false;

        // make VS Code send the breakpointLocations request
        response.body.supportsBreakpointLocationsRequest = false;

        // make VS Code provide "Step in Target" functionality
        response.body.supportsStepInTargetsRequest = false;

        // the adapter defines two exceptions filters, one with support for conditions.
        response.body.supportsExceptionFilterOptions = true;
        response.body.exceptionBreakpointFilters = [
            {
                filter: 'namedException',
                label: "Named Exception",
                description: `Break on named exceptions. Enter the exception's name as the Condition.`,
                default: false,
                supportsCondition: true,
                conditionDescription: `Enter the exception's name`
            },
            {
                filter: 'otherExceptions',
                label: "Other Exceptions",
                description: 'This is a other exception',
                default: true,
                supportsCondition: false
            }
        ];

        // make VS Code send exceptionInfo request
        response.body.supportsExceptionInfoRequest = true;

        // make VS Code send setVariable request
        response.body.supportsSetVariable = false;

        // make VS Code send setExpression request
        response.body.supportsSetExpression = false;

        // make VS Code send disassemble request
        response.body.supportsDisassembleRequest = false;
        response.body.supportsSteppingGranularity = false;
        response.body.supportsInstructionBreakpoints = false;

        // make VS Code able to read and write variable memory
        response.body.supportsReadMemoryRequest = false;
        response.body.supportsWriteMemoryRequest = false;

        response.body.supportSuspendDebuggee = false;
        response.body.supportTerminateDebuggee = true;

        response.body.supportsDelayedStackTraceLoading = false;

        this.sendResponse(response);
    }

    /**
     * Called at the end of the configuration sequence.
     * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
     */
    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments, request?: DebugProtocol.ConfigurationDoneRequest): void {
        super.configurationDoneRequest(response, args);

        // notify the launchRequest that configuration has finished
        // this._configurationDone.notify();
        this.runtime.configurationDone();
    }

    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
        if (args.terminateDebuggee)
            this.runtime.terminateRequest();
        this.runtime.disconnect();
        this.sendResponse(response);
    }

    protected attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments, request?: DebugProtocol.Request) {
        this.runtime.launchRequest();
        this.sendResponse(response);
    }

    protected launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments, request?: DebugProtocol.Request): void {
        this.runtime.launchRequest();
        this.sendResponse(response);
    }

    protected terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request): void {
        this.runtime.terminateRequest();
        this.sendResponse(response);
    }

    protected restartRequest(response: DebugProtocol.RestartResponse, args: DebugProtocol.RestartArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, request?: DebugProtocol.Request): Promise<void> {
        if (args.source.path) {
            const verified = await this.runtime.setBreakpoints(args.source.path, args.breakpoints ?? []);
            response.body = {
                breakpoints: verified.map((it) => ({
                    verified: true,
                    id: it.id,
                    source: args.source,
                    line: it.line,
                    endLine: it.line
                }))
            };

        }
        this.sendResponse(response);
    }

    protected setFunctionBreakPointsRequest(response: DebugProtocol.SetFunctionBreakpointsResponse, args: DebugProtocol.SetFunctionBreakpointsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected setExceptionBreakPointsRequest(response: DebugProtocol.SetExceptionBreakpointsResponse, args: DebugProtocol.SetExceptionBreakpointsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments, request?: DebugProtocol.Request): void {
        this.runtime.continueRequest();
        this.sendResponse(response);
    }

    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.Request): void {
        this.runtime.stepRequest()
        this.sendResponse(response);
    }

    protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments, request?: DebugProtocol.Request): void {
        this.runtime.stepInRequest();
        this.sendResponse(response);
    }

    protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments, request?: DebugProtocol.Request): void {
        this.runtime.stepOutRequest();
        this.sendResponse(response);
    }

    protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected reverseContinueRequest(response: DebugProtocol.ReverseContinueResponse, args: DebugProtocol.ReverseContinueArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected restartFrameRequest(response: DebugProtocol.RestartFrameResponse, args: DebugProtocol.RestartFrameArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected gotoRequest(response: DebugProtocol.GotoResponse, args: DebugProtocol.GotoArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected sourceRequest(response: DebugProtocol.SourceResponse, args: DebugProtocol.SourceArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse, request?: DebugProtocol.ThreadsRequest): void {

        // runtime supports no threads so just return a default thread.
        response.body = {
            threads: [
                new Thread(this.threadID, "thread 1")
            ]
        };

        this.sendResponse(response);
    }

    protected terminateThreadsRequest(response: DebugProtocol.TerminateThreadsResponse, args: DebugProtocol.TerminateThreadsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments, request?: DebugProtocol.Request): void {
        this.getStackTrace()
            .then((stackTrace: ZsRuntimeStackFrame[]) => {
                response.body = {
                    stackFrames: stackTrace.map((it, index) => ({
                        id: index,
                        name: it.frame.name,
                        source: it.frame.isNative ? undefined : { path: it.frame.remoteFile },
                        line: it.frame.isNative ? 0 : it.frame.line ?? 0,
                        column: it.frame.isNative ? 0 : 1,
                        presentationHint: it.frame.isNative ? 'label' : 'normal'
                    })),
                    totalFrames: stackTrace.length
                }
                this.sendResponse(response);
            })
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments, request?: DebugProtocol.Request): void {
        this.getStackTrace()
            .then((stack) => {
                const frame = stack[args.frameId]

                if (frame.frame.isNative)
                    return

                response.body = {
                    scopes: [
                        frame.localsScope,
                        frame.globalsScope,
                        // frame.roots // TODO: something wrong with it, and does not seem to be informative
                    ]
                }
            })
            .then(() => this.sendResponse(response))
            ;
    }

    protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): void {
        const scope = this.variableHandles.get(args.variablesReference);
        const variables: DebugProtocol.Variable[] = []

        Promise.resolve()
            .then(() => scope(args))
            .then(vars => {
                response.body = { variables: vars }
            })
            .then(() => this.sendResponse(response))
    }

    protected setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected setExpressionRequest(response: DebugProtocol.SetExpressionResponse, args: DebugProtocol.SetExpressionArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments, request?: DebugProtocol.Request): void {
        if (args.context === 'repl') {
            const s = args.expression.trim();
            if (s[0] === '.') {
                if (!executeCommand(this.getCommands(), s.substring(1))) {
                    this.logger.core.error(`Unknown command: ${args.expression}`)
                }
            }
            else {
                this.runtime.sendInput(s);
            }
            this.sendResponse(response);
        }
        else if (args.context === 'hover' || args.context === 'watch') {
            this.runtime.evalVariableValue(args.expression)
                .then((value) => response.body = {
                    result: value?.value ?? "",
                    variablesReference: 0,
                    type: value?.type
                })
                .then(() => this.sendResponse(response));
        }
    }

    protected stepInTargetsRequest(response: DebugProtocol.StepInTargetsResponse, args: DebugProtocol.StepInTargetsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected gotoTargetsRequest(response: DebugProtocol.GotoTargetsResponse, args: DebugProtocol.GotoTargetsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected exceptionInfoRequest(response: DebugProtocol.ExceptionInfoResponse, args: DebugProtocol.ExceptionInfoArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected loadedSourcesRequest(response: DebugProtocol.LoadedSourcesResponse, args: DebugProtocol.LoadedSourcesArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected dataBreakpointInfoRequest(response: DebugProtocol.DataBreakpointInfoResponse, args: DebugProtocol.DataBreakpointInfoArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected setDataBreakpointsRequest(response: DebugProtocol.SetDataBreakpointsResponse, args: DebugProtocol.SetDataBreakpointsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected readMemoryRequest(response: DebugProtocol.ReadMemoryResponse, args: DebugProtocol.ReadMemoryArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected writeMemoryRequest(response: DebugProtocol.WriteMemoryResponse, args: DebugProtocol.WriteMemoryArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected disassembleRequest(response: DebugProtocol.DisassembleResponse, args: DebugProtocol.DisassembleArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected cancelRequest(response: DebugProtocol.CancelResponse, args: DebugProtocol.CancelArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected breakpointLocationsRequest(response: DebugProtocol.BreakpointLocationsResponse, args: DebugProtocol.BreakpointLocationsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected setInstructionBreakpointsRequest(response: DebugProtocol.SetInstructionBreakpointsResponse, args: DebugProtocol.SetInstructionBreakpointsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    /// zs debug events
    onBreakpoint(bp: Breakpoint): void {
        const event = new StoppedEvent('breakpoint', this.threadID);
        const body: DebugProtocol.StoppedEvent['body'] = event.body;

        body.allThreadsStopped = true;
        body.hitBreakpointIds = [bp.id];

        this.sendEvent(event);
    }

    onStep(bp: SourceLocation): void {
        const event = new StoppedEvent('step', this.threadID);
        const body: DebugProtocol.StoppedEvent['body'] = event.body;

        body.allThreadsStopped = true;

        this.sendEvent(event);
    }

    onStartpoint(): void {
        const event = new StoppedEvent('entry', this.threadID);
        const body: DebugProtocol.StoppedEvent['body'] = event.body;

        body.allThreadsStopped = true;

        this.sendEvent(event);
    }

    getCommands(): CommandInfo {
        let commands = mergeCommands(
            this.runtime.getCommands(),
            {
                help: {
                    [CommandBody]: () => this.sendEvent(new OutputEvent(getCommandsHelp(commands), 'console')),
                    [CommandHelp]: "Show list of commands"
                }
            }
        );
        return commands;
    }

}
