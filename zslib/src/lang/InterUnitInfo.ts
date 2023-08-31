import { it } from "node:test";
import { Argument, ClassInfo, LocalVariable, ClassVariable, ContextTag, DefineInfo, GlobalFunction, GlobalVariable, InterfaceInfo, InterfaceMethod, InterfaceProperty, Position, TypeInfo, UnitInfo, Include, ClassMethod, NamedType, EnumInfo, EnumValue, SpanType, Type } from "./UnitInfo";

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
                                | TypeInfo | EnumInfo | EnumValue

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

    const visitEnum = function * (ctx: EnumInfo): Generator<EnumInfo|EnumValue>
    {
        if (predicate(ctx))
            yield ctx

        for (const it of ctx.values.filter(predicate))
            yield it;
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

        for (const it of Object.values(unit.enums)) {
            for (const e of visitEnum(it))
                yield e
        }
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

        for (const it of Object.values(unit.enums)) {
            for (const e of visitEnum(unit, it)) {
                yield e
            }
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

    function * visitEnum(unit: UnitInfo, enumInfo: EnumInfo): Generator<Definition>
    {
        if (predicate(enumInfo))
            yield mk(unit, enumInfo)

        for (const it of enumInfo.values.filter(predicate)) {
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
                                | TypeInfo | EnumInfo | EnumValue

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

    const visitEnum = function *(unit: UnitInfo, ctx: EnumInfo): Generator<SymbolLocation> {

        if (predicate(ctx))
            yield mk(unit, ctx)

        for (const it of ctx.values.filter(predicate))
            yield mk(unit, it)
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

        for (const it of Object.values(unit.enums).filter(predicate)) {
            for (const e of visitEnum(unit, it))
                yield mk(unit, it)
        }

        for (const it of Object.values(unit.globalFunctions).filter(predicate))
            yield mk(unit, it)

        for (const it of Object.values(unit.globalVariables).filter(predicate))
            yield mk(unit, it)

        for (const it of Object.values(unit.types).filter(predicate))
            yield mk(unit, it)

    }
}

export function getScopeContext(includes: UnitInfo[], words: string[], position: Position, options?: { prefix: boolean } ): NamedType[]
{
    type Predicate = (e: NamedType) => boolean

    const main = includes[0]
    const currentScope: NamedType[] = main.getContext(position)
    options = options ?? {prefix: false}

    function findTypeBeName(type: Type): NamedType[]
    {
        const result = []
        const typeName = type[ type.length - 1];

        for (const unit of includes) {
            if (typeName in unit.classes)
                result.push(unit.classes[typeName]);

            if (typeName in unit.interfaces)
                result.push(unit.interfaces[typeName]);

            if (typeName in unit.enums)
                result.push(unit.enums[typeName]);
        }

        return result;
    }

    function findDefine(predicate: Predicate): NamedType[]
    {
        const result = []
        for (const unit of includes) {
            result.push( ... Object.values(unit.defines).filter(predicate))
        }
        return result;
    }

    function findSymbolInInterface(info: InterfaceInfo, predicate: Predicate): NamedType[]
    {
        const result = []

        result.push(... info.readProp.filter(predicate))
        result.push(... info.writeProp.filter(predicate))
        result.push(... info.methods.filter(predicate))

        for(const it in info.extends) {
            const next = getInterfaceByName(includes, it);
            if (next)
                result.push(... findSymbolInInterface(next, predicate));
        }
        return result;
    }

    function findSymbolInClass(info: ClassInfo, predicate: Predicate): NamedType[]
    {
        const result = []

        result.push(... info.variables.filter(predicate))
        result.push(... info.methods.filter(predicate))

        for(const it in info.extends) {
            const next = getClassByName(includes, it);
            if (next)
                result.push(... findSymbolInClass(next, predicate));
        }

        for(const it of info.implements) {
            const next = getInterfaceByName(includes, it);
            if (next)
                result.push(... findSymbolInInterface(next, predicate));
        }

        return result;
    }

    function findSymbolInFunction(info: GlobalFunction, predicate: Predicate): NamedType[]
    {
        const result = []

        result.push( ... info.variables.filter(predicate) );
        result.push( ... info.args.filter(predicate) );

        return result;
    }

    function findSymbolInMethod(info: ClassMethod, predicate: Predicate): NamedType[]
    {
        const result = []

        result.push( ... info.variables.filter(predicate) );
        result.push( ... info.args.filter(predicate) );
        result.push( ... findSymbolInClass(info.parent, predicate) );

        return result;
    }

    function findSymbolInEnum(info: EnumInfo, predicate: Predicate): NamedType[]
    {
        return info.values.filter( predicate )
    }

    /// Check intermediate scopes
    words.forEach((word, index, arr) => {
        const firstEntry = index === 0
        const lastEntry = index === arr.length - 1;

        const predicate = lastEntry && options?.prefix ? (e: NamedType) => e.name.startsWith(word) : (e: NamedType) => e.name === word
        const newScope = []

        currentScope.push( ... findDefine(predicate))
        if (firstEntry) {
            for (const unit of includes) {
                newScope.push( ... Object.values(unit.enums).filter(predicate));
                newScope.push( ... Object.values(unit.classes).filter(predicate));
                newScope.push( ... Object.values(unit.interfaces).filter(predicate));
                newScope.push( ... Object.values(unit.globalFunctions).filter(predicate));
                newScope.push( ... Object.values(unit.globalVariables).filter(predicate));
                newScope.push( ... Object.values(unit.defines).filter(predicate));
                newScope.push( ... Object.values(unit.types).filter(predicate));
            }
        }

        for (const it of currentScope) {
            // if (lastEntry) {
            //     newScope.push(it)
            //     continue
            // }

            switch(it.context) {
            case ContextTag.ARGUMENT:
            case ContextTag.CLASS_VARIABLE:
            case ContextTag.LOCAL_VARIABLE:
            case ContextTag.GLOBAL_VARIABLE:
            case ContextTag.INTERFACE_PROPERTY:
                currentScope.push( ... findTypeBeName(it.type) )
                // newScope.push( ... findTypeBeName(it.type));
                break;

            case ContextTag.CLASS:
                newScope.push( ...findSymbolInClass(it, predicate) );
                break;

            case ContextTag.CLASS_METHOD:
                if (firstEntry)
                    newScope.push( ...findSymbolInMethod(it, predicate) );
                break;

            case ContextTag.GLOBAL_FUNCTION:
                if (firstEntry)
                    newScope.push( ...findSymbolInFunction(it, predicate) );
                break;

            case ContextTag.INTERFACE:
                newScope.push( ...findSymbolInInterface(it, predicate) );
                break;

            case ContextTag.INTERFACE_METHOD: // nothing to advance (todo: check call)
            case ContextTag.DEFINE:
            case ContextTag.ENUM_VALUE:
            case ContextTag.TYPE: // TODO: this requires type parsing
                break;

            case ContextTag.ENUM:
                newScope.push( ... findSymbolInEnum(it, predicate));
                break;
            }
        }

        // remove duplicates
        currentScope.splice(0, currentScope.length, ...new Set(newScope).values())
    });

    return currentScope;
}
