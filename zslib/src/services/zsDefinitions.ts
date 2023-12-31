import { getScopeContext, getScopeDefinitions } from "../lang/InterUnitInfo";
import { ContextTag, Position } from "../lang/UnitInfo";
import { CancellationToken } from "../util/util";
import { FileIncludeStatusTag, ZsRepository } from "../lang/zsRepository";
import * as path from 'path'

export interface ZsDefinitionSink
{
    add(fileName: string, start: Position, end: Position): void;
}

export class ZsDefinitions
{
    constructor(private repo: ZsRepository)
    {
    }

    public async getDefinitions(result: ZsDefinitionSink, initialFileName: string, words: string[], position: Position, token: CancellationToken): Promise<void>
    {
        const includes = await this.repo.getIncludeQueue(initialFileName)

        for (const it of getScopeContext(includes, words, position, {prefix: false})) {
            if (it.context === ContextTag.DEFINE)
                it.definitions.forEach( e => result.add(it.unit.fileName, e.begin, e.end))
            else
                result.add(it.unit.fileName, it.begin, it.end);

            if (token.isCancellationRequested)
                break;
        }

        // for (const it of getScopeDefinitions(includes, position, (e) => e.name === word)) {
        //     result.add(it.fileName, it.begin, it.end);

        //     if (token.isCancellationRequested)
        //         break;
        // }
    }

    public getLineDefinitions(result: ZsDefinitionSink, fileName: string, lineno: number, text: string): boolean
    {
        const m: RegExpExecArray | null = /^(\s*#\s*include\s+(["<]))([^">]*)([">]).*$/.exec(text);

        if (m === null)
            return false;

        const prefix = m[1]
        // const system = m[2] === "<";
        const includeName = m[3];
        const includeStatus = this.repo.findIncludeFile(includeName, path.dirname(fileName), {direct: true});
        if (includeStatus.status !== FileIncludeStatusTag.success)
            return false;

        const resultFile: string = includeStatus.fileName;
        const start = {line: lineno, column: prefix.length}
        const end = {line: lineno, column: prefix.length + includeName.length}

        result.add(resultFile, start, end)
        return true;
    }
}
