import { ClassInfo, ClassMethodInfo, ContextTag, GlobalFunction, InterfaceInfo, Position, UnitInfo } from './lang'
import * as fs from 'fs'
import * as path from 'path'

// parser
import './zscript.pegjs'
import * as parser from './zscript-parse'
import { Logger, logSystem } from './logger'
import * as vscode from 'vscode'
import { assertUnreachable } from './util'
import { toVscode } from './vscodeUtil'

export interface ZsEnvironment
{
    includeDirs: string[]
    stripPathPrefix: string[]
}

export class Queue
{
    private seen: Set<string> = new Set
    private queue: string[] = []

    public add(s: string|undefined): boolean
    public add(...s: (string|undefined)[]): boolean
    public add(s: (string|undefined)[]): boolean
    public add(s: (string|undefined)[]|(string|undefined)): boolean
    {
        let added = false
        if (!s)
            return false;

        if (typeof s === "string")
            s = [s]

        for(const it of s) {
            if (!it)
                continue
            if (this.seen.has(it))
                continue

            this.seen.add(it)
            this.queue.push(it)
            added = true
        }

        return added
    }

    public reset(): void
    {
        if (this.queue.length > 0)
            throw Error("queue is not empty!")
        this.seen.clear()
    }

    public get empty(): boolean
    {
        return this.queue.length === 0
    }

    public peek(): string
    {
        return this.queue[0]
    }

    public next(): string
    {
        const result = this.queue.shift()
        if (!result)
            throw Error("queue is empty");

        return result;
    }

    public *items()
    {
        while (!this.empty) {
            const it = this.queue.shift()
            if (!it)
                continue;

            yield it;
        }
    }

    public requeue(str: string[])
    {
        str.forEach( e => {
            if (!this.seen.has(e))
                throw Error("Unexpected requeue item: " + e);

            this.queue.push(e)
        })
    }
}

interface FileState
{
    state: 'opening' | 'update' | 'failed' | 'opened'
    unitInfo: UnitInfo | undefined
    ready: Promise<UnitInfo| undefined>
    resolve: (e: UnitInfo| undefined) => void
    // TODO: curently this causes delay when updateHappen and the file is requested.
    // Should be able to break through
    updateTime: number
}

export class ZsRepository
{
    private unitInfo: Map<string, FileState> = new Map
    private env: ZsEnvironment
    private logger: Logger
    private loadingQueue = new Queue
    private loading = false
    private updateDelay = 1000

    constructor(env: ZsEnvironment)
    {
        this.env = env
        this.logger = logSystem.getLogger(ZsRepository);
    }

    updateEnvironment(env: ZsEnvironment)
    {
        this.env = env
    }

    private findInclude(fileName: string): string | undefined
    {
        if (fs.existsSync(fileName))
            return path.resolve(fileName)

        for(const dir of this.env.includeDirs) {
            const p = path.resolve(dir, fileName)
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return undefined
    }

    public stripPathPrefix(path: string)
    {
        for (const it of this.env.stripPathPrefix) {
            if (path.startsWith(it))
                return path.substring(it.length)
        }

        return path
    }

    // todo: class/interface completions should take inheritance into account
    private getClassCompletions(prefix: string, classInfo: ClassInfo, token: vscode.CancellationToken): vscode.CompletionItem[]
    {
        const result: vscode.CompletionItem[] = []

        for (const e of classInfo.methods) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Method))
        }

        for (const e of classInfo.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Variable))
        }

        return result;
    }

    private getClassMethodCompletions(prefix: string, data: ClassMethodInfo, token: vscode.CancellationToken): vscode.CompletionItem[]
    {
        const result: vscode.CompletionItem[] = []

        for (const e of data.args) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Variable))
        }

        for (const e of data.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Variable))
        }

        return result;
    }

    private getFunctionCompletions(prefix: string, data: GlobalFunction, token: vscode.CancellationToken): vscode.CompletionItem[]
    {
        const result: vscode.CompletionItem[] = []

        for (const e of data.args) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Variable))
        }

        for (const e of data.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Variable))
        }

        return result;
    }


    private getUnitCompletions(prefix: string, position: Position, unit: UnitInfo, token: vscode.CancellationToken): vscode.CompletionItem[]
    {
        const result: vscode.CompletionItem[] = []

        // todo: apply token

        for (const e of Object.keys(unit.class)) {
            if (token.isCancellationRequested)
                break
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Class))
        }

        for (const e of Object.keys(unit.interface)) {
            if (token.isCancellationRequested)
                break
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Interface))
        }

        for (const e of Object.keys(unit.define)) {
            if (token.isCancellationRequested)
                break
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Constant))
        }

        for (const e of Object.keys(unit.types)) {
            if (token.isCancellationRequested)
                break
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Class))
        }

        for (const e of Object.keys(unit.globalFunctions)) {
            if (token.isCancellationRequested)
                break;
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Function))
        }

        for (const e of Object.keys(unit.globalVariables)) {
            if (token.isCancellationRequested)
                break;
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Variable))
        }

        const context = unit.getContext(position)
        for (const it of context) {
            switch (it.context) {
            // default:
            //     assertUnreachable(it.context);

            case ContextTag.CLASS:
                result.push( ... this.getClassCompletions(prefix, it, token));
                break;

            case ContextTag.METHOD:
                result.push( ... this.getClassMethodCompletions(prefix, it, token));
                break;

            case ContextTag.FUNCTION:
                result.push( ... this.getFunctionCompletions(prefix, it, token));
                break;

            case ContextTag.INTERFACE:
                break;
            }
        }

        return result;
    }

    public async getCompletions(fileName: string, prefix: string, position: Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[]>
    {
        const result: vscode.CompletionItem[] = []
        const includes = await this.getIncludeQueue(fileName)

        for (const unit of includes) {
            if (token.isCancellationRequested)
                break;

            if (!unit)
                continue;

            const partial = this.getUnitCompletions(prefix, position, unit, token);
            result.push(...partial)
        }

        return result;
    }

    private async updateFileInfoSafe(fileName: string, text: string, unit: FileState, token: vscode.CancellationToken): Promise<UnitInfo|undefined>
    {
        try {
            const result: UnitInfo = parser.parse(text, {
                grammarSource: fileName,
                fileName: fileName,
            })
            unit.state = 'opened'
            unit.unitInfo = result
            this.logger.info("Parsed {file}", this.stripPathPrefix(fileName))
            unit.resolve(result)

            for (const it of Object.keys(result.include)) {
                const n = this.findInclude(it);
                if (!n) {
                    this.logger.warn("Unable to find include {file}. Update 'zscript.includeDir'.", it)
                    continue
                }
                this.ensureFileLoaded(n, false);
            }
        }
        catch(e: unknown) {
            unit.state = 'failed'
            unit.resolve(undefined)

            this.logger.error("Error parsing {file}: {error}", this.stripPathPrefix(fileName), e)
            console.error(e)
        }

        return unit.ready

    }

    public async getInheritance(start: ClassInfo| InterfaceInfo, fileName: string): Promise<(ClassInfo|InterfaceInfo)[]>
    {
        const result: (ClassInfo|InterfaceInfo)[] = []
        const includes = await this.getIncludeQueue(fileName)
        const looking = new Set<string>
        const loaded = new Set<string>

        looking.add(start.name);

        while (looking.size > 0) {
            let somethingChanged = false

            for(const it of includes) {
                if (looking.size === 0)
                    break;
                for (const name of looking) {
                    const e = ((): (ClassInfo|InterfaceInfo|undefined) => it.interface[name] ?? it.class[name])()
                    if (!e)
                        break;
                    result.push(e);
                    looking.delete(name);
                    loaded.add(name);
                    somethingChanged = true

                    switch (e.context) {
                    case ContextTag.CLASS:
                        if (e.implements && !loaded.has(e.implements))
                            looking.add(e.implements)
                        break

                    case ContextTag.INTERFACE:
                        if (e.inherit && !loaded.has(e.inherit))
                            looking.add(e.inherit)
                        break
                    }
                }
            }

            if (!somethingChanged)
                break;
        }
        return result;
    }

    public async getIncludeQueue(fileName: string): Promise<UnitInfo[]>
    {
        const queue = new Queue
        const result: UnitInfo[] = []
        const fullName = this.findInclude(fileName)
        if (!fullName)
            return result;

        queue.add(fullName)

        while (!queue.empty) {
            const includeFile = queue.next()
            if (!includeFile)
                continue

            const fullIncludeName = this.findInclude(includeFile)
            if (!fullIncludeName)
                continue

            const unit = await this.ensureFileLoaded(fullIncludeName, false);
            if (unit) {
                result.push(unit)

                const newIncludes = Object.keys(unit.include).map( e=> this.findInclude(e))
                queue.add(newIncludes)
            }
        }

        return result;
    }

    private getDefineDefinitions(fileUri: vscode.Uri, word: string, unit: UnitInfo, token: vscode.CancellationToken): vscode.LocationLink[]
    {
        const result: vscode.LocationLink[] = []

        for (const [key, defines] of Object.entries(unit.define)) {
            if (token.isCancellationRequested)
                break
            if (key !== word)
                continue

            for (const define of defines) {
                result.push({
                    targetUri: fileUri,
                    targetRange: toVscode.range(define.begin, define.end)
                })
            }
        }
        return result;
    }

    private getGlobalsDefinitions(fileUri: vscode.Uri, word: string, unit: UnitInfo, token: vscode.CancellationToken): vscode.LocationLink[]
    {
        const result: vscode.LocationLink[] = []

        for (const it of Object.entries(unit.globalFunctions)) {
            if (token.isCancellationRequested)
                break
            if (it[0] !== word)
                continue
            result.push({
                targetUri: fileUri,
                targetRange: toVscode.range(it[1].begin, it[1].end)
            })
        }

        for (const it of Object.entries(unit.globalVariables)) {
            if (token.isCancellationRequested)
                break
            if (it[0] !== word)
                continue
            result.push({
                targetUri: fileUri,
                targetRange: toVscode.range(it[1].begin, it[1].end)
            })
        }
        return result;
    }

    private getTypeDefinitions(fileUri: vscode.Uri, word: string, unit: UnitInfo, token: vscode.CancellationToken): vscode.LocationLink[]
    {
        const result: vscode.LocationLink[] = []

        for (const e of Object.values(unit.class)) {

            if (token.isCancellationRequested)
                break;

            if (e.name !== word)
                continue

            result.push({
                targetUri: fileUri,
                targetRange: toVscode.range(e.begin, e.end)
            });
        }

        for (const e of Object.values(unit.interface)) {
            if (token.isCancellationRequested)
                break;

            if (e.name !== word)
                continue

            result.push({
                targetUri: fileUri,
                targetRange: toVscode.range(e.begin, e.end)
            });
        }

        for (const e of Object.values(unit.types)) {
            if (token.isCancellationRequested)
                break;

            if (e.name !== word)
                continue
            result.push({ targetUri: fileUri, targetRange: toVscode.range(e.begin, e.begin)})
        }

        return result;
    }

    private async getInheritDefinitions(fileUri: vscode.Uri, word: string, classInfo: ClassInfo|InterfaceInfo, token: vscode.CancellationToken): Promise<vscode.LocationLink[]>
    {
        const result: vscode.LocationLink[] = []
        const inherit = await this.getInheritance(classInfo, fileUri.fsPath)
        for (const e of inherit) {
            switch(e.context) {
            case ContextTag.CLASS:
                result.push(... this.getClassDefinitions(fileUri, word, e, token));
                break

            case ContextTag.INTERFACE:
                result.push(... this.getInterfaceDefinitions(fileUri, word, e, token));
                break;
            }
        }

        return result;
    }

    private getClassDefinitions(fileUri: vscode.Uri, word: string, classInfo: ClassInfo, token: vscode.CancellationToken): vscode.LocationLink[]
    {
        const result: vscode.LocationLink[] = []

        for (const e of classInfo.methods) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.push({
                    targetUri: fileUri,
                    targetRange: toVscode.range(e.begin, e.end)
                })
        }

        for (const e of classInfo.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.push({
                    targetUri: fileUri,
                    targetRange: toVscode.range(e.begin, e.end)
                })
        }

        return result;
    }

    private getInterfaceDefinitions(fileUri: vscode.Uri, word: string, interfaceInfo: InterfaceInfo, token: vscode.CancellationToken): vscode.LocationLink[]
    {
        const result: vscode.LocationLink[] = []

        for (const e of interfaceInfo.methods) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.push({
                    targetUri: fileUri,
                    targetRange: toVscode.range(e.begin, e.end)
                })
        }

        for (const e of interfaceInfo.readProp) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.push({
                    targetUri: fileUri,
                    targetRange: toVscode.range(e.begin, e.end)
                })
        }

        for (const e of interfaceInfo.writeProp) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.push({
                    targetUri: fileUri,
                    targetRange: toVscode.range(e.begin, e.end)
                })
        }

        return result;
    }

    private getClassMethodDefinitions(fileUri: vscode.Uri, word: string, methodInfo: ClassMethodInfo, token: vscode.CancellationToken): vscode.LocationLink[]
    {
        const result: vscode.LocationLink[] = []

        for (const e of methodInfo.args) {
            if (token.isCancellationRequested)
                break
            if (e.name !== word)
                continue
            result.push({
                targetUri: fileUri,
                targetRange: toVscode.range(e.begin, e.end)
            });
        }

        for (const e of methodInfo.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name !== word)
                continue
            result.push({
                targetUri: fileUri,
                targetRange: toVscode.range(e.begin, e.end)
            })
        }

        return result;
    }

    private getGlobalFunctionDefinitions(fileUri: vscode.Uri, word: string, methodInfo: GlobalFunction, token: vscode.CancellationToken): vscode.LocationLink[]
    {
        const result: vscode.LocationLink[] = []

        for (const e of methodInfo.args) {
            if (token.isCancellationRequested)
                break
            if (e.name !== word)
                continue
            result.push({
                targetUri: fileUri,
                targetRange: toVscode.range(e.begin, e.end)
            });
        }

        for (const e of methodInfo.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name !== word)
                continue
            result.push({
                targetUri: fileUri,
                targetRange: toVscode.range(e.begin, e.end)
            })
        }

        return result;
    }

    public async getDefinitions(fileName: string, word: string, position: Position, token: vscode.CancellationToken): Promise<vscode.LocationLink[]>
    {
        const includes = await this.getIncludeQueue(fileName)
        const result: vscode.LocationLink[] = []
        for (const unit of includes) {
            if (!unit)
                continue

            // TODO: this obtains 'type' definitions only
            const fileUri = vscode.Uri.file(unit.fileName)
            result.push(... this.getTypeDefinitions(fileUri, word, unit, token))
            result.push(... this.getDefineDefinitions(fileUri, word, unit, token))
            result.push(... this.getGlobalsDefinitions(fileUri, word, unit, token))

            const context = unit.getContext(position)
            for (const it of context) {
                switch (it.context) {
                // default:
                //     assertUnreachable(it.context);

                case ContextTag.CLASS:
                    result.push( ... await this.getClassDefinitions(fileUri, word, it, token));
                    result.push( ... await this.getInheritDefinitions(fileUri, word, it, token));
                    break;

                case ContextTag.METHOD:
                    result.push( ... await this.getClassMethodDefinitions(fileUri, word, it, token));
                    break;

                case ContextTag.FUNCTION:
                    result.push( ... await this.getGlobalFunctionDefinitions(fileUri, word, it, token));
                    break;

                case ContextTag.INTERFACE:
                    result.push( ... await this.getInheritDefinitions(fileUri, word, it, token));
                    break;
                }
            }

        }
        return result
    }

    public dispose(): void
    {
        this.unitInfo.clear()
    }

    private async getDocumentText(fileName: string): Promise<string>
    {
        for (const it of vscode.workspace.textDocuments) {
            if (it.uri.fsPath === fileName)
                return it.getText();
        }

        return fs.promises.readFile(fileName, 'utf-8')
    }

    private async loadFileSafe(fileName: string, unit: FileState)
    {
        const text = await this.getDocumentText(fileName);
        const token = new vscode.CancellationTokenSource
        await this.updateFileInfoSafe(fileName, text, unit, token.token);
    }

    private doLoading()
    {
        Promise.resolve().then( async () => {
            let updateTime : number | null = null
            const postpone: string[] = []

            for (const it of this.loadingQueue.items()) {
                const now = Date.now()
                const unit = this.unitInfo.get(it)
                switch(unit?.state) {
                case null:
                case 'opened':
                    continue

                case 'update':
                    if (unit.updateTime && unit.updateTime > now) {
                        if (updateTime === null || unit.updateTime < updateTime)
                            updateTime = unit.updateTime

                        postpone.push(it)
                        continue
                    }

                // eslint-disable-next-line no-fallthrough
                case 'failed':
                case 'opening':
                    await this.loadFileSafe(it, unit)
                    break;

                default:
                    // assertUnreachable(unit?.state)
                }
            }

            if (postpone.length > 0) {
                if (updateTime === null)
                    throw Error("Postpone parsing and no update time");
                this.loadingQueue.requeue(postpone)
                const now = Date.now()
                const scheduleIn = (updateTime < now) ? 0 : updateTime - now
                setTimeout(() => this.doLoading(), scheduleIn)
            }
            else {
                this.loading = false;
                this.loadingQueue.reset()
            }
        })
    }

    private startLoading()
    {
        if (this.loading)
            return

        this.loading = true;
        this.doLoading();
    }

    private ensureFileLoaded(fileName: string, update: boolean): Promise<UnitInfo|undefined>
    {
        let resolve!: (e: UnitInfo|undefined) => void, reject: (e: any) => void;

        const promise = new Promise<UnitInfo|undefined>((resolve_, reject_) => {
            resolve = resolve_
            reject = reject_;
        })

        const fullName = this.findInclude(fileName);
        if (!fullName) {
            this.logger.warn("File not found: {file}", fileName)
            return Promise.resolve(undefined)
        }

        let info = this.unitInfo.get(fullName)

        switch (info?.state) {
        case null:
        case undefined:
            this.unitInfo.set(fullName, {
                state: 'opening',
                unitInfo: undefined,
                ready: promise,
                resolve: resolve!,
                updateTime: 0
            })
            info = this.unitInfo.get(fullName)
            break;

        case 'opening':
        case 'update':
            return info.ready

        case 'failed':
        case 'opened':
            if (update) {
                info.state = 'update'
                info.updateTime = Date.now() + this.updateDelay
                info.ready = promise
                info.resolve = resolve;
            }
            else
                return info.ready
        }

        this.logger.debug('Enqueue {file} for {state}', this.stripPathPrefix(fullName), info?.state);
        this.loadingQueue.add(fileName)
        this.startLoading()
        return info!.ready
    }

    public onDocumentOpen(doc: vscode.TextDocument): Promise<UnitInfo|undefined>
    {
        return this.ensureFileLoaded(doc.fileName, false);
    }

    public onDocumentChange(doc: vscode.TextDocument): Promise<UnitInfo|undefined>
    {
        return this.ensureFileLoaded(doc.fileName, true)
    }

    public onDocumentAccess(doc: vscode.TextDocument): Promise<UnitInfo|undefined>
    {
        return this.ensureFileLoaded(doc.fileName, false)
    }
}

let repo: ZsRepository

export function createRepository(env: ZsEnvironment): ZsRepository
{
    if (repo)
        throw new Error("Repo already exists")

    repo = new ZsRepository(env)

    return repo;
}

export function getRepository(): ZsRepository
{
    if (!repo) {
        throw new Error("REpo does not exist yet")
    }

    return repo;
}
