// INITIAL attempt to make full blown lst server. incomplete!

/* BASED on MS code:

/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'
import { workspace as Workspace, window as Window, ExtensionContext, OutputChannel } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { languageId } from '../common';

export namespace lsp {

	let client: LanguageClient;

	export function start(context: ExtensionContext) {
		// The server is implemented in node
		const serverModule = context.asAbsolutePath(
			path.join('out', 'zscript-lsp.js')
		);

		// If the extension is launched in debug mode then the debug server options are used
		// Otherwise the run options are used
		let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

		const serverOptions: ServerOptions = {
			run: {
				module: serverModule,
				transport: TransportKind.ipc },
			debug: {
				module: serverModule,
				transport: TransportKind.ipc,
				options: debugOptions
			}
		};

		// Options to control the language client
		const clientOptions: LanguageClientOptions = {
			// Register the server for plain text documents
			documentSelector: [{ scheme: 'file', language: languageId }],
			synchronize: {
				// Notify the server about file changes to zs files contained in the workspace
				fileEvents: Workspace.createFileSystemWatcher('**/*.zs')
			}
		};

		// Create the language client and start the client.
		client = new LanguageClient(
			'zScriptLanguage',
			'ZScript Language Server',
			serverOptions,
			clientOptions
		);

		// Start the client. This will also launch the server
		client.start();

		// const outputChannel = Window.createOutputChannel('ZSCRIPT' );
		// outputChannel.show(false)
		// outputChannel.appendLine("Some Text")
		// outputChannel.appendLine("Some Text2")
	}

	export function stop(): Thenable<void> | undefined {
		if (!client) {
			return undefined;
		}
		return client.stop();
	}

}
