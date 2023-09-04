import { assertUnreachable } from "../util/util"
import { json_converter } from "./converter"

export enum ContextTag
{
    INCLUDE,
    DEFINE,
    INTERFACE,
    INTERFACE_PROPERTY,
    INTERFACE_METHOD,
    CLASS,
    CLASS_VARIABLE,
    CLASS_METHOD,
    GLOBAL_FUNCTION,
    GLOBAL_VARIABLE,
    ARGUMENT,
    LOCAL_VARIABLE,
    TYPE,
    ENUM,
    ENUM_VALUE,
}

export interface Position
{
    line: number
    column: number // TAB is a single character
}

export type Type = string[]
export type DocBlock = string[]

export interface WithContext
{
    context: ContextTag
}

export interface NameAndType
{
    name: string
    type: Type
}

export interface Include extends WithContext
{
    context: ContextTag.INCLUDE
    unit: UnitInfo
    system: boolean
    position: Position
}

export interface ClassVariable extends NameAndType
{
    context: ContextTag.CLASS_VARIABLE
    unit: UnitInfo

    begin: Position
    end: Position
    docBlock: DocBlock
    parent: ClassInfo
    visibility: string
}

export interface LocalVariable extends WithContext, NameAndType
{
    context: ContextTag.LOCAL_VARIABLE
    unit: UnitInfo

    begin: Position
    end: Position
    docBlock: DocBlock
    parent: ClassMethod | GlobalFunction
}

export interface Argument extends WithContext
{
    context: ContextTag.ARGUMENT
    unit: UnitInfo

    type: Type
    name: string
    begin: Position
    end: Position
}

export interface ClassInfo extends WithContext
{
    context: ContextTag.CLASS
    unit: UnitInfo

    name: string
    implements: string[]
    extends: string[]
    begin: Position
    end: Position
    methods: ClassMethod[]
    variables: ClassVariable[]
    docBlock: DocBlock
}

export interface ClassMethod extends WithContext, NameAndType
{
    context: ContextTag.CLASS_METHOD
    unit: UnitInfo

    begin: Position
    end: Position
    parent: ClassInfo
    visibility: string
    args: Argument[]
    variables: LocalVariable[]
    docBlock: DocBlock
}


export interface TypeInfo extends WithContext, NameAndType
{
    context: ContextTag.TYPE
    unit: UnitInfo

    begin: Position
    end: Position
    docBlock: DocBlock
}

export interface InterfaceMethod extends NameAndType
{
    context: ContextTag.INTERFACE_METHOD
    unit: UnitInfo

    begin: Position
    end: Position
    args: NameAndType[]
    docBlock: DocBlock
    parent: InterfaceInfo
}

export interface InterfaceProperty extends NameAndType
{
    context: ContextTag.INTERFACE_PROPERTY
    unit: UnitInfo

    begin: Position
    end: Position
    docBlock: DocBlock
    parent: InterfaceInfo
}

export interface InterfaceInfo extends WithContext
{
    context: ContextTag.INTERFACE
    unit: UnitInfo

    name: string
    extends: string[]
    begin: Position
    end: Position
    methods: InterfaceMethod[]
    readProp: InterfaceProperty[]
    writeProp: InterfaceProperty[]
    docBlock: DocBlock
}

export interface DefineInfo
{
    context: ContextTag.DEFINE
    unit: UnitInfo

    name: string
    definitions: {
        begin: Position,
        end: Position,
        docBlock: DocBlock
    }[]
}

export interface GlobalVariable extends NameAndType
{
    context: ContextTag.GLOBAL_VARIABLE
    unit: UnitInfo

    begin: Position
    end: Position
    docBlock: DocBlock
}

export interface GlobalFunction extends WithContext, NameAndType
{
    context: ContextTag.GLOBAL_FUNCTION
    unit: UnitInfo

    begin: Position
    end: Position
    args: Argument[]
    variables: LocalVariable[]
    docBlock: DocBlock
}

export interface EnumValue extends WithContext
{
    context: ContextTag.ENUM_VALUE
    unit: UnitInfo

    name: string
    value?: number
    parent: EnumInfo
    begin: Position
    end: Position
    docBlock: DocBlock
}

export interface EnumInfo extends WithContext
{
    context: ContextTag.ENUM
    unit: UnitInfo

    name: string
    begin: Position
    end: Position
    values: EnumValue[]
    docBlock: DocBlock
}

export type SpanType = ClassInfo | InterfaceInfo | ClassMethod | GlobalFunction
export type NamedType = Argument | LocalVariable
                                | InterfaceInfo | InterfaceMethod | InterfaceProperty
                                | ClassInfo | ClassMethod | ClassVariable | LocalVariable
                                | DefineInfo | GlobalFunction | GlobalVariable
                                | TypeInfo | EnumInfo | EnumValue


interface PositionEx extends Position
{
    offset: number
}

export interface IgnoreStatement
{
    position: PositionEx
    text: string
}

export type IgnoreList = IgnoreStatement[]

export interface UnitInfoData
{
    readonly includes: { [fileName: string]: Include[] }
    readonly classes: { [className: string]: ClassInfo }
    readonly interfaces: { [ifName: string]: InterfaceInfo }
    readonly types: { [name: string]: TypeInfo }
    readonly defines: { [name: string]: DefineInfo }
    readonly globalVariables: { [name: string]: GlobalVariable }
    readonly globalFunctions: { [name: string]: GlobalFunction }
    readonly enums: { [name: string]: EnumInfo }
    readonly ignores: IgnoreList
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
    public readonly enums: UnitInfoData["enums"]
    public readonly ignores: UnitInfoData["ignores"]

    // list of spanning objects in order of begin position
    protected span: SpanType[]

    constructor(fileName: string, data ?: UnitInfoData)
    {
        this.fileName = fileName;
        this.includes = json_converter.includeFromJson(this, data?.includes)
        this.classes = json_converter.classFromJson(this, data?.classes)
        this.interfaces = json_converter.interfaceFromJson(this, data?.interfaces)
        this.types = json_converter.typeFromJson(this, data?.types)
        this.defines = json_converter.defineFromJson(this, data?.defines)
        this.globalVariables = json_converter.globalVariableFromJson(this, data?.globalVariables)
        this.globalFunctions = json_converter.functionFromJson(this, data?.globalFunctions)
        this.enums = json_converter.enumFromJson(this, data?.enums)
        this.ignores = json_converter.ignoreFromJson(this, data?.ignores)
        this.span = json_converter.computeSpan(this)
    }

    public toJSON(): UnitInfoData
    {
        return {
            includes: json_converter.includeToJson(this.includes),
            defines: json_converter.defineToJson(this.defines),
            classes: json_converter.classToJson(this.classes),
            interfaces: json_converter.interfaceToJson(this.interfaces),
            types: json_converter.typeToJson(this.types),
            globalVariables: json_converter.globalVariableToJson(this.globalVariables),
            globalFunctions: json_converter.functionToJson(this.globalFunctions),
            enums: json_converter.enumToJson(this.enums),
            ignores: json_converter.ignoreToJson(this.ignores)
        }
    }

    static fromJson(fileName: string, obj: UnitInfoData): UnitInfo
    {
        return new UnitInfo(fileName, obj)
    }

    public getContext(position: Position): SpanType[]
    {
        const result: SpanType[] = []

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
