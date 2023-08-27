import * as vscode from 'vscode'
import { languageId } from '../common'
import { ZsRepository } from '../../../zslib/src/lang/zsRepository'
import { logSystem } from '../../../zslib/src/util/logger';

export class ZsDocumentMonitor implements vscode.Disposable
{

    private logger = logSystem.getLogger(ZsDocumentMonitor)

    dispose() {

    }

    constructor(private repo: ZsRepository, context: vscode.ExtensionContext) {
        context.subscriptions.push(
            ...[
                vscode.workspace.onDidOpenTextDocument((doc) => {
                    if (doc.languageId !== languageId)
                        return

                    this.logger.debug('Open doc {languageId} {name}', doc.languageId, doc.fileName)
                    repo.onDocumentOpen(doc)
                }),
                vscode.workspace.onDidChangeTextDocument((e) => {
                    if (e.document.languageId !== languageId)
                        return

                    if (!e.contentChanges)
                        return;

                    this.logger.debug('Change doc {languageId} {name}', e.document.languageId, e.document.fileName)

                    repo.onDocumentChange(e.document)
                })]);

        // vscode.workspace.onDidSaveTextDocument
        // vscode.workspace.onDidCloseTextDocument

        vscode.workspace.textDocuments.forEach((doc) => {
            if (doc.languageId !== languageId)
                return

            this.logger.debug('initial doc open {languageId} {name}', doc.languageId, doc.fileName)
            repo.onDocumentOpen(doc)
        })

        console.log('activate zscript monitor');
    }
}
