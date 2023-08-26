import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/zsRepository'
import { Logger, logSystem } from '../../../zslib/src/logger';
import { fromVscode } from '../../../zslib/src/vscodeUtil';
import { CompletionSink, ZsCompletions } from '../../../zslib/src/zsCompletions'
import { CompletionItemKind } from 'vscode-languageclient';

class ZsCompletionSink implements CompletionSink
{
    public list: vscode.CompletionList = new vscode.CompletionList(undefined, false)
    private seen = new Set<string>

    add(label: string, kind: CompletionItemKind/*, options?: CompletionItem*/): void {
        if (!this.seen.has(label)) {
            this.seen.add(label)
            this.list.items.push( new vscode.CompletionItem(label, kind))
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
        const word = fromVscode.getWordAtCursor(document, position)
        if (!word)
            return [];

        this.logger.info("Get completions for: {@word}")
        const fileName = document.uri.fsPath

        try {
            const result = new ZsCompletionSink
            await this.repo.onDocumentAccess(document);
            await this.provider.getCompletions(result, fileName, word.prefix, fromVscode.position(position), token);
            this.logger.info(`completion for ${word?.word} at ${word.offset}:
                ${result.list.items.map(e => e.label)}`)
            return result.list.items
        } catch(e: unknown) {
            this.logger.error("Error {error}", e)
            throw e;
        }
    }
}
