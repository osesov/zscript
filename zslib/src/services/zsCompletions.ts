import { ContextTag, DocBlock, Position } from "../lang/UnitInfo";
import { CancellationToken } from "../util/util";
import { ZsRepository } from "../lang/zsRepository";
import { CompletionItemKind} from 'vscode-languageclient/node'
import { getScopeSymbols } from "../lang/InterUnitInfo";
import { Logger, logSystem } from "../util/logger";

export interface ZsCompletionSink
{
    add(label: string, kind: CompletionItemKind, detail: string | undefined, doc: DocBlock): void;
}

export class ZsCompletions
{
    private logger: Logger

    constructor(private repo: ZsRepository)
    {
        this.logger = logSystem.getLogger(ZsCompletions)
    }

    public async getCompletions(result: ZsCompletionSink, fileName: string, prefix: string, position: Position, token: CancellationToken): Promise<void>
    {
        const includes = await this.repo.getIncludeQueue(fileName)
        const kinds = new Map<ContextTag, CompletionItemKind>(
            [
                [ContextTag.ARGUMENT, CompletionItemKind.Variable],
                [ContextTag.LOCAL_VARIABLE, CompletionItemKind.Variable],

                [ContextTag.GLOBAL_VARIABLE, CompletionItemKind.Variable],
                [ContextTag.GLOBAL_FUNCTION, CompletionItemKind.Function],

                [ContextTag.CLASS, CompletionItemKind.Class],
                [ContextTag.CLASS_METHOD, CompletionItemKind.Method],
                [ContextTag.CLASS_VARIABLE, CompletionItemKind.Field],

                [ContextTag.INTERFACE, CompletionItemKind.Interface],
                [ContextTag.INTERFACE_METHOD, CompletionItemKind.Method],
                [ContextTag.INTERFACE_PROPERTY, CompletionItemKind.Property],

                [ContextTag.DEFINE, CompletionItemKind.Constant],
                [ContextTag.TYPE, CompletionItemKind.TypeParameter],
            ]
        )

        for (const it of getScopeSymbols(includes, position, (e) => e.name.startsWith(prefix))) {
            if (token.isCancellationRequested)
                break;

            let kind = kinds.get(it.context);
            if (!kind) {
                this.logger.error(`Kind if not defined for ${it.context}`)
                kind = CompletionItemKind.Value
            }

            const doc = "docBlock" in it ? it.docBlock : []
            let detail : string | undefined  = undefined

            switch(it.context) {
            case ContextTag.GLOBAL_FUNCTION:
            case ContextTag.CLASS_METHOD:

                detail = it.type.join(' ');

                if (it.context == ContextTag.CLASS_METHOD)
                    detail += " " + it.parent.name + "."

                detail += '(';
                detail += it.args.map( e => e.type.join(' ') + ' ' + e.name).join(',')
                detail += ')';
            }

            result.add(it.name, kind, detail, doc)
        }
    }
}
