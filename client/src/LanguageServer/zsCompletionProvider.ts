import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/zsRepository'
import { Logger } from '../../../zslib/src/logger';
import { getWordAtCursor } from './util';

export class ZsCompletionProvider implements vscode.CompletionItemProvider
{
    private repo: ZsRepository
    private logger: Logger

    constructor(repo: ZsRepository, logger: Logger)
    {
        this.repo = repo;
        this.logger = logger
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionList>
    {
        const fileName = document.uri.fsPath
        const text = document.getText()
        let completionList : vscode.CompletionList = new vscode.CompletionList();
        completionList.isIncomplete = false;

        await this.repo.onDocumentAccess(document);

        const word = getWordAtCursor(document, position)
        if (!word)
            return completionList;

        const completions = await this.repo.getCompletions(fileName, word.prefix, {
            line: position.line,
            column: position.character
        }, token);
        completionList.items.push( ... completions );
        this.logger.debug(`completion for ${word?.word} at ${word.offset}:
            ${completionList.items.map(e => e.label)}`)
        return completionList
    }
}
