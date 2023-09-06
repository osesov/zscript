import { globIterate } from 'glob'
import { minimatch } from 'minimatch'

export interface CancellationToken
{
    isCancellationRequested: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assertUnreachable(x: never): never {
    throw new Error("Didn't expect to get here");
}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPromise<T>(): { promise: Promise<T>, resolve: (e:T) => void, reject: (a:any) => void}
{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolve!: (e: T) => void, reject!: (e: any) => void;

    const promise = new Promise<T>((resolve_, reject_) => {
        resolve = resolve_
        reject = reject_;
    })

    return {
        promise, resolve, reject
    }
}

export interface Word
{
    word: string
    prefix: string
    offset: number
}

export async function * listFiles(patterns: string[]): AsyncGenerator<string>
{
    const filterOut : string[] = []
    const filterIn : string[] = []

    for (const e of patterns) {
        if (e.startsWith('!')) {
            filterOut.push(e.substring(1))
            continue
        }

        filterIn.push(e)
    }

    for await(const file of globIterate(filterIn)) {
        console.log('Check', file)
        const exclude = filterOut.find( rule => minimatch(file, rule));
        if (exclude)
            continue;

        yield file
    }
}
