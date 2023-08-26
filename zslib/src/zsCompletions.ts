import { ClassInfo, ClassMethodInfo, ContextTag, GlobalFunction, InterfaceInfo, Position, UnitInfo } from "./lang";
import { CancellationToken } from "./util";
import { ZsRepository } from "./zsRepository";
import {CompletionItem, CompletionItemKind} from 'vscode-languageclient/node'

export interface ZsCompletionSink
{
    add(label: string, kind: CompletionItemKind, options ?: CompletionItem): void;
}

export class ZsCompletions
{
    constructor(private repo: ZsRepository)
    {
    }

    public async getCompletions(result: ZsCompletionSink, fileName: string, prefix: string, position: Position, token: CancellationToken): Promise<void>
    {
        const includes = await this.repo.getIncludeQueue(fileName)
        let p: Position | undefined = position

        for (const unit of includes) {
            if (token.isCancellationRequested)
                break;

            if (!unit)
                continue;

            await this.getUnitCompletions(result, prefix, p, unit, token);
            p = undefined
        }
    }


    ////
    private getUnitCompletions(result: ZsCompletionSink, prefix: string, position: Position|undefined, unit: UnitInfo, token: CancellationToken): void
    {
        for (const e of Object.keys(unit.classes)) {
            if (token.isCancellationRequested)
                break
            if (e.startsWith(prefix))
                result.add(e, CompletionItemKind.Class)
        }

        for (const e of Object.keys(unit.interfaces)) {
            if (token.isCancellationRequested)
                break
            if (e.startsWith(prefix))
                result.add(e, CompletionItemKind.Interface)
        }

        for (const e of Object.keys(unit.defines)) {
            if (token.isCancellationRequested)
                break
            if (e.startsWith(prefix))
                result.add(e, CompletionItemKind.Constant)
        }

        for (const e of Object.keys(unit.types)) {
            if (token.isCancellationRequested)
                break
            if (e.startsWith(prefix))
                result.add(e, CompletionItemKind.Class)
        }

        for (const e of Object.keys(unit.globalFunctions)) {
            if (token.isCancellationRequested)
                break;
            if (e.startsWith(prefix))
                result.add(e, CompletionItemKind.Function)
        }

        for (const e of Object.keys(unit.globalVariables)) {
            if (token.isCancellationRequested)
                break;
            if (e.startsWith(prefix))
                result.add(e, CompletionItemKind.Variable)
        }

        if (!position)
            return;

        const context = unit.getContext(position)
        for (const it of context) {
            switch (it.context) {
            // default:
            //     assertUnreachable(it.context);

            case ContextTag.CLASS:
                this.getClassCompletions(result, prefix, it, token);
                break;

            case ContextTag.METHOD:
                this.getClassMethodCompletions(result, prefix, it, token);
                break;

            case ContextTag.FUNCTION:
                this.getFunctionCompletions(result, prefix, it, token);
                break;

            case ContextTag.INTERFACE:
                this.getInterfaceCompletions(result, prefix, it, token);
                break;
            }
        }
    }

    // todo: class/interface completions should take inheritance into account
    private getClassCompletions(result: ZsCompletionSink, prefix: string, classInfo: ClassInfo, token: CancellationToken): void
    {
        for (const e of classInfo.methods) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.add(e.name, CompletionItemKind.Method)
        }

        for (const e of classInfo.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.add(e.name, CompletionItemKind.Variable)
        }
    }

    private getInterfaceCompletions(result: ZsCompletionSink, prefix: string, info: InterfaceInfo, token: CancellationToken): void
    {
        for (const e of info.methods) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.add(e.name, CompletionItemKind.Method)
        }

        for (const e of info.readProp) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.add(e.name, CompletionItemKind.Variable)
        }

        for (const e of info.writeProp) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.add(e.name, CompletionItemKind.Variable)
        }
    }

    private getClassMethodCompletions(result: ZsCompletionSink, prefix: string, data: ClassMethodInfo, token: CancellationToken): void
    {
        for (const e of data.args) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.add(e.name, CompletionItemKind.Variable)
        }

        for (const e of data.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.add(e.name, CompletionItemKind.Variable)
        }
    }

    private getFunctionCompletions(result: ZsCompletionSink, prefix: string, data: GlobalFunction, token: CancellationToken): void
    {
        for (const e of data.args) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.add(e.name, CompletionItemKind.Variable)
        }

        for (const e of data.variables) {
            if (token.isCancellationRequested)
                break
            if (e.name.startsWith(prefix))
                result.add(e.name, CompletionItemKind.Variable)
        }
    }


}
