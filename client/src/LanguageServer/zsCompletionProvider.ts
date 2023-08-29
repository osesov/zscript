import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/lang/zsRepository'
import { Logger, logSystem } from '../../../zslib/src/util/logger';
import { fromVscode } from '../../../zslib/src/util/vscodeUtil';
import { ZsCompletionSink, ZsCompletions } from '../../../zslib/src/services/zsCompletions'
import { CompletionItemKind } from 'vscode-languageclient';
import { DocBlock } from '../../../zslib/src/lang/UnitInfo';

class ZsCompletionSinkImpl implements ZsCompletionSink
{
    public list: vscode.CompletionList = new vscode.CompletionList(undefined, false)
    private seen = new Set<string>

    add(label: string, kind: CompletionItemKind, detail: string | undefined, doc: DocBlock): void {
        if (!this.seen.has(label)) {
            this.seen.add(label)
            const item = new vscode.CompletionItem(label, kind);

            if (detail)
                item.detail = detail;

            if (doc.length > 0) {
                item.documentation = doc.join('\n')
            }
            this.list.items.push(item)
        }
    }
}
export class ZsCompletionProvider implements vscode.CompletionItemProvider
{
    private repo: ZsRepository
    private logger: Logger
    private provider: ZsCompletions

    constructor(repo: ZsRepository)
    {
        this.repo = repo;
        this.provider = new ZsCompletions(repo)
        this.logger = logSystem.getLogger(ZsCompletionProvider)
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, _context: vscode.CompletionContext): Promise<vscode.CompletionItem[]>
    {
        const words = fromVscode.getWordsAtCursor(document, position, true)
        if (words.length === 0)
            return [];

        this.logger.info("Get completions for: {@word}", words)
        const fileName = document.uri.fsPath

        try {
            const result = new ZsCompletionSinkImpl
            await this.repo.onDocumentAccess(document);
            await this.provider.getCompletions(result, fileName, words, fromVscode.position(position), token);
            this.logger.info(`completion for ${words.join('.')}: ${result.list.items.map(e => e.label)}`)
            return result.list.items
        } catch(e: unknown) {
            this.logger.error("Error {error}", e)
            throw e;
        }
    }
}
