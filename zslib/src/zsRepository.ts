import { ClassInfo, ContextTag, InterfaceInfo, UnitInfo, UnitInfoData } from './lang'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// parser
import './zscript.pegjs'
import * as parser from './zscript-parse'
import { Logger, logSystem } from './logger'
import { assertUnreachable, getPromise } from './util'

export interface ZsEnvironment
{
    version: string
    includeDirs: string[]
    stripPathPrefix: string[]
    cacheDir?: string
}

export interface CacheFile
{
    version: string
    fileName: string
    mtime?: number
    data: UnitInfoData
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
    // TODO: currently this causes delay when updateHappen and the file is requested.
    // Should be able to break through
    updateTime: number
}

export interface DocumentText
{
    text: string
    mtime: number
}

export interface FileAccessor
{
    getDocumentText(fileName: string): Promise<DocumentText>
}

export interface TextDocument
{
    fileName: string
}

export class ZsRepository
{
    private unitInfo: Map<string, FileState> = new Map
    private env: ZsEnvironment
    private logger: Logger
    private loadingQueue = new Queue
    private loading = false
    private updateDelay = 10000
    private fileAccessor: FileAccessor
    private writeQueue: Promise<void> = Promise.resolve()

    constructor(env: ZsEnvironment, fileAccessor: FileAccessor)
    {
        this.env = env
        this.fileAccessor = fileAccessor
        this.logger = logSystem.getLogger(ZsRepository);
    }

    updateEnvironment(env: ZsEnvironment)
    {
        this.env = env
    }

    private findInclude(fileName: string, baseDir: string | null): string | undefined
    {
        if (fs.existsSync(fileName))
            return path.resolve(fileName)

        // TODO: this must be applicable to non-system includes only
        if (baseDir && fs.existsSync(path.resolve(baseDir, fileName)))
            return path.resolve(baseDir, fileName)

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

    public dispose(): void
    {
        this.unitInfo.clear()
    }

    // Loaders/parsers
    private getCacheFileName(cacheDir: string, fileName: string): string
    {
        const digest = crypto.createHash('sha1').update(fileName).digest('hex')
        const cacheFile = path.resolve(cacheDir, digest);
        return cacheFile
    }

    private async loadFromCache(fileName: string, doc: DocumentText): Promise<UnitInfo|undefined>
    {
        if (!this.env.cacheDir)
            return undefined;

        const cacheFileName = this.getCacheFileName(this.env.cacheDir, fileName)

        if (!fs.existsSync(cacheFileName))
            return undefined

        try {
            // const stat = await fs.promises.stat(cacheFileName)
            const data = await fs.promises.readFile(cacheFileName, 'utf-8')
            const json = JSON.parse(data) as CacheFile;
            if (!json.mtime) // including zero value
                return undefined

            if (doc.mtime && json.mtime !== doc.mtime)
                return undefined

            if (json.version !== this.env.version) // do not upgrade
                return undefined;

            return UnitInfo.fromJson(fileName, json.data)
        }

        catch(e: unknown) {
            this.logger.error("Unable to load cache file {file}: {@error}", fileName, e)
            return undefined;
        }

    }

    private async saveFileCache(fileName: string, doc: DocumentText, unit: UnitInfo): Promise<void>
    {
        if (!this.env.cacheDir)
            return;

        this.writeQueue = this.writeQueue.then(async () => {
            if (!this.env.cacheDir)
                return;

            const cacheFileName = this.getCacheFileName(this.env.cacheDir, fileName)
            const cacheFileData: CacheFile = {
                version: this.env.version,
                fileName: fileName,
                mtime: doc.mtime <= 0 ? undefined : doc.mtime,
                data: unit.toJSON()
            }

            const result = JSON.stringify(cacheFileData, undefined, 4)
            await fs.promises.mkdir(path.dirname(cacheFileName), {recursive: true})
            return fs.promises.writeFile(cacheFileName, result)
        });
    }

    private async updateFileInfoSafe(fileName: string, doc: DocumentText, unit: FileState): Promise<UnitInfo|undefined>
    {
        const getUnitInfo = async (): Promise<[boolean, UnitInfo]> => {
            const result = await this.loadFromCache(fileName, doc)

            if (result)
                return [true, result]

            return [false, parser.parse(doc.text, {
                grammarSource: fileName,
                fileName: fileName,
            })]
        }

        try {
            const [fromCache, unitInfo] = await getUnitInfo()

            unit.state = 'opened'
            unit.unitInfo = unitInfo
            this.logger.info(`${fromCache ? 'loaded' : 'parsed'} {file}`, this.stripPathPrefix(fileName))
            unit.resolve(unitInfo)

            if (!fromCache)
                this.saveFileCache(fileName, doc, unitInfo);

            const baseName = path.dirname(fileName)
            for (const it of Object.keys(unitInfo.include)) {
                const n = this.findInclude(it, baseName);
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

    private async loadFileSafe(fileName: string, unit: FileState)
    {
        const docInfo = await this.fileAccessor.getDocumentText(fileName);
        await this.updateFileInfoSafe(fileName, docInfo, unit);
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
        const { promise, resolve } = getPromise<UnitInfo|undefined>()

        const fullName = this.findInclude(fileName, null);
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

    // ### Find out some properties for loaded classes

    // Get inheritance list given a class or interface (both extends and implements)
    public async getInheritance(start: ClassInfo|InterfaceInfo, fileName: string): Promise<(ClassInfo|InterfaceInfo)[]>
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
                        e.implements.forEach( p => loaded.has(p) || looking.add(p))
                        e.extends.forEach( p => loaded.has(p) || looking.add(p))
                        break

                    case ContextTag.INTERFACE:
                        e.inherit.forEach( p => loaded.has(p) || looking.add(p))
                        break
                    }
                }
            }

            if (!somethingChanged)
                break;
        }
        return result;
    }

    // Get list of includes, starting from given file, going width-depth
    public async getIncludeQueue(fileName: string): Promise<UnitInfo[]>
    {
        const queue = new Queue
        const result: UnitInfo[] = []
        const fullName = this.findInclude(fileName, null)
        if (!fullName)
            return result;

        queue.add(fullName)

        while (!queue.empty) {
            const includeFile = queue.next()
            if (!includeFile)
                continue

            const unit = await this.ensureFileLoaded(includeFile, false);
            if (unit) {
                result.push(unit)

                const baseName = path.dirname(includeFile)
                const newIncludes = Object.keys(unit.include).map( e=> this.findInclude(e, baseName))
                queue.add(newIncludes)
            }
        }

        return result;
    }

    /// document maintenance
    public onDocumentOpen(doc: TextDocument): Promise<UnitInfo|undefined>
    {
        return this.ensureFileLoaded(doc.fileName, false);
    }

    public onDocumentChange(doc: TextDocument): Promise<UnitInfo|undefined>
    {
        return this.ensureFileLoaded(doc.fileName, true)
    }

    public onDocumentAccess(doc: TextDocument): Promise<UnitInfo|undefined>
    {
        return this.ensureFileLoaded(doc.fileName, false)
    }
}

let repo: ZsRepository

export function createRepository(env: ZsEnvironment, fileAccessor: FileAccessor): ZsRepository
{
    if (repo)
        throw new Error("Repo already exists")

    repo = new ZsRepository(env, fileAccessor)

    return repo;
}

export function getRepository(): ZsRepository
{
    if (!repo) {
        throw new Error("REpo does not exist yet")
    }

    return repo;
}
