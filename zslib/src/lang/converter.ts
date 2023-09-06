import { ClassInfo, ClassMethod, LocalVariable, ClassVariable, GlobalFunction, InterfaceInfo, InterfaceMethod, InterfaceProperty, SpanType, UnitInfo, UnitInfoData, EnumInfo, EnumValue, TypeInfo, DefineInfo, GlobalVariable, Argument } from "./UnitInfo"

export namespace json_converter
{

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function objectMap<U extends {[k: string]: any}, T extends {[k: string]: any}, K extends keyof (T|U)>(obj: T, fn: (value: T[K], key: K) => T[K]): U
    {
        return Object.fromEntries(
            Object.entries(obj).map(
                ([k, v], i) => [k, fn(v, k as K)]
            )
        ) as U
    }

    export function includeFromJson(unit: UnitInfo, data ?: UnitInfoData["includes"]): UnitInfoData["includes"]
    {
        return objectMap(data ?? {}, (e => e.map( el => ({
            ...el,
            unit: unit,
        }))) );
    }

    export function includeToJson(data: UnitInfoData["includes"]): UnitInfoData["includes"]
    {
        return objectMap(data ?? {}, (e => e.map( el => ({
            ...el,
            unit: undefined!,
        }))) );
    }

    export function classFromJson(unit: UnitInfo, data ?: UnitInfoData["classes"]): UnitInfoData["classes"]
    {
        if (!data)
            return {}

        const classes = Object.keys(data)
        const result: UnitInfoData["classes"] = {}

        for(const className of classes) {
            const classInfo = data[className]

            const newClassInfo : ClassInfo = {
                ...classInfo,
                unit: unit,

                methods: classInfo.methods.map( method => ({
                    ...method,
                    parent: classInfo,
                    variables: method.variables.map( variable => ({
                        ...variable,
                        parent: method,
                        unit: unit
                    }))
                })),

                variables: classInfo.variables.map( variable => ({
                    ...variable,
                    parent: classInfo,
                    unit: unit
                })),
            }

            result[className] = newClassInfo
        }

        return result;
    }

    export function classToJson(data ?: UnitInfoData["classes"]): UnitInfoData["classes"]
    {
        if (!data)
            return {}

        const classes = Object.keys(data)
        const result: UnitInfoData["classes"] = {}

        const localToJson = (info: LocalVariable) : LocalVariable => {

            const newInfo: Partial<LocalVariable> = {
                ...info,
                parent: undefined,
                unit: undefined,
            }

            return newInfo as LocalVariable
        }

        const methodToJson = (info: ClassMethod) : ClassMethod => {

            const newInfo: Partial<ClassMethod> = {
                ...info,
                parent: undefined,
                unit: undefined,
                variables: info.variables.map( e => localToJson(e)),
                args: info.args.map( e => argToJson(e))
            }

            return newInfo as ClassMethod
        }

        const variableToJson = (info: ClassVariable) : ClassVariable => {

            const newInfo: Partial<ClassVariable> = {
                ...info,
                parent: undefined,
                unit: undefined,
            }

            return newInfo as ClassVariable
        }

        for(const className of classes) {
            const classInfo = data[className]

            const newClassInfo : Partial<ClassInfo> = {
                ...classInfo,
                unit: undefined,

                methods: classInfo.methods.map( e => methodToJson(e)),
                variables: classInfo.variables.map( e => variableToJson(e)),
            }

            result[className] = newClassInfo as ClassInfo
        }

        return result;
    }

    export function interfaceFromJson(unit: UnitInfo, data ?: UnitInfoData["interfaces"]): UnitInfoData["interfaces"]
    {
        if (!data)
            return {}

        const interfaces = Object.keys(data)
        const result: UnitInfoData["interfaces"] = {}

        for(const interfaceName of interfaces) {
            const interfaceInfo = data[interfaceName]

            const newInterfaceInfo : InterfaceInfo = {
                ...interfaceInfo,

                unit: unit,

                methods: interfaceInfo.methods.map( method => ({
                    ...method,
                    parent: interfaceInfo,
                    unit: unit,
                })),

                readProp: interfaceInfo.readProp.map( property => ({
                    ...property,
                    parent: interfaceInfo,
                    unit: unit,
                })),

                writeProp: interfaceInfo.writeProp.map( property => ({
                    ...property,
                    parent: interfaceInfo,
                    unit: unit,
                })),
            }

            result[interfaceName] = newInterfaceInfo
        }

        return result;
    }

    export function interfaceToJson(data ?: UnitInfoData["interfaces"]): UnitInfoData["interfaces"]
    {
        if (!data)
            return {}

        const interfaces = Object.keys(data)
        const result: UnitInfoData["interfaces"] = {}

        const methodToJson = (info: InterfaceMethod) : InterfaceMethod => {

            const newInfo: Partial<InterfaceMethod> = {
                ...info,
                parent: undefined,
                unit: undefined,
            }

            return newInfo as InterfaceMethod
        }

        const propertyToJson = (info: InterfaceProperty) : InterfaceProperty => {

            const newInfo: Partial<InterfaceProperty> = {
                ...info,
                parent: undefined,
                unit: undefined,
            }

            return newInfo as InterfaceProperty
        }

        for(const interfaceName of interfaces) {
            const interfaceInfo = data[interfaceName]

            const newInterfaceInfo : Partial<InterfaceInfo> = {
                ...interfaceInfo,
                unit: undefined,

                methods: interfaceInfo.methods.map( e => methodToJson(e)),
                readProp: interfaceInfo.readProp.map( e => propertyToJson(e)),
                writeProp: interfaceInfo.writeProp.map( e => propertyToJson(e)),
            }

            result[interfaceName] = newInterfaceInfo as InterfaceInfo
        }

        return result;
    }

    export function functionFromJson(unit: UnitInfo, data ?: UnitInfoData["globalFunctions"]): UnitInfoData["globalFunctions"]
    {
        if (!data)
            return {}

        const functions = Object.keys(data)
        const result: UnitInfoData["globalFunctions"] = {}

        for(const functionName of functions) {
            const functionInfo = data[functionName]

            const newFunctionInfo : GlobalFunction = {
                ...functionInfo,
                unit: unit,

                variables: functionInfo.variables.map( variable => ({
                    ...variable,
                    parent: functionInfo,
                    unit: unit,
                })),
            }

            result[functionName] = newFunctionInfo
        }

        return result;
    }

    export function argToJson(info: Argument) : Argument
    {
        const newInfo: Partial<Argument> = {
            ...info,
            unit: undefined,
        }

        return newInfo as Argument
    }

    export function functionToJson(data ?: UnitInfoData["globalFunctions"]): UnitInfoData["globalFunctions"]
    {
        if (!data)
            return {}

        const functions = Object.keys(data)
        const result: UnitInfoData["globalFunctions"] = {}

        const variableToJson = (info: LocalVariable) : LocalVariable => {

            const newInfo: Partial<LocalVariable> = {
                ...info,
                parent: undefined,
                unit: undefined,
            }

            return newInfo as LocalVariable
        }


        for(const name of functions) {
            const info = data[name]

            const newInfo : Partial<GlobalFunction> = {
                ...info,

                unit: undefined,
                variables: info.variables.map( e => variableToJson(e)),
                args: info.args.map( e => argToJson(e))
            }

            result[name] = newInfo as GlobalFunction
        }

        return result;
    }

    export function enumFromJson(unit: UnitInfo, data ?: UnitInfoData["enums"]): UnitInfoData["enums"]
    {
        if (!data)
            return {}

        const enums = Object.keys(data)
        const result: UnitInfoData["enums"] = {}

        for(const enumName of enums) {
            const enumInfo = data[enumName]

            const newEnumInfo : EnumInfo = {
                ...enumInfo,
                unit: unit,

                values: enumInfo.values.map( value => ({
                    ...value,
                    parent: enumInfo,
                    unit: unit,
                })),
            }

            result[enumName] = newEnumInfo
        }

        return result;
    }

    export function enumToJson(data ?: UnitInfoData["enums"]): UnitInfoData["enums"]
    {
        if (!data)
            return {}

        const enums = Object.keys(data)
        const result: UnitInfoData["enums"] = {}

        const valueToJson = (info: EnumValue) : EnumValue => {

            const newInfo: Partial<EnumValue> = {
                ...info,
                parent: undefined,
                unit: undefined,
            }

            return newInfo as EnumValue
        }

        for(const enumName of enums) {
            const enumInfo = data[enumName]

            const newEnumInfo : Partial<EnumInfo> = {
                ...enumInfo,
                unit: undefined,

                values: enumInfo.values.map( e => valueToJson(e)),
            }

            result[enumName] = newEnumInfo as EnumInfo
        }

        return result;
    }

    export function typeFromJson(unit: UnitInfo, data ?: UnitInfoData["types"]): UnitInfoData["types"]
    {
        if (!data)
            return {}

        const items = Object.keys(data)
        const result: UnitInfoData["types"] = {}

        for(const itemName of items) {
            const itemInfo = data[itemName]

            const newItemInfo : TypeInfo = {
                ...itemInfo,
                unit: unit,
            }

            result[itemName] = newItemInfo
        }

        return result;
    }

    export function typeToJson(data ?: UnitInfoData["types"]): UnitInfoData["types"]
    {
        if (!data)
            return {}

        const items = Object.keys(data)
        const result: UnitInfoData["types"] = {}

        for(const itemName of items) {
            const itemInfo = data[itemName]

            const newItemInfo : Partial<TypeInfo> = {
                ...itemInfo,
                unit: undefined,
            }

            result[itemName] = newItemInfo as TypeInfo
        }

        return result;
    }

    export function defineFromJson(unit: UnitInfo, data ?: UnitInfoData["defines"]): UnitInfoData["defines"]
    {
        if (!data)
            return {}

        const items = Object.keys(data)
        const result: UnitInfoData["defines"] = {}

        for(const itemName of items) {
            const itemInfo = data[itemName]

            const newItemInfo : DefineInfo = {
                ...itemInfo,
                unit: unit,
            }

            result[itemName] = newItemInfo
        }

        return result;
    }

    export function defineToJson(data ?: UnitInfoData["defines"]): UnitInfoData["defines"]
    {
        if (!data)
            return {}

        const items = Object.keys(data)
        const result: UnitInfoData["defines"] = {}

        for(const itemName of items) {
            const itemInfo = data[itemName]

            const newItemInfo : Partial<DefineInfo> = {
                ...itemInfo,
                unit: undefined,
            }

            result[itemName] = newItemInfo as DefineInfo
        }

        return result;
    }

    export function globalVariableFromJson(unit: UnitInfo, data ?: UnitInfoData["globalVariables"]): UnitInfoData["globalVariables"]
    {
        if (!data)
            return {}

        const items = Object.keys(data)
        const result: UnitInfoData["globalVariables"] = {}

        for(const itemName of items) {
            const itemInfo = data[itemName]

            const newItemInfo : GlobalVariable = {
                ...itemInfo,
                unit: unit,
            }

            result[itemName] = newItemInfo
        }

        return result;
    }

    export function globalVariableToJson(data ?: UnitInfoData["globalVariables"]): UnitInfoData["globalVariables"]
    {
        if (!data)
            return {}

        const items = Object.keys(data)
        const result: UnitInfoData["globalVariables"] = {}

        for(const itemName of items) {
            const itemInfo = data[itemName]

            const newItemInfo : Partial<GlobalVariable> = {
                ...itemInfo,
                unit: undefined,
            }

            result[itemName] = newItemInfo as GlobalVariable
        }

        return result;
    }

    export function ignoreFromJson(unit: UnitInfo, data ?: UnitInfoData["ignores"]): UnitInfoData["ignores"]
    {
        return data ?? [];
    }

    export function ignoreToJson(data: UnitInfoData["ignores"]): UnitInfoData["ignores"]
    {
        return data;
    }

    export function computeSpan(unit: UnitInfo): SpanType[]
    {
        const result: SpanType[] = []

        for (const it of Object.values(unit.classes)) {
            result.push(it)
            for (const m of it.methods) {
                result.push(m)
            }
        }
        for (const it of Object.values(unit.interfaces)) {
            result.push(it)
        }

        for (const it of Object.values(unit.globalFunctions)) {
            result.push(it)
        }

        result.sort((lhs, rhs) => {
            if (lhs.begin.line < rhs.begin.line)
                return -1
            if (lhs.begin.line === rhs.begin.line && lhs.begin.column < rhs.begin.column)
                return -1

            if (lhs.begin.line > rhs.begin.line)
                return +1

            if (lhs.begin.line === rhs.begin.line && lhs.begin.column > rhs.begin.column)
                return +1

            return 0;
        })

        return result;
    }
}
