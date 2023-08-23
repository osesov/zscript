import { CancellationToken, Definition, DefinitionProvider, LocationLink, Position, TextDocument } from "vscode";
import { ZsRepository } from "../../../zslib/src/zsRepository";
import { Logger } from "../../../zslib/src/logger";
import { getWordAtCursor } from "./util";

export class ZsDefinitionProvider implements DefinitionProvider
{
    private repo: ZsRepository
    private logger: Logger

    constructor(repo: ZsRepository, logger: Logger)
    {
        this.repo = repo;
        this.logger = logger
    }

    async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Definition | LocationLink[]> // ProviderResult<Definition | LocationLink[]>
    {
        const fileName = document.uri.fsPath
        const text = document.getText()

        const unit = await this.repo.onDocumentAccess(document);
        if (!unit)
            return [];

        const word = getWordAtCursor(document, position)
        if (!word)
            return [];

        const result = await this.repo.getDefinitions(fileName, word.word, token)
        this.logger.debug(`Definitions for ${word.word} at ${word.offset}:
            ${result.map(e => e.targetUri.fsPath + ":" + e.targetRange.start.line)}`)

        return result;
    }
}
