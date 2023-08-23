import * as vscode from 'vscode'

export interface Word
{
    word: string
    prefix: string
    offset: number
}

export function getWordAtCursor(document: vscode.TextDocument, position: vscode.Position): Word | undefined
{
    const wordRange = document.getWordRangeAtPosition(position);

    if (!wordRange)
        return undefined

    const word = document.getText(wordRange);
    const offset = position.character - wordRange.start.character;
    const prefix = word.substring(0, offset)

    return {
        word, prefix, offset
    }
}
