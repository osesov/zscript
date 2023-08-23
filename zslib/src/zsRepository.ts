import { ClassInfo, ClassMethodInfo, ContextTag, Position, Span, UnitInfo } from './lang'
import * as fs from 'fs'
import * as path from 'path'

// parser
import './zscript.pegjs'
import * as parser from './zscript-parse'
import { Logger } from './logger'
import * as vscode from 'vscode'
import { assertUnreachable, vscodeRange } from './util'

export interface ZsEnvironment
{
    includeDirs: string[]
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
}

interface FileState
{
    state: 'opening' | 'update' | 'failed' | 'opened'
    unitInfo: UnitInfo | undefined
    ready: Promise<UnitInfo| undefined>
    resolve: (e: UnitInfo| undefined) => void
}

export class ZsRepository
{
    private unitInfo: Map<string, FileState> = new Map
    private env: ZsEnvironment
    private logger: Logger
    private loadingQueue = new Queue
    private loading = false

    constructor(env: ZsEnvironment, logger: Logger)
    {
        this.env = env
        this.logger = logger;
    }

    private findInclude(fileName: string): string | undefined
    {
        for(const dir of this.env.includeDirs) {
            const p = path.resolve(dir, fileName)
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return undefined
    }

    // todo: class/interface completions should take inheritance into account
    private getClassCompletions(prefix: string, classInfo: ClassInfo): vscode.CompletionItem[]
    {
        const result: vscode.CompletionItem[] = []

        classInfo.methods.forEach( e => {
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Method))
        })

        classInfo.variables.forEach( e => {
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Variable))
        })

        return result;
    }

    private getClassMethodCompletions(prefix: string, data: ClassMethodInfo): vscode.CompletionItem[]
    {
        const result: vscode.CompletionItem[] = []

        data.args.forEach( e => {
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Variable))
        })

        data.variables.forEach( e => {
            if (e.name.startsWith(prefix))
                result.push(new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Variable))
        })

        return result;
    }

    private getUnitCompletions(prefix: string, position: Position, unit: UnitInfo, token: vscode.CancellationToken): vscode.CompletionItem[]
    {
        const result: vscode.CompletionItem[] = []

        // todo: apply token

        Object.keys(unit.class).forEach(e => {
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Class))
        })

        Object.keys(unit.interface).forEach(e => {
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Interface))
        })

        Object.keys(unit.define).forEach(e => {
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Constant))
        })

        Object.keys(unit.types).forEach(e => {
            if (e.startsWith(prefix))
                result.push(new vscode.CompletionItem(e, vscode.CompletionItemKind.Class))
        })

        const context = unit.getContext(position)
        for (const it of context) {
            switch (it.context) {
            // default:
            //     assertUnreachable(it.context);

            case ContextTag.CLASS:
                result.push( ... this.getClassCompletions(prefix, it));
                break;

            case ContextTag.METHOD:
                result.push( ... this.getClassMethodCompletions(prefix, it));
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
            result.push.apply(result, partial)
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
            unit.resolve(result)

            for (const it of Object.keys(result.include)) {
                const n = this.findInclude(it);
                if (!n)
                    continue
                this.ensureFileLoaded(n, false);
            }
        }
        catch(e: any) {
            unit.state = 'failed'
            unit.resolve(undefined)

            console.error(e)
            this.logger.error('Error {0}', e)
        }

        return unit.ready

    }

    public async getIncludeQueue(fileName: string): Promise<UnitInfo[]>
    {
        const queue = new Queue
        const result: UnitInfo[] = []
        const fullName = this.findInclude(fileName)
        if (!fullName)
            return result;

        queue.add(fullName)

        console.log("----BEGIN")
        while (!queue.empty) {
            const includeFile = queue.next()
            if (!includeFile)
                continue

            const fullIncludeName = this.findInclude(includeFile)
            if (!fullIncludeName)
                continue

            console.log("----ADD " + fullIncludeName)

            const unit = await this.ensureFileLoaded(fullIncludeName, false);
            if (unit) {
                result.push(unit)

                const newIncludes = Object.keys(unit.include).map( e=> this.findInclude(e))
                queue.add(newIncludes)
            }
        }
        console.log("----END")

        return result;
    }

    public getTypeDefinitions(fileName: vscode.Uri, word: string, unit: UnitInfo, token: vscode.CancellationToken): vscode.LocationLink[]
    {
        const result: vscode.LocationLink[] = []

        for (const e of Object.values(unit.class)) {

            if (token.isCancellationRequested)
                break;

            if (e.name !== word)
                continue

            result.push({
                targetUri: fileName,
                targetRange: vscodeRange(e.begin, e.end)
            });
        }

        for (const e of Object.values(unit.interface)) {
            if (token.isCancellationRequested)
                break;

            if (e.name !== word)
                continue

            result.push({
                targetUri: fileName,
                targetRange: vscodeRange(e.begin, e.end)
            });
        }

        return result;
    }

    public async getDefinitions(fileName: string, word: string, token: vscode.CancellationToken): Promise<vscode.LocationLink[]>
    {
        const includes = await this.getIncludeQueue(fileName)
        const result: vscode.LocationLink[] = []
        for (const unit of includes) {
            if (!unit)
                continue

            result.push(... this.getTypeDefinitions(vscode.Uri.file(unit.fileName), word, unit, token) )
        }
        // TODO: this obtains 'type' definitions only
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

    private startLoading()
    {
        if (this.loading)
            return

        this.loading = true;
        Promise.resolve().then( async () => {
            for (const it of this.loadingQueue.items()) {
                const unit = this.unitInfo.get(it)
                switch(unit?.state) {
                case null:
                case 'opened':
                    continue

                case 'failed':
                case 'opening':
                case 'update':
                    await this.loadFileSafe(it, unit)
                    break;
                }
            }

            this.loading = false;
            this.loadingQueue.reset()
        })
    }

    private ensureFileLoaded(fileName: string, update: boolean): Promise<UnitInfo|undefined>
    {
        let resolve!: (e: UnitInfo|undefined) => void, reject: (e: any) => void;

        const promise = new Promise<UnitInfo|undefined>((resolve_, reject_) => {
            resolve = resolve_
            reject = reject_;
        })

        const fullName = this.findInclude(fileName);
        if (!fullName)
            return Promise.resolve(undefined)

        let info = this.unitInfo.get(fullName)

        switch (info?.state) {
        case null:
        case undefined:
            this.unitInfo.set(fullName, {
                state: 'opening',
                unitInfo: undefined,
                ready: promise,
                resolve: resolve!
            })
            info = this.unitInfo.get(fullName)
            break;

        case 'opening':
        case 'update':
            return info.ready

        case 'failed':
        case 'opened':
            if (update) {
                info.ready = promise
                info.resolve = resolve;
            }
            else
                return info.ready
        }

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

export function createRepository(env: ZsEnvironment, logger: Logger): ZsRepository
{
    if (repo)
        throw new Error("Repo already exists")

    repo = new ZsRepository(env, logger)

    return repo;
}

export function getRepository(): ZsRepository
{
    if (!repo) {
        throw new Error("REpo does not exist yet")
    }

    return repo;
}
