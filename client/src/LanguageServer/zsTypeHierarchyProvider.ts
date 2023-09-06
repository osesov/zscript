import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/lang/zsRepository';
import { Logger, logSystem } from '../../../zslib/src/util/logger';
import { fromVscode, toVscode } from '../../../zslib/src/util/vscodeUtil';
import { getClassByName, getSupertypes, getInterfaceByName, getScopeContext, getDirectSupertypes, getDirectSubtypes } from '../../../zslib/src/lang/InterUnitInfo';
import { ClassInfo, ContextTag, InterfaceInfo, NamedType } from '../../../zslib/src/lang/UnitInfo';

export class ZsTypeHierarchyProvider implements vscode.TypeHierarchyProvider
{
    private repo: ZsRepository
    private logger: Logger

    constructor(repo: ZsRepository)
    {
        this.repo = repo;
        this.logger = logSystem.getLogger(ZsTypeHierarchyProvider)
    }

    private static add(result: vscode.TypeHierarchyItem[], entity: ClassInfo | InterfaceInfo): void
    {
        switch(entity.context) {
            case ContextTag.CLASS:
                result.push( new vscode.TypeHierarchyItem(
                    vscode.SymbolKind.Class,
                    entity.name,
                    '',
                    vscode.Uri.file(entity.unit.fileName),
                    toVscode.range(entity.begin, entity.end),
                    toVscode.range(entity.begin, entity.end) // TODO: support selectionRange
                ));
                break

            case ContextTag.INTERFACE:
                result.push( new vscode.TypeHierarchyItem(
                    vscode.SymbolKind.Interface,
                    entity.name,
                    '',
                    vscode.Uri.file(entity.unit.fileName),
                    toVscode.range(entity.begin, entity.end),
                    toVscode.range(entity.begin, entity.end) // TODO: support selectionRange
                ));
                break
        }
    }

    async prepareTypeHierarchy(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.TypeHierarchyItem | vscode.TypeHierarchyItem[] | undefined> {
        const result: vscode.TypeHierarchyItem[] = []

        const includes = await this.repo.getIncludeQueue(document.fileName);
        const main = includes[0]
        const currentScope: NamedType[] = main.getContext(fromVscode.position(position))
        for (const it of currentScope) {
            switch(it.context) {
            case ContextTag.CLASS:
            case ContextTag.INTERFACE:
                ZsTypeHierarchyProvider.add(result, it)
                break
            }
        }
        if (result.length === 0)
            return undefined;
        return result;
    }

    async provideTypeHierarchySupertypes(item: vscode.TypeHierarchyItem, token: vscode.CancellationToken): Promise<vscode.TypeHierarchyItem[] | undefined> {
        const result: vscode.TypeHierarchyItem[] = []
        const includes = await this.repo.getIncludeQueue(item.uri.fsPath);
        const name = item.name;
        const entity = getClassByName(includes, name) ?? getInterfaceByName(includes, name);

        if (!entity) {
            return undefined;
        }

        getDirectSupertypes(includes, entity).forEach( e => {
            ZsTypeHierarchyProvider.add(result, e)
        })

        if (result.length === 0)
            return undefined;
        return result;
    }

    async provideTypeHierarchySubtypes(item: vscode.TypeHierarchyItem, token: vscode.CancellationToken): Promise<vscode.TypeHierarchyItem[] | undefined> {
        const result: vscode.TypeHierarchyItem[] = []

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: "INDEX",
            cancellable: true
        }, async (progress, token) => {
            await this.repo.indexAllFiles((fileName: string, index: number, total: number) => {
                const shortFileName = this.repo.stripPathPrefix(fileName)
                progress.report({ message: `[${index}/${total}] ` + shortFileName})
                return token.isCancellationRequested
            });
        })

        if (token.isCancellationRequested)
            return undefined

        const includes = await this.repo.getAllUnits();
        const name = item.name;
        const entity = getClassByName(includes, name) ?? getInterfaceByName(includes, name);

        if (!entity) {
            return undefined;
        }

        getDirectSubtypes(includes, entity).forEach( e => {
            ZsTypeHierarchyProvider.add(result, e)
        })

        if (result.length === 0)
            return undefined;
        return result;
    }

}
