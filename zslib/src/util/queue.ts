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

    public has(str: string): boolean
    {
        return this.seen.has(str)
    }
}
