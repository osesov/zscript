import * as vscode from 'vscode'

import { ZsRepository } from "../../../zslib/src/lang/zsRepository";
import { Logger, logSystem } from "../../../zslib/src/util/logger";
import { toVscode } from "../../../zslib/src/util/vscodeUtil";
import { ContextTag, NamedType, UnitInfo } from '../../../zslib/src/lang/UnitInfo';
import { getUnitSymbols } from '../../../zslib/src/lang/InterUnitInfo';

export abstract class ZsSymbolProvider
{
    protected repo: ZsRepository
    protected logger: Logger

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(repo: ZsRepository, logger: Logger)
    {
        this.repo = repo;
        this.logger = logger;
    }

    async getSymbols(units: UnitInfo[], token: vscode.CancellationToken, predicate: (e: NamedType) => boolean): Promise<vscode.SymbolInformation[]>
    {
        if (units.length === 0)
            return []

        // const includes = await this.repo.getIncludeQueue(document.uri.fsPath)
        const kinds = new Map<NamedType["context"], vscode.SymbolKind>(
            [
                [ContextTag.DEFINE, vscode.SymbolKind.Constant],
                [ContextTag.INTERFACE, vscode.SymbolKind.Class],
                [ContextTag.INTERFACE_METHOD, vscode.SymbolKind.Method],
                [ContextTag.INTERFACE_PROPERTY, vscode.SymbolKind.Property],
                [ContextTag.CLASS, vscode.SymbolKind.Class],
                [ContextTag.CLASS_METHOD, vscode.SymbolKind.Method],
                [ContextTag.CLASS_VARIABLE, vscode.SymbolKind.Field],
                [ContextTag.GLOBAL_FUNCTION, vscode.SymbolKind.Function],
                [ContextTag.GLOBAL_VARIABLE, vscode.SymbolKind.Variable],
                [ContextTag.TYPE, vscode.SymbolKind.Class],
            ]
        )
        const result : vscode.SymbolInformation[] = []

        function containerName(it: NamedType): string
        {
            switch(it.context) {
            case ContextTag.CLASS_METHOD:
            case ContextTag.CLASS_VARIABLE:
            case ContextTag.INTERFACE_METHOD:
            case ContextTag.INTERFACE_PROPERTY:
                return it.parent.name;
            }

            return ""
        }

        function getLocation(unit: UnitInfo, symbol: NamedType): vscode.Location
        {
            if (symbol.context === ContextTag.DEFINE)
                return toVscode.location(unit.fileName, symbol.definitions[0].begin, symbol.definitions[0].end)

            return toVscode.location(unit.fileName, symbol.begin, symbol.end)
        }

        for (const it of getUnitSymbols(units, predicate)) {
            const unit = it.unit
            const symbol = it.symbol;

            console.info(`process ${(symbol as any).parent?.name} ${symbol.name}`)
            const kind = kinds.get(symbol.context) ?? vscode.SymbolKind.Object
            const location = getLocation(unit, symbol);

            result.push( new vscode.SymbolInformation(symbol.name, kind, containerName(symbol), location))

            if (token.isCancellationRequested)
                break;
        }

        return result;
    }
}

export class ZsDocumentSymbolProvider extends ZsSymbolProvider implements vscode.DocumentSymbolProvider
{

    constructor(repo: ZsRepository)
    {
        super(repo, logSystem.getLogger(ZsDocumentSymbolProvider))
    }

    async getUnits(main: UnitInfo): Promise<UnitInfo[]> {
        return [main]
    }

    async provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]>
    {
        const unit = await this.repo.onDocumentAccess(document);
        if (!unit)
            return [];

        return this.getSymbols([unit], token, () => true)
    }
}

export class ZsWorkspaceSymbolProvider extends ZsSymbolProvider implements vscode.WorkspaceSymbolProvider
{
    constructor(repo: ZsRepository)
    {
        super(repo, logSystem.getLogger(ZsWorkspaceSymbolProvider))
    }

    // This should be Promise<vscode.SymbolInformation[]>, but there is some compiler issue
    // https://stackoverflow.com/questions/56505560/how-to-fix-ts2322-could-be-instantiated-with-a-different-subtype-of-constraint
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Promise<any>
    {
        const units = await this.repo.getAllUnits();
        return this.getSymbols(units, token, (e) => e.name.startsWith(query))
    }
}
