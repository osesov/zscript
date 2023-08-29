import { it } from "node:test";
import { Argument, ClassInfo, LocalVariable, ClassVariable, ContextTag, DefineInfo, GlobalFunction, GlobalVariable, InterfaceInfo, InterfaceMethod, InterfaceProperty, Position, TypeInfo, UnitInfo, Include, ClassMethod, NamedType } from "./UnitInfo";

// Get inheritance list given a class or interface (both extends and implements)
export function getInheritance(includes: UnitInfo[], start: ClassInfo|InterfaceInfo): (ClassInfo|InterfaceInfo)[]
{
    const result: (ClassInfo|InterfaceInfo)[] = []
    const looking = new Set<string>
    const loaded = new Set<string>

    looking.add(start.name);

    while (looking.size > 0) {
        let somethingChanged = false

        for(const it of includes) {
            if (looking.size === 0)
                break;
            for (const name of looking) {
                const e = ((): (ClassInfo|InterfaceInfo|undefined) => it.interfaces[name] ?? it.classes[name])()
                if (!e)
                    break;
                result.push(e);
                looking.delete(name);
                loaded.add(name);
                somethingChanged = true

                switch (e.context) {
                case ContextTag.CLASS:
                    e.implements.forEach( p => loaded.has(p) || looking.add(p))
                    e.extends.forEach( p => loaded.has(p) || looking.add(p))
                    break

                case ContextTag.INTERFACE:
                    e.extends.forEach( p => loaded.has(p) || looking.add(p))
                    break
                }
            }
        }

        if (!somethingChanged)
            break;
    }
    return result;
}

export function getDefinesByName(includes: UnitInfo[], name: string): DefineInfo | undefined
{
    for (const it of includes) {
        if (name in it.defines)
            return it.defines[name]
    }

    return undefined
}

export function getClassByName(includes: UnitInfo[], className: string): ClassInfo | undefined
{
    for (const it of includes) {
        if (className in it.classes)
            return it.classes[className]
    }

    return undefined
}

export function getInterfaceByName(includes: UnitInfo[], ifName: string): InterfaceInfo | undefined
{
    for (const it of includes) {
        if (ifName in it.interfaces)
            return it.interfaces[ifName]
    }

    return undefined
}

export function getGlobalFunctionByName(includes: UnitInfo[], ifName: string): GlobalFunction | undefined
{
    for (const it of includes) {
        if (ifName in it.globalFunctions)
            return it.globalFunctions[ifName]
    }

    return undefined
}

export function getGlobalVariableByName(includes: UnitInfo[], ifName: string): GlobalVariable | undefined
{
    for (const it of includes) {
        if (ifName in it.globalVariables)
            return it.globalVariables[ifName]
    }

    return undefined
}

export type ScopeSymbolsTypes = Argument | LocalVariable
                                | InterfaceInfo | InterfaceMethod | InterfaceProperty
                                | ClassInfo | ClassMethod | ClassVariable | LocalVariable
                                | DefineInfo | GlobalFunction | GlobalVariable
                                | TypeInfo

export function *getScopeSymbols(includes: UnitInfo[], position: Position, predicate: (e: ScopeSymbolsTypes) => boolean): Generator<ScopeSymbolsTypes, unknown>
{
    if (includes.length === 0)
        return

    const main: UnitInfo = includes[0]
    const context = main.getContext(position).reverse()
    const seenClass = new Set<ClassInfo>
    const seenInterface = new Set<InterfaceInfo>

    const visitClassMethod = function* (ctx: ClassMethod): Generator<ClassMethod | Argument | LocalVariable> {
        if (predicate(ctx))
            yield ctx

        for (const it of ctx.variables.filter(predicate))
            yield it;

        for (const it of ctx.args.filter(predicate))
            yield it;
    }

    const visitGlobalFunction = function *(ctx: GlobalFunction): Generator<GlobalFunction | Argument | LocalVariable> {
        if (predicate(ctx))
            yield ctx

        for (const it of ctx.args.filter(predicate))
            yield it;

        for (const it of ctx.variables.filter(predicate))
            yield it
    }

    const visitInterface = function *(ctx: InterfaceInfo): Generator<InterfaceInfo | InterfaceProperty | InterfaceMethod> {
        if (seenInterface.has(ctx))
            return
        seenInterface.add(ctx)

        if (predicate(ctx))
            yield ctx

        for (const it of ctx.readProp.filter(predicate))
            yield it

        for (const it of ctx.writeProp.filter(predicate))
            yield it

        for (const it of ctx.methods)
            yield it

        for (const it of ctx.extends) {
            const ifInfo = getInterfaceByName(includes, it)
            if (ifInfo) {
                for (const p of visitInterface(ifInfo))
                    yield p
            }
        }
    }

    const visitClass = function *(ctx: ClassInfo): Generator<ClassInfo | ClassVariable | ClassMethod | InterfaceInfo | InterfaceProperty | InterfaceMethod> {
        if (seenClass.has(ctx))
            return
        seenClass.add(ctx)

        if (predicate(ctx))
            yield ctx

        for (const it of ctx.variables.filter(predicate))
            yield it;

        for (const it of ctx.methods.filter(predicate))
            yield it

        for (const it of ctx.extends) {
            const classInfo = getClassByName(includes, it)
            if (classInfo) {
                for (const it of visitClass(classInfo))
                    yield it
            }
        }

        for (const it of ctx.implements) {
            const ifInfo = getInterfaceByName(includes, it)
            if (ifInfo) {
                for (const it of visitInterface(ifInfo))
                    yield it
            }
        }
    }

    for (const ctx of context) {
        switch(ctx.context) {
        case ContextTag.CLASS_METHOD:
            for (const it of visitClassMethod(ctx))
                yield it
            break;

        case ContextTag.GLOBAL_FUNCTION:
            for (const it of visitGlobalFunction(ctx))
                yield it
            break;

        case ContextTag.CLASS:
            for (const it of visitClass(ctx))
                yield it
            break;

        case ContextTag.INTERFACE:
            for (const it of visitInterface(ctx))
                yield it
            break
        }
    }

    for (const unit of includes) {
        for (const it of Object.values(unit.defines).filter(predicate))
            yield it

        for (const it of Object.values(unit.classes).filter(predicate))
            yield it

        for (const it of Object.values(unit.interfaces).filter(predicate))
            yield it

        for (const it of Object.values(unit.globalFunctions).filter(predicate))
            yield it

        for (const it of Object.values(unit.globalVariables).filter(predicate))
            yield it

        for (const it of Object.values(unit.types).filter(predicate))
            yield it
    }
}


export interface Definition
{
    fileName: string
    begin: Position
    end: Position
}


export function * getScopeDefinitions(includes: UnitInfo[], position: Position, predicate: (e:NamedType) => boolean): Generator<Definition>
{

    function mk(unit: UnitInfo, item: NamedType): Definition
    {
        switch (item.context) {
        case ContextTag.DEFINE:
            return { fileName: unit.fileName, begin: item.definitions[0].begin, end: item.definitions[0].end }

        // case ContextTag.INCLUDE:
        //     return { fileName: unit.fileName, begin: item.position, end: item.position};

        default:
            return { fileName: unit.fileName, begin: item.begin, end: item.end }
        }
    }

    function * visitDefineDefinitions(unit: UnitInfo): Generator<Definition>
    {
        for (const it of Object.values(unit.defines).filter(predicate)) {
            yield mk(unit, it)
        }
    }

    function * visitTypeDefinitions(unit: UnitInfo): Generator<Definition>
    {
        for (const it of Object.values(unit.classes).filter(predicate)) {
            yield mk(unit, it);
        }

        for (const it of Object.values(unit.interfaces).filter(predicate)) {
            yield mk(unit, it);
        }

        for (const it of Object.values(unit.types).filter(predicate)) {
            yield mk(unit, it)
        }
    }

    function * visitGlobalsDefinitions(unit: UnitInfo): Generator<Definition>
    {
        for (const it of Object.values(unit.globalFunctions).filter(predicate)) {
            yield mk(unit, it)
        }

        for (const it of Object.values(unit.globalVariables).filter(predicate)) {
            yield mk(unit, it)
        }
    }

    function * visitClassDefinitions(unit: UnitInfo, classInfo: ClassInfo): Generator<Definition>
    {
        for (const it of classInfo.methods.filter(predicate)) {
            yield mk(unit, it)
        }

        for (const it of classInfo.variables.filter(predicate)) {
            yield mk(unit, it)
        }
    }

    function * visitInterfaceDefinitions(unit: UnitInfo, interfaceInfo: InterfaceInfo): Generator<Definition>
    {
        for (const it of interfaceInfo.methods.filter(predicate)) {
            yield mk(unit, it)
        }

        for (const it of interfaceInfo.readProp.filter(predicate)) {
            yield mk(unit, it)
        }

        for (const it of interfaceInfo.writeProp.filter(predicate)) {
            yield mk(unit, it)
        }
    }

    function * visitClassInheritance(unit: UnitInfo, info: ClassInfo|InterfaceInfo): Generator<Definition>
    {
        const inheritance = getInheritance(includes, info)

        for (const it of inheritance) {
            switch(it.context) {
            case ContextTag.CLASS:
                for (const e of visitClassDefinitions(unit, it))
                    yield e;
                break

            case ContextTag.INTERFACE:
                for (const e of visitInterfaceDefinitions(unit, it))
                    yield e;
                break;
            }
        }
    }

    function * visitFunctionOrMethodDefinitions(unit: UnitInfo, methodInfo: ClassMethod|GlobalFunction): Generator<Definition>
    {
        for (const it of methodInfo.args.filter(predicate)) {
            yield mk(unit, it);
        }

        for (const it of methodInfo.variables.filter(predicate)) {
            yield mk(unit, it)
        }
    }

    if (includes.length === 0)
        return;

    for (const unit of includes) {
        for (const it of visitDefineDefinitions(unit))
            yield it

        for (const it of visitTypeDefinitions(unit))
            yield it

        for (const it of visitGlobalsDefinitions(unit))
            yield it

    }

    const main = includes[0];
    const context = main.getContext(position);
    for (const it of context) {
        switch (it.context) {
                // default:
                //     assertUnreachable(it.context);

        case ContextTag.CLASS:
            for (const e of visitClassDefinitions(main, it))
                yield e;

            for (const e of visitClassInheritance(main, it))
                yield e;

            break;

        case ContextTag.INTERFACE:
            for (const e of visitInterfaceDefinitions(main, it))
                yield e;

            for (const e of visitClassInheritance(main, it))
                yield e;

            break;

        case ContextTag.CLASS_METHOD:
        case ContextTag.GLOBAL_FUNCTION:
            for (const e of visitFunctionOrMethodDefinitions(main, it))
                yield e;
        }
    }
}

export type SymbolType = InterfaceInfo | InterfaceMethod | InterfaceProperty
                                | ClassInfo | ClassMethod | ClassVariable | LocalVariable
                                | DefineInfo | GlobalFunction | GlobalVariable
                                | TypeInfo

interface SymbolLocation
{
    unit: UnitInfo
    symbol: SymbolType
}

export function * getUnitSymbols(includes: UnitInfo[], predicate: (e: NamedType) => boolean): Generator<SymbolLocation>
{
    if (includes.length === 0)
        return

    const seenClass = new Set<ClassInfo>
    const seenInterface = new Set<InterfaceInfo>

    function mk(unit: UnitInfo, symbol: SymbolType): SymbolLocation
    {
        return {unit, symbol}
    }

    const visitInterface = function *(unit: UnitInfo, ctx: InterfaceInfo): Generator<SymbolLocation> {
        if (seenInterface.has(ctx))
            return
        seenInterface.add(ctx)

        if (predicate(ctx))
            yield mk(unit, ctx)

        for (const it of ctx.readProp.filter(predicate))
            yield mk(unit, it)

        for (const it of ctx.writeProp.filter(predicate))
            yield mk(unit, it)

        for (const it of ctx.methods)
            yield mk(unit, it)

        for (const it of ctx.extends) {
            const ifInfo = getInterfaceByName(includes, it)
            if (ifInfo) {
                for (const p of visitInterface(unit, ifInfo))
                    yield p
            }
        }
    }

    const visitClass = function *(unit: UnitInfo, ctx: ClassInfo): Generator<SymbolLocation> {
        if (seenClass.has(ctx))
            return
        seenClass.add(ctx)

        if (predicate(ctx))
            yield mk(unit, ctx)

        for (const it of ctx.variables.filter(predicate))
            yield mk(unit, it);

        for (const it of ctx.methods.filter(predicate))
            yield mk(unit, it)

        for (const it of ctx.extends) {
            const classInfo = getClassByName(includes, it)
            if (classInfo) {
                for (const it of visitClass(unit, classInfo))
                    yield it
            }
        }

        for (const it of ctx.implements) {
            const ifInfo = getInterfaceByName(includes, it)
            if (ifInfo) {
                for (const it of visitInterface(unit, ifInfo))
                    yield it
            }
        }
    }

    for (const unit of includes) {
        for (const it of Object.values(unit.defines).filter(predicate))
            yield mk(unit, it)

        for (const it of Object.values(unit.classes).filter(predicate)) {
            for (const e of visitClass(unit, it))
                yield e;
        }

        for (const it of Object.values(unit.interfaces).filter(predicate)) {
            for (const e of visitInterface(unit, it))
                yield e;
        }

        for (const it of Object.values(unit.globalFunctions).filter(predicate))
            yield mk(unit, it)

        for (const it of Object.values(unit.globalVariables).filter(predicate))
            yield mk(unit, it)

        for (const it of Object.values(unit.types).filter(predicate))
            yield mk(unit, it)
    }
}
