import { assertUnreachable } from "../util/util"
import { json_converter } from "./converter"

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

export interface WithContext
{
    context: ContextTag
}

export interface NameAndType
{
    name: string
    type: Type
}

export interface Include
{
    system: boolean
    position: Position
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
    protected span: Span[]

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
        }
    }

    static fromJson(fileName: string, obj: UnitInfoData): UnitInfo
    {
        return new UnitInfo(fileName, obj)
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
