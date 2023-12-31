import * as vscode from 'vscode';
import { CancellationToken, DebugConfiguration, ProviderResult, WorkspaceFolder } from 'vscode';
import { FileAccessor, ZsDebugAdapter } from './ZsDebugAdapter';
import { languageId } from '../common';

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
	constructor(private workspaceFileAccessor: FileAccessor, private diagnosticCollection: vscode.DiagnosticCollection)
	{

	}

	createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new ZsDebugAdapter(this.workspaceFileAccessor, _session.configuration, this.diagnosticCollection));
	}
}

class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): vscode.ProviderResult<DebugConfiguration> {

		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === languageId) {
				config.type = 'zs';
				config.name = 'zsDebug: attach';
				config.request = 'attach';
			}
		}

		// if (!config.program) {
		// 	return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
		// 		return undefined;	// abort launch
		// 	});
		// }

		return config;
	}
}

export function zsDebugInit(context: vscode.ExtensionContext, fileAccessor: FileAccessor)
{
	console.log("Activate zscript debugger");
    // register a configuration provider
	const provider = new DebugConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('zs', provider));

    // TODO: register a dynamic configuration provider?

	const diagnosticCollection = vscode.languages.createDiagnosticCollection(languageId);

    // register debug factory
    const factory : vscode.DebugAdapterDescriptorFactory = new InlineDebugAdapterFactory(fileAccessor, diagnosticCollection);
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('zs', factory));
    if (factory instanceof vscode.Disposable) {
		context.subscriptions.push(factory);
	}
}
