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
    system: boolean
    position: Position
}

export interface ClassVariable extends NameAndType
{
    context: ContextTag.CLASS_VARIABLE

    begin: Position
    end: Position
    docBlock: DocBlock
    parent: ClassInfo
}

export interface LocalVariable extends WithContext, NameAndType
{
    context: ContextTag.LOCAL_VARIABLE
    begin: Position
    end: Position
    docBlock: DocBlock
    parent: ClassMethod | GlobalFunction
}

export interface Argument extends WithContext
{
    context: ContextTag.ARGUMENT

    type: Type
    name: string
    begin: Position
    end: Position
}

export interface ClassInfo extends WithContext
{
    context: ContextTag.CLASS
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
    begin: Position
    end: Position
    docBlock: DocBlock
}

export interface InterfaceMethod extends NameAndType
{
    context: ContextTag.INTERFACE_METHOD
    begin: Position
    end: Position
    args: NameAndType[]
    docBlock: DocBlock
    parent: InterfaceInfo
}

export interface InterfaceProperty extends NameAndType
{
    context: ContextTag.INTERFACE_PROPERTY
    begin: Position
    end: Position
    docBlock: DocBlock
    parent: InterfaceInfo
}

export interface InterfaceInfo extends WithContext
{
    context: ContextTag.INTERFACE
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
    begin: Position
    end: Position
    docBlock: DocBlock
}

export interface GlobalFunction extends WithContext, NameAndType
{
    context: ContextTag.GLOBAL_FUNCTION
    begin: Position
    end: Position
    args: Argument[]
    variables: LocalVariable[]
    docBlock: DocBlock
}

export interface EnumValue extends WithContext
{

    context: ContextTag.ENUM_VALUE
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

    // list of spanning objects in order of begin position
    protected span: SpanType[]

    constructor(fileName: string, data ?: UnitInfoData)
    {
        this.fileName = fileName;
        this.includes = data?.includes ?? {}
        this.classes = json_converter.classFromJson(data?.classes)
        this.interfaces = json_converter.interfaceFromJson(data?.interfaces)
        this.types = data?.types ?? {}
        this.defines = data?.defines ?? {}
        this.globalVariables = data?.globalVariables ?? {}
        this.globalFunctions = json_converter.functionFromJson(data?.globalFunctions)
        this.enums = json_converter.enumFromJson(data?.enums)
        this.span = json_converter.computeSpan(this)
    }

    public toJSON(): UnitInfoData
    {
        return {
            includes: this.includes,
            defines: this.defines,
            classes: json_converter.classToJson(this.classes),
            interfaces: json_converter.interfaceToJson(this.interfaces),
            types: this.types,
            globalVariables: this.globalVariables,
            globalFunctions: json_converter.functionToJson(this.globalFunctions),
            enums: json_converter.enumToJson(this.enums),
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
