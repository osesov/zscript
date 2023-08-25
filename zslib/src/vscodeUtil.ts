import * as vscode from 'vscode'
import { Position } from './lang'


export namespace fromVscode
{
    export function position(position: vscode.Position): Position
    {
        return {
            line: position.line + 1,
            column: position.character + 1
        }
    }
}

export namespace toVscode
{
    export function range(begin: Position, end: Position): vscode.Range
    {
        return new vscode.Range(
            new vscode.Position(begin.line - 1, begin.column - 1),
            new vscode.Position(end.line - 1, end.column - 1)
        )
    }
}
