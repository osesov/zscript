import { CancellationToken, Definition, DefinitionProvider, LocationLink, Position, TextDocument } from "vscode";
import { ZsRepository } from "../../../zslib/src/zsRepository";
import { Logger, logSystem } from "../../../zslib/src/logger";
import { getWordAtCursor } from "./util";
import { fromVscode } from "../../../zslib/src/vscodeUtil";

export class ZsDefinitionProvider implements DefinitionProvider
{
    private repo: ZsRepository
    private logger: Logger

    constructor(repo: ZsRepository)
    {
        this.repo = repo;
        this.logger = logSystem.getLogger(ZsDefinitionProvider);
    }

    async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Definition | LocationLink[]> // ProviderResult<Definition | LocationLink[]>
    {
        const fileName = document.uri.fsPath
        const word = getWordAtCursor(document, position)
        if (!word)
            return [];

        this.logger.info("Query definitions for {@word} in {file}", word, this.repo.stripPathPrefix(fileName));

        try {
            const unit = await this.repo.onDocumentAccess(document);
            if (!unit)
                return [];

            const result = await this.repo.getDefinitions(fileName, word.word, fromVscode.position(position), token)
            this.logger.info(`Definitions for ${word.word} at ${word.offset}:
                ${result.map(e => e.targetUri.fsPath + ":" + e.targetRange.start.line)}`)

            return result;
        } catch(e: unknown) {
            this.logger.error("Error {@error}", e)
            throw e;
        }
    }
}
