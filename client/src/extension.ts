'use strict';

import * as vscode from 'vscode';
import { window as Window } from 'vscode';
import { FileAccessor } from './Debugger/ZsDebugAdapter';
import { zsDebugInit } from './Debugger/ZsDebugExtension';
import { zsLanguageService } from './LanguageServer/zsLanguageService';
import { logSystem } from '../../zslib/src/util/logger';
import { VSCodeSink } from '../../zslib/src/util/vscodeUtil';

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
	const devMode = context.extensionMode === vscode.ExtensionMode.Development;

	console.log(`Activate zscript extension in ${devMode ? "dev" : "prd"} mode`)
	const outputChannel: vscode.LogOutputChannel = Window.createOutputChannel('Zodiac Script', { log: true });
	logSystem.addSink(new VSCodeSink(outputChannel))
	// logSystem.addSink(new ConsoleSink())
	// logSystem.setLevel(LogLevel.DEBUG)

	context.subscriptions.push(vscode.commands.registerCommand('extension.zscript.getProgramName', _config => {
		return vscode.window.showInputBox({
			placeHolder: "Please enter the name of a file in the workspace folder",
			value: "main.zs"
		});
	}));

	context.subscriptions.push(outputChannel);
	zsDebugInit(context, workspaceFileAccessor);
	zsLanguageService.start(context);
}

export function deactivate() : Thenable<void> | undefined
{
	// nothing to do
	return zsLanguageService.stop();
}
