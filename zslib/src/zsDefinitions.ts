import { ClassInfo, ClassMethodInfo, ContextTag, GlobalFunction, InterfaceInfo, Position, UnitInfo } from "./lang";
import { CancellationToken } from "./util";
import { ZsRepository } from "./zsRepository";

export interface DefinitionSink
{
    add(fileName: string, start: Position, end: Position): void;
}

export class ZsDefinitions
{
    constructor(private repo: ZsRepository)
    {
    }

    public async getDefinitions(result: DefinitionSink, initialFileName: string, word: string, position: Position, token: CancellationToken): Promise<void>
    {
        const includes = await this.repo.getIncludeQueue(initialFileName)
        for (const unit of includes) {
            if (!unit)
                continue

            // TODO: this obtains 'type' definitions only
            this.getTypeDefinitions(result, unit.fileName, word, unit, token);
            this.getDefineDefinitions(result, unit.fileName, word, unit, token);
            this.getGlobalsDefinitions(result, unit.fileName, word, unit, token);

            const context = unit.getContext(position)
            for (const it of context) {
                switch (it.context) {
                // default:
                //     assertUnreachable(it.context);

                case ContextTag.CLASS:
                    await this.getClassDefinitions(result, unit.fileName, word, it, token);
                    await this.getInheritDefinitions(result, unit.fileName, word, it, token);
                    break;

                case ContextTag.METHOD:
                    await this.getClassMethodDefinitions(result, unit.fileName, word, it, token);
                    break;

                case ContextTag.FUNCTION:
                    await this.getGlobalFunctionDefinitions(result, unit.fileName, word, it, token);
                    break;

                case ContextTag.INTERFACE:
                    await this.getInheritDefinitions(result, unit.fileName, word, it, token);
                    break;
                }
            }
        }
    }

    ////
    private getTypeDefinitions(result: DefinitionSink, fileName: string, word: string, unit: UnitInfo, token: CancellationToken): void
    {
        for (const e of Object.values(unit.class)) {

            if (token.isCancellationRequested)
                break;

            if (e.name !== word)
                continue

            result.add(fileName, e.begin, e.end);
        }

        for (const e of Object.values(unit.interface)) {
            if (token.isCancellationRequested)
                break;

            if (e.name !== word)
                continue

            result.add(fileName, e.begin, e.end)
        }

        for (const e of Object.values(unit.types)) {
            if (token.isCancellationRequested)
                break;

            if (e.name !== word)
                continue
            result.add(fileName, e.begin, e.begin)
        }
    }

    private getDefineDefinitions(result: DefinitionSink, fileName: string, word: string, unit: UnitInfo, token: CancellationToken): void
    {
        for (const [key, defines] of Object.entries(unit.define)) {
            if (token.isCancellationRequested)
                break
            if (key !== word)
                continue

            for (const define of defines) {
                result.add(fileName, define.begin, define.end)
            }
        }
    }

    private getGlobalsDefinitions(result: DefinitionSink, fileName: string, word: string, unit: UnitInfo, token: CancellationToken): void
    {
        for (const [name, desc] of Object.entries(unit.globalFunctions)) {
            if (token.isCancellationRequested)
                break
            if (name !== word)
                continue
            result.add(fileName, desc.begin, desc.end)
        }

        for (const [name, desc] of Object.entries(unit.globalVariables)) {
            if (token.isCancellationRequested)
                break
            if (name !== word)
                continue
            result.add(fileName, desc.begin, desc.end)
        }
    }

    private getClassDefinitions(result: DefinitionSink, fileName: string, word: string, classInfo: ClassInfo, token: CancellationToken): void
    {
        for (const e of classInfo.methods) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.add(fileName, e.begin, e.end)
        }

        for (const e of classInfo.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.add(fileName, e.begin, e.end)
        }
    }

    private async getInheritDefinitions(result: DefinitionSink, fileName: string, word: string, classInfo: ClassInfo|InterfaceInfo, token: CancellationToken): Promise<void>
    {
        const inherit = await this.repo.getInheritance(classInfo, fileName)
        for (const e of inherit) {
            switch(e.context) {
            case ContextTag.CLASS:
                this.getClassDefinitions(result, fileName, word, e, token);
                break

            case ContextTag.INTERFACE:
                this.getInterfaceDefinitions(result, fileName, word, e, token);
                break;
            }
        }
    }

    private getInterfaceDefinitions(result: DefinitionSink, fileName: string, word: string, interfaceInfo: InterfaceInfo, token: CancellationToken): void
    {
        for (const e of interfaceInfo.methods) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.add(fileName, e.begin, e.end)
        }

        for (const e of interfaceInfo.readProp) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.add(fileName, e.begin, e.end)
        }

        for (const e of interfaceInfo.writeProp) {
            if (token.isCancellationRequested)
                break
            if (e.name === word)
                result.add(fileName, e.begin, e.end)
        }
    }

    private getClassMethodDefinitions(result: DefinitionSink, fileName: string, word: string, methodInfo: ClassMethodInfo, token: CancellationToken): void
    {
        for (const e of methodInfo.args) {
            if (token.isCancellationRequested)
                break
            if (e.name !== word)
                continue
            result.add(fileName, e.begin, e.end)
        }

        for (const e of methodInfo.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name !== word)
                continue
            result.add(fileName, e.begin, e.end)
        }
    }

    private getGlobalFunctionDefinitions(result: DefinitionSink, fileName: string, word: string, methodInfo: GlobalFunction, token: CancellationToken): void
    {
        for (const e of methodInfo.args) {
            if (token.isCancellationRequested)
                break
            if (e.name !== word)
                continue
            result.add(fileName, e.begin, e.end)
        }

        for (const e of methodInfo.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name !== word)
                continue
            result.add(fileName, e.begin, e.end)
        }
    }

}
