import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/zsRepository'
import { languageId } from '../common'

export class ZsDocumentMonitor {

    constructor(private repo: ZsRepository, context: vscode.ExtensionContext) {
        context.subscriptions.push(
            ...[
                vscode.workspace.onDidOpenTextDocument((doc) => {
                    if (doc.languageId !== languageId)
                        return
                    repo.onDocumentOpen(doc)
                }),
                vscode.workspace.onDidChangeTextDocument((e) => {
                    if (e.document.languageId !== languageId)
                        return

                    repo.onDocumentChange(e.document)
                })]);

        // vscode.workspace.onDidSaveTextDocument
        // vscode.workspace.onDidCloseTextDocument
    }
}
