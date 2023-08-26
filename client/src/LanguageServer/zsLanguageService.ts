// simplified completion provider

import * as vscode from 'vscode';
import * as path from 'path'
import { ZsCompletionProvider } from "./zsCompletionProvider";
import { FileAccessor, ZsEnvironment, createRepository } from '../../../zslib/src/zsRepository';
import { ZsDefinitionProvider } from './zsDefinitionProvider';
import { languageId } from '../common';
import { ZsDocumentMonitor } from './zsDocumentMonitor';
import { Logger, logSystem } from '../../../zslib/src/logger';
import { fromVscode } from '../../../zslib/src/vscodeUtil';

import {default as subst} from 'vscode-variables'
import { ZsHoverProvider } from './zsHoverProvider';

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
	function loadConfiguration(version: string, config: vscode.WorkspaceConfiguration, logger: Logger): ZsEnvironment
	{
		const includeDirs: string[] = getAsStringArray(config, 'includeDir').map(e=>subst(e))
		const stripPathPrefix: string[] = getAsStringArray(config, 'stripPathPrefix').map(appendDelimiter).map(e=>subst(e))
		let cacheDir: string | undefined = config.get('cacheDir');

		if (cacheDir)
			cacheDir = subst(cacheDir);

		const settings: ZsEnvironment = {
			version: version,
			includeDirs: includeDirs,
			stripPathPrefix: stripPathPrefix,
			cacheDir: cacheDir,
		}

        for (const dir of vscode.workspace.workspaceFolders ?? []) {
			includeDirs.push(dir.uri.fsPath)
        }
		logger.debug("Settings: {@settings}", settings);
		return settings
	}

    export function start(context: vscode.ExtensionContext)
    {
		const logger = logSystem.getLogger("zscript-lsp")
		console.log("Activate zscript language service");
		const documentFilter: vscode.DocumentFilter = { language: languageId, scheme: 'file' }
		const config = vscode.workspace.getConfiguration(languageId)
		const version = context.extension.packageJSON.version
		const fileAccessor: FileAccessor = {
			getDocumentText: fromVscode.getDocumentText
		}

		const repo = createRepository(loadConfiguration(version, config, logger), fileAccessor)
		vscode.workspace.onDidChangeConfiguration(() => repo.updateEnvironment(loadConfiguration(version, config, logger)))
		// TODO:
		// vscode.languages.registerReferenceProvider;
		// vscode.languages.registerDeclarationProvider;
		// vscode.languages.registerDocumentLinkProvider;
		// vscode.languages.registerDocumentSymbolProvider; // https://code.visualstudio.com/docs/editor/editingevolved#_go-to-symbol
		// vscode.languages.registerInlayHintsProvider // https://code.visualstudio.com/docs/typescript/typescript-editing#_inlay-hints
		// context.subscriptions.push( vscode.languages.registerHoverProvider(documentFilter, new ZsHoverProvider(repo)));
		context.subscriptions.push(vscode.languages.registerCompletionItemProvider(documentFilter, new ZsCompletionProvider(repo) ));
		context.subscriptions.push(vscode.languages.registerDefinitionProvider(documentFilter, new ZsDefinitionProvider(repo)) )
		context.subscriptions.push(vscode.languages.registerHoverProvider(documentFilter, new ZsHoverProvider(repo)) )
		context.subscriptions.push(new ZsDocumentMonitor(repo, context))
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
