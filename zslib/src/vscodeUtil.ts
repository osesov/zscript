import * as vscode from 'vscode'
import * as fs from 'fs'
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

    export async function getDocumentText(fileName: string): Promise<string>
    {
        for (const it of vscode.workspace.textDocuments) {
            if (it.uri.fsPath === fileName)
                return it.getText();
        }

        return fs.promises.readFile(fileName, 'utf-8')
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
