import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/zsRepository'
import { Logger, logSystem } from '../../../zslib/src/logger';
import { getWordAtCursor } from './util';
import { fromVscode } from '../../../zslib/src/vscodeUtil';

export class ZsCompletionProvider implements vscode.CompletionItemProvider
{
    private repo: ZsRepository
    private logger: Logger

    constructor(repo: ZsRepository)
    {
        this.repo = repo;
        this.logger = logSystem.getLogger(ZsCompletionProvider)
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionList>
    {
        const completionList : vscode.CompletionList = new vscode.CompletionList();
        completionList.isIncomplete = false;

        const word = getWordAtCursor(document, position)
        if (!word)
            return completionList;

        this.logger.info("Get completions for: {@word}")
        const fileName = document.uri.fsPath

        try {
        await this.repo.onDocumentAccess(document);
        const completions = await this.repo.getCompletions(fileName, word.prefix, fromVscode.position(position), token);
        completionList.items.push( ... completions );
        this.logger.info(`completion for ${word?.word} at ${word.offset}:
            ${completionList.items.map(e => e.label)}`)
        return completionList
        } catch(e: unknown) {
            this.logger.error("Error {error}", e)
            throw e;
        }
    }
}
