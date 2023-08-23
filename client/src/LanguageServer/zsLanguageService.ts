// simplified completion provider

import * as vscode from 'vscode';
import { ZsCompletionProvider } from "./zsCompletionProvider";
import { createRepository } from '../../../zslib/src/zsRepository';
import { Logger } from '../../../zslib/src/logger';
import { ZsDefinitionProvider } from './ZsDefinitionProvider';
import { languageId } from '../common';

export namespace zsLanguageService
{

    export function start(context: vscode.ExtensionContext, logger: Logger)
    {
		const config = vscode.workspace.getConfiguration(languageId)
		const includeDirs: string[] = config.get('includeDir') ?? []

		const repo = createRepository({includeDirs: includeDirs}, logger)
		// TODO:
		// vscode.languages.registerReferenceProvider;
		// vscode.languages.registerHoverProvider;
		// vscode.languages.registerDeclarationProvider;
		// vscode.languages.registerDocumentLinkProvider;
		// vscode.languages.registerDocumentSymbolProvider;
		context.subscriptions.push(vscode.languages.registerCompletionItemProvider(languageId, new ZsCompletionProvider(repo, logger) ));
		context.subscriptions.push(vscode.languages.registerDefinitionProvider(languageId, new ZsDefinitionProvider(repo, logger)) )
		context.subscriptions.push(repo)
    }

	export function stop(): Thenable<void> | undefined {
		// if (!client) {
		// 	return undefined;
		// }
		// return client.stop();

		return undefined
	}

}
