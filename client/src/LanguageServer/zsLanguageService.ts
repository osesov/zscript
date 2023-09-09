// simplified completion provider

import * as vscode from 'vscode';
import * as path from 'path'
import { ZsCompletionProvider } from "./zsCompletionProvider";
import { FileAccessor, ZsEnvironment, createRepository } from '../../../zslib/src/lang/zsRepository';
import { ZsDefinitionProvider } from './zsDefinitionProvider';
import { languageId } from '../common';
import { ZsDocumentMonitor } from './zsDocumentMonitor';
import { Logger, logSystem } from '../../../zslib/src/util/logger';
import { fromVscode } from '../../../zslib/src/util/vscodeUtil';

import { ZsHoverProvider } from './zsHoverProvider';
import { ZsDocumentSymbolProvider, ZsWorkspaceSymbolProvider } from './zsSymbolProvider';
import { ZsTypeHierarchyProvider } from './zsTypeHierarchyProvider';
import variables from '../../../zslib/src/util/vscode-variables';
import { ZsDocumentSemanticTokensProvider } from './ZsDocumentSemanticTokensProvider';

export namespace zsLanguageService
{

	// eslint-disable-next-line no-inner-declarations
	function appendDelimiter(it: string): string
	{
		if (path.sep !== '/')
			it = it.replace("/", path.sep)

		if (it.endsWith(path.sep))
			return it
		else
			return it + path.sep;
	}

	// eslint-disable-next-line no-inner-declarations
	function getAsStringArray(config: vscode.WorkspaceConfiguration, name: string): string[]
	{
		const value = config.get(name)
		if (!value || !Array.isArray(value))
			return []

		return value.map( e => String(e))
	}

	// eslint-disable-next-line no-inner-declarations
	function getAsString(config: vscode.WorkspaceConfiguration, name: string, defValue: string): string
	{
		const value = config.get(name)
		if (!value)
			return variables(defValue)

		return variables(String(value))
	}

	// eslint-disable-next-line no-inner-declarations
	function loadConfiguration(version: string, config: vscode.WorkspaceConfiguration, logger: Logger): ZsEnvironment
	{
		const ignore = getAsStringArray(config, 'ignore').map(e => variables(e))
		const basePath: string = getAsString(config, 'basePath', "${workspaceFolder}")
		const includeDirs: string[] = getAsStringArray(config, 'includeDir').map(e => variables(e))
		const stripPathPrefix: string[] = getAsStringArray(config, 'stripPathPrefix').map(appendDelimiter).map(e=>variables(e))
		let cacheDir: string | undefined = config.get('cacheDir');
		const logLevel = logSystem.getLevel(config.get('logLevel'))

		if (cacheDir)
			cacheDir = variables(cacheDir);

		const settings: ZsEnvironment = {
			version: version,
			includeDirs: includeDirs,
			basePath: basePath,
			ignore: ignore,
			stripPathPrefix: stripPathPrefix,
			cacheDir: cacheDir,
		}

        for (const dir of vscode.workspace.workspaceFolders ?? []) {
			includeDirs.push(dir.uri.fsPath)
        }

		// if (logLevel !== undefined)
		// 	logSystem.setLevel(logLevel);
		logger.debug("Settings: {@settings}", settings);

		return settings
	}

    export function start(context: vscode.ExtensionContext)
    {
		const logger = logSystem.getLogger("zscript-lsp")
		console.log("Activate zscript language service");
		const selector: vscode.DocumentFilter = { language: languageId, scheme: 'file' }
		const config = vscode.workspace.getConfiguration(languageId)
		const version = context.extension.packageJSON.version
		const fileAccessor: FileAccessor = {
			getDocumentText: fromVscode.getDocumentText
		}

		const repo = createRepository(loadConfiguration(version, config, logger), fileAccessor)
		vscode.workspace.onDidChangeConfiguration(() => repo.updateEnvironment(loadConfiguration(version, config, logger)))
		// TODO:
		// vscode.languages.registerCodeLensProvider
		// vscode.languages.registerCodeActionsProvider // https://code.visualstudio.com/docs/editor/editingevolved#_code-action
		// vscode.languages.registerCallHierarchyProvider
		// vscode.languages.registerInlineCompletionItemProvider
		// vscode.languages.registerImplementationProvider
		// vscode.languages.registerDeclarationProvider
		// vscode.languages.registerEvaluatableExpressionProvider
		// vscode.languages.registerInlineValuesProvider
		// vscode.languages.registerDocumentHighlightProvider
		// vscode.languages.registerReferenceProvider
		// vscode.languages.registerRenameProvider
		// vscode.languages.registerDocumentRangeSemanticTokensProvider
		// vscode.languages.registerSignatureHelpProvider
		// vscode.languages.registerColorProvider
		// vscode.languages.registerInlayHintsProvider // https://code.visualstudio.com/docs/typescript/typescript-editing#_inlay-hints
		// vscode.languages.registerDocumentLinkProvider

		context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(selector, new ZsDocumentSemanticTokensProvider(repo), ZsDocumentSemanticTokensProvider.getLegend()));
		context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, new ZsCompletionProvider(repo) ));
		context.subscriptions.push(vscode.languages.registerDefinitionProvider(selector, new ZsDefinitionProvider(repo)) )
		context.subscriptions.push(vscode.languages.registerHoverProvider(selector, new ZsHoverProvider(repo)) )
		// https://code.visualstudio.com/docs/editor/editingevolved#_go-to-symbol
		context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, new ZsDocumentSymbolProvider(repo)))
		context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new ZsWorkspaceSymbolProvider(repo)))
		context.subscriptions.push(vscode.languages.registerTypeHierarchyProvider(selector, new ZsTypeHierarchyProvider(repo)))
		context.subscriptions.push(new ZsDocumentMonitor(repo, context))
		context.subscriptions.push(repo)

		context.subscriptions.push(
			vscode.commands.registerTextEditorCommand('extension.zscript.rebuildIndex',
			(textEditor: vscode.TextEditor) => {
			vscode.window.setStatusBarMessage("Updating index...",
				repo.rebuildIndex(textEditor.document)
				.catch(e => vscode.window.showErrorMessage(e)))
		}));

		context.subscriptions.push(
			vscode.commands.registerTextEditorCommand('extension.zscript.openIndexFile',
				async (textEditor: vscode.TextEditor) => {
					const indexFile = await repo.getCacheForDocument(textEditor.document);
					if ("fileName" in indexFile) {
						vscode.workspace.openTextDocument(indexFile.fileName)
							.then( doc => vscode.window.showTextDocument(doc) )
					}

					else if ("data" in indexFile) {
						vscode.workspace.openTextDocument({language: indexFile.format, content: indexFile.data})
							.then( doc => vscode.window.showTextDocument(doc) )

					}
					else
						vscode.window.showErrorMessage("Unable to open index file");
				}));
    }

	export function stop(): Thenable<void> | undefined {
		// if (!client) {
		// 	return undefined;
		// }
		// return client.stop();

		return undefined
	}

}
