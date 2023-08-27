import { ClassInfo, ContextTag, DefineInfo, GlobalFunction, GlobalVariable, InterfaceInfo, UnitInfo } from "./UnitInfo";

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
                    e.inherit.forEach( p => loaded.has(p) || looking.add(p))
                    break
                }
            }
        }

        if (!somethingChanged)
            break;
    }
    return result;
}

export function getDefinesByName(includes: UnitInfo[], name: string): DefineInfo[] | undefined
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
