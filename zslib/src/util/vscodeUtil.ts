/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode'
import * as fs from 'fs'
import { Position } from '../lang/UnitInfo'
import { LogEvent, LogLevel, LogMessageTemplate, LogSink, logSystem } from './logger';
import { Word } from './util';
import { DocumentText } from '../lang/zsRepository';

export namespace fromVscode
{
    export function position(position: vscode.Position): Position
    {
        return {
            line: position.line + 1,
            column: position.character + 1
        }
    }

    export async function getDocumentText(fileName: string): Promise<DocumentText>
    {
        const mtime = async () => await fs.promises.stat(fileName).then(e=>e.mtimeMs).catch(() => 0)

        for (const it of vscode.workspace.textDocuments) {
            if (it.uri.fsPath === fileName) {
                const result: DocumentText = {
                    text: it.getText(),
                    mtime: it.isUntitled || it.isDirty ? 0 : await mtime()
                }
                return result
            }
        }

        const result: DocumentText = {
            text: await fs.promises.readFile(fileName, 'utf-8'),
            mtime: await mtime()
        }

        return result
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

    export function getWordsAtCursor(document: vscode.TextDocument, position: vscode.Position, prefix ?:boolean): string[]
    {
        const wordRange = document.getWordRangeAtPosition(position, /[_a-zA-Z][_a-zA-Z0-9]*([.][_a-zA-Z][_a-zA-Z0-9]*)*/);

        if (!wordRange)
            return []

        let word = document.getText(wordRange);
        const offset = position.character - wordRange.start.character;
        if (prefix) {
            word = word.substring(0, offset);
        }
        else {
            const dotPosition = word.indexOf('.', offset)
            if (dotPosition >= 0)
                word = word.substring(0, dotPosition);
        }

        return word.split('.')
    }

    export function getLineAtCursor(document: vscode.TextDocument, position: vscode.Position): string | undefined
    {
        return document.lineAt(position.line).text
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

    export function location(fileName: string, begin: Position, end: Position): vscode.Location
    {
        return new vscode.Location(vscode.Uri.file(fileName), range(begin, end));
    }
}

export class VSCodeSink implements LogSink
{
    private outputChannel: vscode.LogOutputChannel
    private template : LogMessageTemplate

    private methods = new Map<LogLevel, (...args: any[]) => void>

    constructor(outputChannel: vscode.LogOutputChannel, template ?: string)
    {
        this.outputChannel = outputChannel
        this.template = logSystem.parseLogTemplate(template ?? "%n: %m")

        this.methods = new Map<LogLevel, (...args: any[]) => void>(
            [
                [LogLevel.OUTPUT, this.outputChannel.appendLine],
                [LogLevel.FATAL, this.outputChannel.error],
                [LogLevel.ERROR, this.outputChannel.error],
                [LogLevel.WARN, this.outputChannel.warn],
                [LogLevel.INFO, this.outputChannel.info],
                // [LogLevel.DEBUG, this.outputChannel.info],
                [LogLevel.DEBUG, this.outputChannel.debug],
            ]
        )
    }

    write(event: LogEvent): void {
        const str = logSystem.renderEvent(event, this.template);
        // this.outputChannel.appendLine(str);
        const method = (this.methods.get(event.level) ?? this.outputChannel.info).bind(this.outputChannel)
        method(str, ...event.properties._ ?? []);
    }
}
