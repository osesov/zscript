
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
