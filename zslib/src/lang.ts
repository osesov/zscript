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
}

export interface ClassMethodVariable extends NameAndType
{
    begin: Position
    end: Position
    docBlock: DocBlock
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
export interface ClassMethodInfo extends WithContext, NameAndType
{
    context: ContextTag.METHOD
    begin: Position
    end: Position
    className: string
    visibility: string
    args: MethodArgument[]
    variables: ClassMethodVariable[]
    docBlock: DocBlock
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
}

export interface InterfaceProperty extends NameAndType
{
    begin: Position
    end: Position
    docBlock: DocBlock
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
    variables: ClassMethodVariable[]
    docBlock: DocBlock
}

export type Span = ClassInfo | InterfaceInfo | ClassMethodInfo | GlobalFunction

type SerializedSpan = {tag: string, name: string}[]

export interface UnitInfoData
{
    readonly include: { [fileName: string]: Include[] }
    readonly class: { [className: string]: ClassInfo }
    readonly interface: { [ifName: string]: InterfaceInfo }
    readonly types: { [name: string]: TypeInfo }
    readonly define: { [name: string]: DefineInfo[] }
    readonly globalVariables: { [name: string]: GlobalVariable }
    readonly globalFunctions: { [name: string]: GlobalFunction }
    // list of spanning objects in order of begin position
    // readonly span: SerializedSpan
}

export class UnitInfo
{
    public fileName: string

    public readonly include: {
        [fileName: string]: Include[]
    } = {}

    public readonly class: {
        [className: string]: ClassInfo
    } = {}

    public readonly interface: {
        [ifName: string]: InterfaceInfo
    } = {}

    public readonly types: {
        [name: string]: TypeInfo
    } = {}

    public readonly define: {
        [name: string]: DefineInfo[]
    } = {}

    public readonly globalVariables: {
        [name: string]: GlobalVariable
    } = {}

    public readonly globalFunctions: {
        [name: string]: GlobalFunction
    } = {}

    // list of spanning objects in order of begin position
    private span: Span[] = []

    // temporal state
    private stack: (Span)[] = []

    constructor(fileName: string, data ?: UnitInfoData)
    {
        this.fileName = fileName;
        this.include = data?.include ?? {}
        this.class = data?.class ?? {}
        this.interface = data?.interface ?? {}
        this.types = data?.types ?? {}
        this.define = data?.define ?? {}
        this.globalVariables = data?.globalVariables ?? {}
        this.globalFunctions = data?.globalFunctions ?? {}
        this.span = this.computeSpan() // this.deserializeSpan(data?.span)
    }

    public toJSON(): UnitInfoData
    {
        return {
            include: this.include,
            define: this.define,
            class: this.class,
            interface: this.interface,
            types: this.types,
            globalVariables: this.globalVariables,
            globalFunctions: this.globalFunctions,
            // span: this.serializeSpan()
        }
    }


    static fromJson(fileName: string, obj: UnitInfoData): UnitInfo
    {
        return new UnitInfo(fileName, obj)
    }

    private serializeSpan(): SerializedSpan
    {
        const result: SerializedSpan = []

        for (const it of this.span) {
            switch(it.context) {
            // case ContextTag.TOP_LEVEL:
                // break;

            case ContextTag.CLASS:
            case ContextTag.INTERFACE:
            case ContextTag.FUNCTION:
                result.push( {
                    tag: ContextTag[it.context],
                    name: it.name
                })
                break;
            case ContextTag.METHOD:
                result.push( {
                    tag: ContextTag[it.context],
                    name: [ it.className, it.name ].join('.')
                })
                break;

            // default:
                // assertUnreachable(it.context)
            }
        }

        return result;
    }

    private computeSpan(): Span[]
    {
        const result: Span[] = []

        for (const it of Object.values(this.class)) {
            result.push(it)
            for (const m of it.methods) {
                result.push(m)
            }
        }
        for (const it of Object.values(this.interface)) {
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

    private deserializeSpan(source ?: SerializedSpan): Span[]
    {
        const result: Span[] = []

        if (!source)
            return result;

        for (const it of source) {
            const tagEntry = Object.entries(ContextTag).find(([key, val]) =>
                key === it.tag)

            if (tagEntry === undefined)
                return []
            const tag = tagEntry[1]
            let obj : Span | undefined

            switch(tag) {
            case ContextTag.CLASS: obj = this.class[it.name]; break;
            case ContextTag.INTERFACE: obj = this.interface[it.name]; break;
            case ContextTag.FUNCTION: obj = this.globalFunctions[it.name]; break;
            case ContextTag.METHOD:
                {
                    const [className, methodName] = it.name.split('.');
                    const classInfo = this.class[className];
                    obj = classInfo?.methods.find(e=> e.name === methodName);
                    break;
                }
            }

            if (obj === undefined)
                throw Error("Unable to parse span");

            result.push(obj)
        }
        return result;
    }

    public addInclude(system: boolean, name: string, location: FileRange): void
    {
        if (!(name in this.include)) {
            this.include[name] = []
        }

        this.include[name].push({
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

        this.class[name] = classInfo
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

        this.interface[name] = classInfo
        this.stack.push(classInfo)
        this.span.push(classInfo)
    }

    public addInterfaceMethod(type: Type, name: string, args: [Type,string][], location: FileRange, docBlock: DocBlock)
    {
        const m = this.getCurrentInterface()

        const info : InterfaceMethod = {
            name: name,
            type: type,
            begin: location.start,
            end: location.end,
            args: args.map(e => ({ type: e[0], name: e[1]})),
            docBlock: docBlock
        }
        m.methods.push(info)
    }

    public addReadProperty(type: Type, name: string, location: FileRange, docBlock: DocBlock)
    {
        const m = this.getCurrentInterface()

        const info : InterfaceProperty = {
            name: name,
            type: type,
            begin: location.start,
            end: location.end,
            docBlock: docBlock
        }
        m.readProp.push(info)
    }

    public addWriteProperty(type: Type, name: string, location: FileRange, docBlock: DocBlock)
    {
        const m = this.getCurrentInterface()

        const info : InterfaceProperty = {
            name: name,
            type: type,
            begin: location.start,
            end: location.end,
            docBlock: docBlock
        }
        m.writeProp.push(info)
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
            className: currentClass.name
        }

        currentClass.methods.push(methodInfo)
        this.stack.push(methodInfo)
        this.span.push(methodInfo)
    }

    public addMethodVariables(type: Type, names: [string, FileRange][], location: FileRange, docBlock: DocBlock)
    {
        const context = this.getCurrentContext();
        const current = context == ContextTag.METHOD
            ? this.getCurrentMethod(location)
            : context === ContextTag.FUNCTION ? this.getCurrentFunction(location)
            : null;

        if (!current) {
            throw Error("Unexpected context: " + current)
        }

        for (const [name, location] of names) {
            const info: ClassMethodVariable = {
                begin: location.start,
                end: location.end,
                name: name,
                type: type,
                docBlock: docBlock
            }

            current.variables.push(info)
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
            docBlock: docBlock
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
        if (this.define[name] === undefined)
            this.define[name] = []
        this.define[name].push({
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
