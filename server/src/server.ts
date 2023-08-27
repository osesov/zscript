/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind, CompletionItem, CompletionParams, DefinitionParams, Definition, DefinitionLink
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { ZsEnvironment, createRepository } from '../../zslib/src/lang/zsRepository'

// import { UnitInfo } from './lang';
import { ConsoleSink } from '../../zslib/src/util/logger';

// Creates the LSP connection
const connection = createConnection(ProposedFeatures.all);

// Create a manager for open text documents
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const includeDirs: string[] = []
const logger = new ConsoleSink
const config: ZsEnvironment = {
	includeDirs: [],
	stripPathPrefix: []
}
const repo = createRepository(config)

// The workspace folder this server is operating on
let workspaceFolder: string | null;


documents.onDidOpen((event) => {
	connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`);
	const text = event.document.getText()
	repo.onDocumentOpen(event.document)
	// repo.updateFileInfo(event.document.uri, text)
});

documents.onDidChangeContent((event) => {
	connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document changed: ${event.document.uri}`);
	const text = event.document.getText()
	// repo.updateFileInfo(event.document.uri, text)
})

documents.onDidClose((event) => {
	connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document closed: ${event.document.uri}`);
})

documents.listen(connection);

connection.onInitialize((params) => {
	workspaceFolder = params.rootUri;
	connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Started and initialize received`);
	return {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Incremental
			},
			completionProvider: {
			}
		}
	};
});

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
	const doc = documents.get('')
	return []
})

connection.onDefinition((params: DefinitionParams): DefinitionLink[] => {
	return []
})

connection.listen();
