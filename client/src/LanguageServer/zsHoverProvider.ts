import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/zsRepository';
import { Logger, logSystem } from '../../../zslib/src/logger';

export class ZsHoverProvider implements vscode.HoverProvider
{
    private repo: ZsRepository
    private logger: Logger

    constructor(repo: ZsRepository)
    {
        this.repo = repo;
        this.logger = logSystem.getLogger(ZsHoverProvider)
    }

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        const markdown = new vscode.MarkdownString()

        markdown.appendMarkdown("## Title\n\nSome text here")

        return new vscode.Hover(markdown)
    }

}
