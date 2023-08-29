import { getScopeDefinitions } from "../lang/InterUnitInfo";
import { ContextTag, Position } from "../lang/UnitInfo";
import { CancellationToken } from "../util/util";
import { ZsRepository } from "../lang/zsRepository";

export interface ZsDefinitionSink
{
    add(fileName: string, start: Position, end: Position): void;
}

export class ZsDefinitions
{
    constructor(private repo: ZsRepository)
    {
    }

    public async getDefinitions(result: ZsDefinitionSink, initialFileName: string, word: string, position: Position, token: CancellationToken): Promise<void>
    {
        const includes = await this.repo.getIncludeQueue(initialFileName)

        for (const it of getScopeDefinitions(includes, position, (e) => e.name === word)) {
            result.add(it.fileName, it.begin, it.end);

            if (token.isCancellationRequested)
                break;
        }
    }
}
