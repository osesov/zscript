import * as vscode from 'vscode'

import { CancellationToken, Definition, DefinitionProvider, LocationLink, TextDocument } from "vscode";
import { ZsRepository } from "../../../zslib/src/zsRepository";
import { Logger, logSystem } from "../../../zslib/src/logger";
import { getWordAtCursor } from "./util";
import { fromVscode, toVscode } from "../../../zslib/src/vscodeUtil";
import { DefinitionSink, ZsDefinitions } from "../../../zslib/src/zsDefinitions";
import { Position } from '../../../zslib/src/lang';

class ZsDefinitonSink implements DefinitionSink
{
    public items: vscode.DefinitionLink[] = []

    add(fileName: string, start: Position, end: Position): void {
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
        const fileName = document.uri.fsPath
        const word = getWordAtCursor(document, position)
        if (!word)
            return [];

        this.logger.info("Query definitions for {@word} in {file}", word, this.repo.stripPathPrefix(fileName));

        try {
            const result = new ZsDefinitonSink
            const unit = await this.repo.onDocumentAccess(document);
            if (!unit)
                return [];

            await this.provider.getDefinitions(result, fileName, word.word, fromVscode.position(position), token)
            this.logger.info(`Definitions for ${word.word} at ${word.offset}:
                ${result.items.map(e => e.targetUri.fsPath + ":" + e.targetRange.start.line)}`)

            return result.items;
        } catch(e: unknown) {
            this.logger.error("Error {@error}", e)
            throw e;
        }
    }
}
