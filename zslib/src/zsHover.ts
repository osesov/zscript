import { ZsRepository } from "./zsRepository";
import { ClassInfo, ClassMethodInfo, ClassMethodVariable, ClassVariable, ContextTag, DefineInfo, GlobalFunction, GlobalFunctionVariable, GlobalVariable, InterfaceInfo, InterfaceMethod, InterfaceProperty, MethodArgument, Position, UnitInfo } from "./lang";
import { CancellationToken } from "./util";

export interface ZsHoverSink
{
    setArgument(info: MethodArgument): void

    setDefine(info: DefineInfo[]): void
    setClass(info: ClassInfo): void
    setClassMethod(info: ClassMethodInfo): void
    setClassVariable(info: ClassVariable): void
    setClassMethodVariable(info: ClassMethodVariable): void

    setGlobalVariable(info: GlobalVariable): void
    setGlobalFunction(info: GlobalFunction): void
    setGlobalFunctionVariable(info: GlobalFunctionVariable): void

    setInterface(info: InterfaceInfo): void
    setInterfaceMethod(info: InterfaceMethod): void
    setInterfaceProperty(info: InterfaceProperty): void
}

export class ZsHover
{
    constructor(private repo: ZsRepository)
    {
    }

    async getHover(result: ZsHoverSink, fileName: string, word: string, position: Position, _token: CancellationToken): Promise<void>
    {
        const includes = await this.repo.getIncludeQueue(fileName)
        if (includes.length === 0)
            return

        const main: UnitInfo = includes[0]
        const context = main.getContext(position).reverse()
        const seenClass = new Set<ClassInfo>
        const seenInterface = new Set<InterfaceInfo>

        const checkMethod = (ctx: ClassMethodInfo): boolean => {
            if (ctx.name === word) {
                result.setClassMethod(ctx)
                return true;
            }

            const variable = ctx.variables.find(e => e.name === word);
            if (variable) {
                result.setClassMethodVariable(variable)
                return true;
            }

            const arg = ctx.args.find(e => e.name === word)
            if (arg) {
                result.setArgument(arg);
                return true;
            }

            return false
        }

        const checkFunction = (ctx: GlobalFunction): boolean => {
            if (ctx.name === word) {
                result.setGlobalFunction(ctx)
                return true
            }

            const variable = ctx.variables.find(e => e.name === word);
            if (variable) {
                result.setGlobalFunctionVariable(variable)
                return true
            }

            const arg = ctx.args.find(e => e.name === word)
            if (arg) {
                result.setArgument(arg);
                return true
            }
            return false
        }

        const checkInterface = (ctx: InterfaceInfo): boolean => {
            if (seenInterface.has(ctx))
                return false
            seenInterface.add(ctx)

            if (ctx.name === word) {
                result.setInterface(ctx)
                return true
            }

            const readProp = ctx.readProp.find(e => e.name === word);
            if (readProp) {
                result.setInterfaceProperty(readProp);
                return true
            }

            const writeProp = ctx.writeProp.find(e => e.name === word);
            if (writeProp) {
                result.setInterfaceProperty(writeProp);
                return true
            }

            const method = ctx.methods.find( e => e.name === word)
            if (method) {
                result.setInterfaceMethod(method)
                return true
            }

            for (const it of ctx.inherit) {
                const ifInfo = this.repo.getInterfaceByName(includes, it)
                if (ifInfo && checkInterface(ifInfo))
                    return true;
            }

            return false;
        }

        const checkClass = (ctx: ClassInfo): boolean => {
            if (seenClass.has(ctx))
                return false
            seenClass.add(ctx)

            if (ctx.name === word) {
                result.setClass(ctx)
                return true
            }

            const variable = ctx.variables.find(e => e.name === word);
            if (variable) {
                result.setClassVariable(variable);
                return true
            }

            const method = ctx.methods.find( e => e.name === word)
            if (method) {
                result.setClassMethod(method)
                return true
            }

            for (const it of ctx.extends) {
                const classInfo = this.repo.getClassByName(includes, it)
                if (classInfo && checkClass(classInfo))
                    return true;
            }

            for (const it of ctx.implements) {
                const ifInfo = this.repo.getInterfaceByName(includes, it)
                if (ifInfo && checkInterface(ifInfo))
                    return true;
            }

            return false;
        }

        for (const ctx of context) {
            switch(ctx.context) {
            case ContextTag.METHOD:
                if (checkMethod(ctx))
                    return
                break;

            case ContextTag.FUNCTION:
                if (checkFunction(ctx))
                    return
                break;

            case ContextTag.CLASS:
                if (checkClass(ctx))
                    return;
                break;

            case ContextTag.INTERFACE:
                if (checkInterface(ctx))
                    return
                break
            }
        }

        const defineInfo = this.repo.getDefinesByName(includes, word);
        if (defineInfo && defineInfo.length > 0) {
            result.setDefine(defineInfo);
            return;
        }

        const classInfo = this.repo.getClassByName(includes, word);
        if (classInfo) {
            result.setClass(classInfo);
            return
        }

        const interfaceInfo = this.repo.getInterfaceByName(includes, word);
        if (interfaceInfo) {
            result.setInterface(interfaceInfo)
            return;
        }

        const globalFunctionInfo = this.repo.getGlobalFunctionByName(includes, word);
        if (globalFunctionInfo) {
            result.setGlobalFunction(globalFunctionInfo)
            return;
        }

        const globalVariableInfo = this.repo.getGlobalVariableByName(includes, word);
        if (globalVariableInfo) {
            result.setGlobalVariable(globalVariableInfo)
            return;
        }


    }
}
