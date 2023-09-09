// rewritten version of https://github.com/DominicVonk/vscode-variables/tree/main

import * as vscode from 'vscode';
import * as process from 'process';
import * as path from 'path';

export default function variables(string: string, recursive: boolean = false) {
    const workspaces = vscode.workspace.workspaceFolders;
    const workspace = vscode.workspace.workspaceFolders?.length ? vscode.workspace.workspaceFolders[0] : null;
    const activeFile = vscode.window.activeTextEditor?.document;
    const absoluteFilePath = activeFile?.uri.fsPath
    string = string.replace(/\${workspaceFolder}/g, workspace?.uri.fsPath ?? "");
    string = string.replace(/\${workspaceFolderBasename}/g, workspace?.name ?? "");
    string = string.replace(/\${file}/g, absoluteFilePath ?? "");
    let activeWorkspace = workspace;
    let relativeFilePath = absoluteFilePath;
    for (const workspace of workspaces ?? []) {
        if (absoluteFilePath?.replace(workspace.uri.fsPath, '') !== absoluteFilePath) {
            activeWorkspace = workspace;
            relativeFilePath = absoluteFilePath?.replace(workspace.uri.fsPath, '').substr(path.sep.length);
            break;
        }
    }
    const parsedPath = path.parse(absoluteFilePath ?? "");
    string = string.replace(/\${fileWorkspaceFolder}/g, activeWorkspace?.uri.fsPath ?? "");
    string = string.replace(/\${relativeFile}/g, relativeFilePath ?? "");
    string = string.replace(/\${relativeFileDirname}/g, relativeFilePath?.substring(0, relativeFilePath.lastIndexOf(path.sep)) ?? "");
    string = string.replace(/\${fileBasename}/g, parsedPath.base);
    string = string.replace(/\${fileBasenameNoExtension}/g, parsedPath.name);
    string = string.replace(/\${fileExtname}/g, parsedPath.ext);
    string = string.replace(/\${fileDirname}/g, parsedPath.dir.substr(parsedPath.dir.lastIndexOf(path.sep) + 1));
    string = string.replace(/\${cwd}/g, parsedPath.dir);
    string = string.replace(/\${pathSeparator}/g, path.sep);
    if (vscode.window.activeTextEditor) {
        string = string.replace(/\${lineNumber}/g, String(vscode.window.activeTextEditor.selection.start.line + 1));
        string = string.replace(/\${selectedText}/g, vscode.window.activeTextEditor.document.getText(new vscode.Range(vscode.window.activeTextEditor.selection.start, vscode.window.activeTextEditor.selection.end)));
    }
    string = string.replace(/\${env:(.*?)}/g, function (variable) {
        return process.env[variable.match(/\${env:(.*?)}/)![1]] || '';
    });
    string = string.replace(/\${config:(.*?)}/g, function (variable) {
        return vscode.workspace.getConfiguration().get(variable.match(/\${config:(.*?)}/)![1], '');
    });

    if (recursive && string.match(/\${(workspaceFolder|workspaceFolderBasename|fileWorkspaceFolder|relativeFile|fileBasename|fileBasenameNoExtension|fileExtname|fileDirname|cwd|pathSeparator|lineNumber|selectedText|env:(.*?)|config:(.*?))}/)) {
        string = variables(string, recursive);
    }
    return string;
}
