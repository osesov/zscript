import * as vscode from 'vscode'

import { CancellationToken, Definition, DefinitionProvider, LocationLink, TextDocument } from "vscode";
import { ZsRepository } from "../../../zslib/src/lang/zsRepository";
import { Logger, logSystem } from "../../../zslib/src/util/logger";
import { fromVscode, toVscode } from "../../../zslib/src/util/vscodeUtil";
import { ZsDefinitionSink, ZsDefinitions } from "../../../zslib/src/services/zsDefinitions";
import { Position } from '../../../zslib/src/lang/UnitInfo';

class ZsDefinitionSinkImpl implements ZsDefinitionSink
{
    public items: vscode.DefinitionLink[] = []
    private seen = new Set<string>

    add(fileName: string, start: Position, end: Position): void {
        const key = `${fileName}:${start.line}:${start.column}..${end.line}:${end.column}`
        if (this.seen.has(key))
            return

        this.seen.add(key)
        this.items.push({
            targetUri: vscode.Uri.file(fileName),
            targetRange: toVscode.range(start, end)
        })
    }
}

export class ZsDefinitionProvider implements DefinitionProvider
{
    private repo: ZsRepository
    private logger: Logger
    private provider: ZsDefinitions

    constructor(repo: ZsRepository)
    {
        this.repo = repo;
        this.provider = new ZsDefinitions(repo)
        this.logger = logSystem.getLogger(ZsDefinitionProvider);
    }

    async provideDefinition(document: TextDocument, position: vscode.Position, token: CancellationToken): Promise<Definition | LocationLink[]> // ProviderResult<Definition | LocationLink[]>
    {
        const result = new ZsDefinitionSinkImpl
        const fileName = document.uri.fsPath
        const currentLine = fromVscode.getLineAtCursor(document, position);
        if (currentLine && this.provider.getLineDefinitions(result, fileName, position.line, currentLine)) {
            return result.items;
        }

        const words = fromVscode.getWordsAtCursor(document, position)
        if (words.length === 0)
            return [];

        this.logger.info("Query definitions for {@word} in {file}", words, this.repo.stripPathPrefix(fileName));

        try {
            const unit = await this.repo.onDocumentAccess(document);
            if (!unit)
                return [];

            await this.provider.getDefinitions(result, fileName, words, fromVscode.position(position), token)
            this.logger.info(`Definitions for ${words.join('.')}:
                ${result.items.map(e => e.targetUri.fsPath + ":" + e.targetRange.start.line)}`)

            return result.items;
        } catch(e: unknown) {
            this.logger.error("Error {@error}", e)
            throw e;
        }
    }
}
