import { UnitInfo, UnitInfoData } from './UnitInfo'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as ignore from 'ignore'

// parser
import './zscript.pegjs'
import * as parser from './zscript-parse'
import { Logger, logSystem } from '../util/logger'
import { assertUnreachable, getPromise, listFiles } from '../util/util'
import { Queue } from '../util/queue'
export interface ZsEnvironment
{
    version: string
    includeDirs: string[]
    basePath: string
    ignore: string[]
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
    private ignore: ignore.Ignore
    private indexAll: {
        ready: Promise<void>
        started: boolean
    }

    constructor(env: ZsEnvironment, fileAccessor: FileAccessor)
    {
        this.env = env
        this.fileAccessor = fileAccessor
        this.logger = logSystem.getLogger(ZsRepository);
        this.ignore = ignore.default().add(this.env.ignore)
        this.indexAll = this.resetIndexAllFiles()
    }

    updateEnvironment(env: ZsEnvironment)
    {
        this.env = env
        this.ignore = ignore.default().add(this.env.ignore)
        this.indexAll = this.resetIndexAllFiles()
    }

    resetIndexAllFiles(): ZsRepository["indexAll"]
    {
        const promise = Promise.reject('Not parsed')
        promise.catch(() => {})

        return {
            ready: promise,
            started: false
        }
    }

    public findInclude(fileName: string, baseDir: string | null, options: { direct: boolean }): string | undefined
    {
        const checkFile = (p: string): string | undefined => {
            if (!fs.statSync(p).isFile())
                return undefined

            if (!options.direct && fileName.startsWith(this.env.basePath)) {
                const r = path.relative(this.env.basePath, p)

                if (this.ignore.ignores(r))
                   return undefined
            }

            return p
        }

        if (fs.existsSync(fileName)) {
            return checkFile(fileName)
        }

        // TODO: this must be applicable to non-system includes only
        if (baseDir) {
            const p = path.resolve(baseDir, fileName);
            if (fs.existsSync(p)) {
                return checkFile(p)
            }
        }

        for(const dir of this.env.includeDirs) {
            const p = path.resolve(dir, fileName)
            if (fs.existsSync(p)) {
                return checkFile(p)
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
        const getUnitInfo = async (allowCache : boolean): Promise<[boolean, UnitInfo]> => {
            const result = allowCache && await this.loadFromCache(fileName, doc)

            if (result)
                return [true, result]

            return [false, parser.parse(doc.text, {
                grammarSource: fileName,
                fileName: fileName,
            })]
        }

        try {
            const [fromCache, unitInfo] = await getUnitInfo(unit.state !== 'update')

            unit.state = 'opened'
            unit.unitInfo = unitInfo
            this.logger.info(`${fromCache ? 'loaded' : 'parsed'} {file}`, this.stripPathPrefix(fileName))
            unit.resolve(unitInfo)

            if (!fromCache)
                this.saveFileCache(fileName, doc, unitInfo);

            const baseName = path.dirname(fileName)
            for (const it of Object.keys(unitInfo.includes)) {
                const n = this.findInclude(it, baseName, {direct: false});
                if (!n) {
                    this.logger.warn("Unable to find include {file}. Update 'zscript.includeDir'.", it)
                    continue
                }
                this.ensureFileLoaded(n, false, false);
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
                    this.logger.debug('Do loading {file}', it)
                    await this.loadFileSafe(it, unit)
                    break;

                default:
                    // assertUnreachable(unit?.state)
                }
            }

            if (postpone.length > 0) {
                if (updateTime === null)
                    throw Error("Postpone parsing and no update time");
                this.logger.debug('Delay loading {@files}', postpone)
                this.loadingQueue.requeue(postpone)
                const now = Date.now()
                const scheduleIn = (updateTime < now) ? 0 : updateTime - now
                setTimeout(() => {
                    this.logger.debug('Continue loading {@files}', postpone)
                    this.doLoading()
                }, scheduleIn)
            }
            else {
                this.loading = false;
                this.loadingQueue.reset()
                this.logger.debug('Stop loading')
            }
        })
    }

    private startLoading()
    {
        if (this.loading)
            return

        this.logger.debug('Start loading')

        this.loading = true;
        this.doLoading();
    }

    private ensureFileLoaded(fileName: string, update: boolean, force: boolean): Promise<UnitInfo|undefined>
    {
        const { promise, resolve } = getPromise<UnitInfo|undefined>()

        const fullName = this.findInclude(fileName, null, {direct: true});
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

        case 'update':
            if (force) {
                info.updateTime = 0;
                this.doLoading();
            }
            return info.ready

        case 'opening':
            return info.ready

        case 'failed':
        case 'opened':
            if (update) {
                info.state = 'update'
                info.updateTime = force ? 0 : Date.now() + this.updateDelay
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

    // Get list of includes, starting from given file, going width-depth
    public async getIncludeQueue(fileName: string): Promise<UnitInfo[]>
    {
        const queue = new Queue
        const result: UnitInfo[] = []
        const fullName = this.findInclude(fileName, null, { direct: true})
        if (!fullName)
            return result;

        queue.add(fullName)

        while (!queue.empty) {
            const includeFile = queue.next()
            if (!includeFile)
                continue
            const unit = await this.ensureFileLoaded(includeFile, false, false);
            if (unit) {
                result.push(unit)

                const baseName = path.dirname(includeFile)
                const newIncludes = Object.keys(unit.includes).map( e=> this.findInclude(e, baseName, {direct: false}))
                queue.add(newIncludes)
            }
        }

        return result;
    }

    // todo: need to load/index all the files
    public async getAllUnits(): Promise<UnitInfo[]>
    {
        const result : UnitInfo[] = []

        this.unitInfo.forEach( async (_, fileName) => {
            const u = await this.ensureFileLoaded(fileName, false, true);
            if (u)
                result.push(u);
        })
        return result;
    }

    /// document maintenance
    public onDocumentOpen(doc: TextDocument): Promise<UnitInfo|undefined>
    {
        return this.ensureFileLoaded(doc.fileName, false, false);
    }

    public onDocumentChange(doc: TextDocument): Promise<UnitInfo|undefined>
    {
        return this.ensureFileLoaded(doc.fileName, true, false)
    }

    public onDocumentAccess(doc: TextDocument): Promise<UnitInfo|undefined>
    {
        return this.ensureFileLoaded(doc.fileName, false, true)
    }

    public async getCacheForDocument(doc: TextDocument): Promise<({fileName : string} | {data: string, format: 'json'})>
    {
        const unitInfo = await this.ensureFileLoaded(doc.fileName, false, true)
        const fileData = () => JSON.stringify(unitInfo?.toJSON(), undefined, 4)

        if (!this.env.cacheDir)
            return { data: fileData(), format: 'json' }

        const fileName = this.getCacheFileName(this.env.cacheDir, doc.fileName)
        if (!fs.existsSync(fileName))
            return { data: fileData(), format: 'json'  }

        return { fileName: fileName, format: 'json'  }
    }

    public async rebuildIndex(doc: TextDocument): Promise<void>
    {
        await this.ensureFileLoaded(doc.fileName, true, true)
    }

    private isQueued(fileName: string) : boolean
    {
        return this.loadingQueue.has(fileName) || this.unitInfo.has(fileName)
    }

    public async indexAllFiles(progress: (fileName: string, index: number, total: number) => boolean): Promise<void>
    {
        if (this.indexAll.started)
            return this.indexAll.ready

        this.indexAll.started = true
        return this.indexAll.ready = Promise.resolve()
        .then(async () => {
            let ready = Promise.resolve(false)
            let total = 0;

            for await (const file of listFiles([this.env.basePath + '/**/*.{zs,zi}'])) {
                if (!fs.statSync(file).isFile()) {
                    continue
                }

                if (this.isQueued(file))
                    continue

                const index = total++;

                ready = ready.then((done) => {
                    if (done || progress(file, index, total))
                        return true

                    // this.logger.info(`Load ${index}/${total} ${file}`)
                    return this.ensureFileLoaded(file, false, true).then( () => false )
                })
            }

            return ready
        }).then(() => {})
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
