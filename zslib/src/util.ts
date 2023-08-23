import * as vscode from 'vscode'
import { Position } from './lang';

export function assertUnreachable(x: never): never {
    throw new Error("Didn't expect to get here");
}

export function vscodeRange(begin: Position, end: Position): vscode.Range
{
    return new vscode.Range(
        new vscode.Position(begin.line - 1, begin.column - 1),
        new vscode.Position(end.line - 1, end.column - 1)
    )
}
