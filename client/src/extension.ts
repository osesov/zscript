'use strict';

import * as vscode from 'vscode';
import { window as Window } from 'vscode';
import { FileAccessor } from './Debugger/ZsDebugAdapter';
import { zsDebugInit } from './Debugger/ZsDebugExtension';
import { zsLanguageService } from './LanguageServer/zsLanguageService';
import { VscodeLogger } from './VscodeLogger';
import { languageId } from './common';

function pathToUri(path: string) {
	try {
		return vscode.Uri.file(path);
	} catch (e) {
		return vscode.Uri.parse(path);
	}
}

export const workspaceFileAccessor: FileAccessor = {
	isWindows: false,
	async readFile(path: string): Promise<Uint8Array> {
		let uri: vscode.Uri;
		try {
			uri = pathToUri(path);
		} catch (e) {
			return new TextEncoder().encode(`cannot read '${path}'`);
		}

		return await vscode.workspace.fs.readFile(uri);
	},
	async writeFile(path: string, contents: Uint8Array) {
		await vscode.workspace.fs.writeFile(pathToUri(path), contents);
	}
};


export function activate(context: vscode.ExtensionContext)
{
	const outputChannel: vscode.OutputChannel = Window.createOutputChannel('Zodiac Script', languageId);
	const logger = new VscodeLogger(outputChannel)

    context.subscriptions.push(vscode.commands.registerCommand('extension.zscript.getProgramName', config => {
		return vscode.window.showInputBox({
			placeHolder: "Please enter the name of a file in the workspace folder",
			value: "main.zs"
		});
	}));

	context.subscriptions.push(outputChannel);

	zsDebugInit(context, workspaceFileAccessor);
	zsLanguageService.start(context, logger);
}

export function deactivate() : Thenable<void> | undefined
{
	// nothing to do
	return zsLanguageService.stop();
}
