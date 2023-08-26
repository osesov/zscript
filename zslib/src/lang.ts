import { assertUnreachable } from "./util"
import { FileRange } from "./zscript-parse"

export enum ContextTag
{
    TOP_LEVEL,
    INTERFACE,
    CLASS,
    METHOD,
    FUNCTION
}

export interface Position
{
    line: number
    column: number // TAB is a single character
}

export type Type = string[]
export type DocBlock = string[]

export interface Include
{
    system: boolean
    position: Position
}

export interface NameAndType
{
    name: string
    type: Type
}

export interface ClassVariable extends NameAndType
{
    begin: Position
    end: Position
    docBlock: DocBlock
    parent: ClassInfo
}

export interface ClassMethodVariable extends NameAndType
{
    begin: Position
    end: Position
    docBlock: DocBlock
    parent: ClassMethodInfo
}

export interface GlobalFunctionVariable extends NameAndType
{
    begin: Position
    end: Position
    docBlock: DocBlock
    parent: GlobalFunction
}

export interface MethodArgument
{
    type: Type
    name: string
    begin: Position
    end: Position
}

export interface WithContext
{
    context: ContextTag
}

export interface ClassInfo extends WithContext
{
    context: ContextTag.CLASS
    name: string
    implements: string[]
    extends: string[]
    begin: Position
    end: Position
    methods: ClassMethodInfo[]
    variables: ClassVariable[]
    docBlock: DocBlock
}

export interface ClassMethodInfo extends WithContext, NameAndType
{
    context: ContextTag.METHOD
    begin: Position
    end: Position
    parent: ClassInfo
    visibility: string
    args: MethodArgument[]
    variables: ClassMethodVariable[]
    docBlock: DocBlock
}


export interface TypeInfo extends NameAndType
{
    begin: Position
    end: Position
    docBlock: DocBlock
}

export interface InterfaceMethod extends NameAndType
{
    begin: Position
    end: Position
    args: NameAndType[]
    docBlock: DocBlock
    parent: InterfaceInfo
}

export interface InterfaceProperty extends NameAndType
{
    begin: Position
    end: Position
    docBlock: DocBlock
    parent: InterfaceInfo
}

export interface InterfaceInfo extends WithContext
{
    context: ContextTag.INTERFACE
    name: string
    inherit: string[]
    begin: Position
    end: Position
    methods: InterfaceMethod[]
    readProp: InterfaceProperty[]
    writeProp: InterfaceProperty[]
    docBlock: DocBlock
}

export interface DefineInfo
{
    name: string
    begin: Position,
    end: Position,
    docBlock: DocBlock
}

export interface GlobalVariable extends NameAndType
{
    begin: Position
    end: Position
    docBlock: DocBlock
}

export interface GlobalFunction extends WithContext, NameAndType
{
    context: ContextTag.FUNCTION
    begin: Position
    end: Position
    args: MethodArgument[]
    variables: GlobalFunctionVariable[]
    docBlock: DocBlock
}

export type Span = ClassInfo | InterfaceInfo | ClassMethodInfo | GlobalFunction

export interface UnitInfoData
{
    readonly includes: { [fileName: string]: Include[] }
    readonly classes: { [className: string]: ClassInfo }
    readonly interfaces: { [ifName: string]: InterfaceInfo }
    readonly types: { [name: string]: TypeInfo }
    readonly defines: { [name: string]: DefineInfo[] }
    readonly globalVariables: { [name: string]: GlobalVariable }
    readonly globalFunctions: { [name: string]: GlobalFunction }
}

export class UnitInfo implements UnitInfoData
{
    public fileName: string

    public readonly includes: UnitInfoData["includes"]
    public readonly classes: UnitInfoData["classes"]
    public readonly interfaces: UnitInfoData["interfaces"]
    public readonly types: UnitInfoData["types"]
    public readonly defines: UnitInfoData["defines"]
    public readonly globalVariables: UnitInfoData["globalVariables"]
    public readonly globalFunctions: UnitInfoData["globalFunctions"]

    // list of spanning objects in order of begin position
    private span: Span[] = []

    // temporal state
    private stack: (Span)[] = []

    constructor(fileName: string, data ?: UnitInfoData)
    {
        this.fileName = fileName;
        this.includes = data?.includes ?? {}
        this.classes = UnitInfo.classFromJson(data?.classes)
        this.interfaces = UnitInfo.interfaceFromJson(data?.interfaces)
        this.types = data?.types ?? {}
        this.defines = data?.defines ?? {}
        this.globalVariables = data?.globalVariables ?? {}
        this.globalFunctions = UnitInfo.functionFromJson(data?.globalFunctions)
        this.span = this.computeSpan()
    }

    public toJSON(): UnitInfoData
    {
        return {
            includes: this.includes,
            defines: this.defines,
            classes: UnitInfo.classToJson(this.classes),
            interfaces: UnitInfo.interfaceToJson(this.interfaces),
            types: this.types,
            globalVariables: this.globalVariables,
            globalFunctions: UnitInfo.functionToJson(this.globalFunctions),
        }
    }

    private static classFromJson(data ?: UnitInfoData["classes"]): UnitInfoData["classes"]
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

    private static classToJson(data ?: UnitInfoData["classes"]): UnitInfoData["classes"]
    {
        if (!data)
            return {}

        const classes = Object.keys(data)
        const result: UnitInfoData["classes"] = {}

        const localToJson = (info: ClassMethodVariable) : ClassMethodVariable => {

            const newInfo: Partial<ClassMethodVariable> = {
                ...info,
                parent: undefined,
            }

            return newInfo as ClassMethodVariable
        }

        const methodToJson = (info: ClassMethodInfo) : ClassMethodInfo => {

            const newInfo: Partial<ClassMethodInfo> = {
                ...info,
                parent: undefined,
                variables: info.variables.map( e => localToJson(e))
            }

            return newInfo as ClassMethodInfo
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

    private static interfaceFromJson(data ?: UnitInfoData["interfaces"]): UnitInfoData["interfaces"]
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

    private static interfaceToJson(data ?: UnitInfoData["interfaces"]): UnitInfoData["interfaces"]
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

    private static functionFromJson(data ?: UnitInfoData["globalFunctions"]): UnitInfoData["globalFunctions"]
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

    private static functionToJson(data ?: UnitInfoData["globalFunctions"]): UnitInfoData["globalFunctions"]
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

    static fromJson(fileName: string, obj: UnitInfoData): UnitInfo
    {
        return new UnitInfo(fileName, obj)
    }

    private computeSpan(): Span[]
    {
        const result: Span[] = []

        for (const it of Object.values(this.classes)) {
            result.push(it)
            for (const m of it.methods) {
                result.push(m)
            }
        }
        for (const it of Object.values(this.interfaces)) {
            result.push(it)
        }

        for (const it of Object.values(this.globalFunctions)) {
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

    public addInclude(system: boolean, name: string, location: FileRange): void
    {
        if (!(name in this.includes)) {
            this.includes[name] = []
        }

        this.includes[name].push({
            system: system,
            position: location.start
        })
    }

    public beginClass(name: string, impl: string[], ext: [], location: FileRange, docBlock: DocBlock)
    {
        const classInfo: ClassInfo = {
            context: ContextTag.CLASS,
            name: name,
            implements: impl,
            extends: ext,
            begin: location.start,
            end: location.end,
            methods: [],
            variables: [],
            docBlock: docBlock
        }

        this.classes[name] = classInfo
        this.stack.push(classInfo)
        this.span.push(classInfo)
    }

    public beginInterface(name: string, inherit: string[], location: FileRange, docBlock: DocBlock)
    {
        const classInfo: InterfaceInfo = {
            context: ContextTag.INTERFACE,
            name: name,
            inherit: inherit,
            begin: location.start,
            end: location.end,
            methods: [],
            readProp: [],
            writeProp: [],
            docBlock: docBlock
        }

        this.interfaces[name] = classInfo
        this.stack.push(classInfo)
        this.span.push(classInfo)
    }

    public addInterfaceMethod(type: Type, name: string, args: [Type,string][], location: FileRange, docBlock: DocBlock)
    {
        const currentInterface = this.getCurrentInterface()

        const info : InterfaceMethod = {
            name: name,
            type: type,
            begin: location.start,
            end: location.end,
            args: args.map(e => ({ type: e[0], name: e[1]})),
            docBlock: docBlock,
            parent: currentInterface
        }
        currentInterface.methods.push(info)
    }

    public addReadProperty(type: Type, name: string, location: FileRange, docBlock: DocBlock)
    {
        const currentInterface = this.getCurrentInterface()

        const info : InterfaceProperty = {
            name: name,
            type: type,
            begin: location.start,
            end: location.end,
            docBlock: docBlock,
            parent: currentInterface
        }
        currentInterface.readProp.push(info)
    }

    public addWriteProperty(type: Type, name: string, location: FileRange, docBlock: DocBlock)
    {
        const currentInterface = this.getCurrentInterface()

        const info : InterfaceProperty = {
            name: name,
            type: type,
            begin: location.start,
            end: location.end,
            docBlock: docBlock,
            parent: currentInterface
        }
        currentInterface.writeProp.push(info)
    }


    public beginClassMethod(visibility: string, type: Type, name: string, args: [Type,string,FileRange][], location: FileRange, docBlock: DocBlock)
    {
        const currentClass: ClassInfo = this.getCurrentClass()
        const methodInfo: ClassMethodInfo = {
            context: ContextTag.METHOD,
            begin: location.start,
            end: location.end,
            name: name,
            type: type,
            visibility: visibility,
            args: args.map( e=> ({
                type: e[0],
                name: e[1],
                begin: e[2].start,
                end: e[2].end
            })),
            variables: [],
            docBlock: docBlock,
            parent: currentClass
        }

        currentClass.methods.push(methodInfo)
        this.stack.push(methodInfo)
        this.span.push(methodInfo)
    }

    public addMethodVariables(type: Type, names: [string, FileRange][], location: FileRange, docBlock: DocBlock)
    {
        const currentClass = this.getCurrentMethod(location)

        for (const [name, location] of names) {
            const info: ClassMethodVariable = {
                begin: location.start,
                end: location.end,
                name: name,
                type: type,
                docBlock: docBlock,
                parent: currentClass
            }

            currentClass.variables.push(info)
        }
    }

    public addFunctionVariables(type: Type, names: [string, FileRange][], location: FileRange, docBlock: DocBlock)
    {
        const currentFunction = this.getCurrentFunction(location)

        for (const [name, location] of names) {
            const info: GlobalFunctionVariable = {
                begin: location.start,
                end: location.end,
                name: name,
                type: type,
                docBlock: docBlock,
                parent: currentFunction
            }

            currentFunction.variables.push(info)
        }
    }

    public addClassVariable(type: Type, name: string, location: FileRange, docBlock: DocBlock)
    {
        const currentClass: ClassInfo = this.getCurrentClass()
        const info: ClassVariable = {
            begin: location.start,
            end: location.end,
            name: name,
            type: type,
            docBlock: docBlock,
            parent: currentClass
        }

        currentClass.variables.push(info)
    }

    public addGlobalVariable(type: Type, names: [string, FileRange][], location: FileRange, docBlock: DocBlock)
    {
        for (const [name, location] of names) {
            const info: GlobalVariable = {
                begin: location.start,
                end: location.end,
                name: name,
                type: type,
                docBlock: docBlock
            }

            this.globalVariables[name] = info
        }
    }

    public beginGlobalFunction(type: Type, name: string, args: [Type,string,FileRange][], location: FileRange, docBlock: DocBlock)
    {
        const methodInfo: GlobalFunction = {
            context: ContextTag.FUNCTION,
            begin: location.start,
            end: location.end,
            name: name,
            type: type,
            args: args.map( e=> ({
                type: e[0],
                name: e[1],
                begin: e[2].start,
                end: e[2].end
            })),
            variables: [],
            docBlock: docBlock
        }

        this.globalFunctions[name] = methodInfo
        this.stack.push(methodInfo)
        this.span.push(methodInfo)
    }

    public addDefine(name: string, location: FileRange, docBlock: DocBlock)
    {
        if (this.defines[name] === undefined)
            this.defines[name] = []
        this.defines[name].push({
            name: name,
            begin: location.start,
            end: location.end,
            docBlock: docBlock
        })
    }

    public addType(name: string, def: string, location: FileRange, docBlock: DocBlock): void
    {
        const typeInfo: TypeInfo = {
            name: name,
            type: [def],
            begin: location.start,
            end: location.end,
            docBlock: docBlock,
        }
        this.types[name] = typeInfo;
    }


    public end(location: FileRange): string
    {
        const top = this.stack[ this.stack.length - 1]
        if (!top)
            return ""
        this.stack.pop();
        top.end = location.end
        return top.name
    }

    public getCurrentContext(): ContextTag
    {
        const t = this.stack[ this.stack.length - 1];
        return t.context ?? ContextTag.TOP_LEVEL
    }

    public getCurrentClass(): ClassInfo
    {
        const t = this.stack[ this.stack.length - 1];

        if (t.context === ContextTag.CLASS)
            return t

        throw Error("No current class")
    }

    public getCurrentInterface(): InterfaceInfo
    {
        const t = this.stack[ this.stack.length - 1];

        if (t.context === ContextTag.INTERFACE)
            return t

        throw Error("No current interface")
    }

    public getCurrentMethod(location: FileRange): ClassMethodInfo
    {
        const t = this.stack[ this.stack.length - 1];

        if (t.context === ContextTag.METHOD)
            return t

        throw Error(`No current method: ${location.start.line}...${location.end.line}`)
    }

    public getCurrentFunction(location: FileRange): GlobalFunction
    {
        const t = this.stack[ this.stack.length - 1];

        if (t.context === ContextTag.FUNCTION)
            return t

        throw Error(`No current function: ${location.start.line}...${location.end.line}`)
    }

    public getContext(position: Position): Span[]
    {
        const result: Span[] = []

        const inRange = (position: Position, begin: Position, end: Position): boolean => {
            if (position.line < begin.line)
                return false

            if (position.line === begin.line && position.column < begin.column)
                return false

            if (position.line > end.line)
                return false;

            if (position.line === end.line && position.column > end.column)
                return false

            return true;
        };

        for (const it of this.span) {
            if (!inRange(position, it.begin, it.end))
                continue;

            result.push(it);
        }

        return result;
    }

}
