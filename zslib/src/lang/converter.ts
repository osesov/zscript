import { ClassInfo, ClassMethod, LocalVariable, ClassVariable, GlobalFunction, GlobalFunctionVariable, InterfaceInfo, InterfaceMethod, InterfaceProperty, SpanType, UnitInfo, UnitInfoData } from "./UnitInfo"

export namespace json_converter
{

    export function classFromJson(data ?: UnitInfoData["classes"]): UnitInfoData["classes"]
    {
        if (!data)
            return {}

        const classes = Object.keys(data)
        const result: UnitInfoData["classes"] = {}

        for(const className of classes) {
            const classInfo = data[className]

            const newClassInfo : ClassInfo = {
                ...classInfo,

                methods: classInfo.methods.map( method => ({
                    ...method,
                    parent: classInfo,
                    variables: method.variables.map( variable => ({
                        ...variable,
                        parent: method
                    }))
                })),

                variables: classInfo.variables.map( variable => ({
                    ...variable,
                    parent: classInfo
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
            }

            return newInfo as LocalVariable
        }

        const methodToJson = (info: ClassMethod) : ClassMethod => {

            const newInfo: Partial<ClassMethod> = {
                ...info,
                parent: undefined,
                variables: info.variables.map( e => localToJson(e))
            }

            return newInfo as ClassMethod
        }

        const variableToJson = (info: ClassVariable) : ClassVariable => {

            const newInfo: Partial<ClassVariable> = {
                ...info,
                parent: undefined
            }

            return newInfo as ClassVariable
        }

        for(const className of classes) {
            const classInfo = data[className]

            const newClassInfo : ClassInfo = {
                ...classInfo,

                methods: classInfo.methods.map( e => methodToJson(e)),
                variables: classInfo.variables.map( e => variableToJson(e)),
            }

            result[className] = newClassInfo
        }

        return result;
    }

    export function interfaceFromJson(data ?: UnitInfoData["interfaces"]): UnitInfoData["interfaces"]
    {
        if (!data)
            return {}

        const interfaces = Object.keys(data)
        const result: UnitInfoData["interfaces"] = {}

        for(const interfaceName of interfaces) {
            const interfaceInfo = data[interfaceName]

            const newInterfaceInfo : InterfaceInfo = {
                ...interfaceInfo,

                methods: interfaceInfo.methods.map( method => ({
                    ...method,
                    parent: interfaceInfo
                })),

                readProp: interfaceInfo.readProp.map( property => ({
                    ...property,
                    parent: interfaceInfo
                })),
                writeProp: interfaceInfo.writeProp.map( property => ({
                    ...property,
                    parent: interfaceInfo
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
            }

            return newInfo as InterfaceMethod
        }

        const propertyToJson = (info: InterfaceProperty) : InterfaceProperty => {

            const newInfo: Partial<InterfaceProperty> = {
                ...info,
                parent: undefined
            }

            return newInfo as InterfaceProperty
        }

        for(const interfaceName of interfaces) {
            const interfaceInfo = data[interfaceName]

            const newInterfaceInfo : InterfaceInfo = {
                ...interfaceInfo,

                methods: interfaceInfo.methods.map( e => methodToJson(e)),
                readProp: interfaceInfo.readProp.map( e => propertyToJson(e)),
                writeProp: interfaceInfo.writeProp.map( e => propertyToJson(e)),
            }

            result[interfaceName] = newInterfaceInfo
        }

        return result;
    }

    export function functionFromJson(data ?: UnitInfoData["globalFunctions"]): UnitInfoData["globalFunctions"]
    {
        if (!data)
            return {}

        const functions = Object.keys(data)
        const result: UnitInfoData["globalFunctions"] = {}

        for(const functionName of functions) {
            const functionInfo = data[functionName]

            const newFunctionInfo : GlobalFunction = {
                ...functionInfo,

                variables: functionInfo.variables.map( variable => ({
                    ...variable,
                    parent: functionInfo
                })),
            }

            result[functionName] = newFunctionInfo
        }

        return result;
    }

    export function functionToJson(data ?: UnitInfoData["globalFunctions"]): UnitInfoData["globalFunctions"]
    {
        if (!data)
            return {}

        const classes = Object.keys(data)
        const result: UnitInfoData["globalFunctions"] = {}

        const variableToJson = (info: GlobalFunctionVariable) : GlobalFunctionVariable => {

            const newInfo: Partial<GlobalFunctionVariable> = {
                ...info,
                parent: undefined
            }

            return newInfo as GlobalFunctionVariable
        }

        for(const className of classes) {
            const classInfo = data[className]

            const newClassInfo : GlobalFunction = {
                ...classInfo,

                variables: classInfo.variables.map( e => variableToJson(e)),
            }

            result[className] = newClassInfo
        }

        return result;
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
