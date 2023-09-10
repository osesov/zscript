import { globIterate } from 'glob'
import { minimatch } from 'minimatch'
import { Position } from '../lang/UnitInfo';

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


export function comparePosition(lhs: Position, rhs: Position): number
{
    const line = lhs.line - rhs.line;
    if (line < 0)
        return -1
    if (line == 0)
        return lhs.column - rhs.column
    return +1
}

export function inRange(position: Position, begin: Position, end: Position): boolean
{
    if (position.line < begin.line)
        return false

    if (position.line === begin.line && position.column < begin.column)
        return false

    if (position.line > end.line)
        return false;

    if (position.line === end.line && position.column > end.column)
        return false

    return true;
}
