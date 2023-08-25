import { logSystem } from "./logger"
import { FileRange } from "./zscript-parse"

export enum ContextTag
{
    // TOP_LEVEL,
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

type Type = string[]

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
    docBlock: string[]
}

export interface ClassMethodVariable extends NameAndType
{
    begin: Position
    end: Position
    docBlock: string[]
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
    visibility: string
    args: MethodArgument[]
    variables: ClassMethodVariable[]
    docBlock: string[]
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
}

export interface TypeInfo extends NameAndType
{
    begin: Position
    end: Position
    docBlock: string[]
}

export interface InterfaceMethod extends NameAndType
{
    docBlock: string[]
    begin: Position
    end: Position
    args: NameAndType[]
}

export interface InterfaceProperty extends NameAndType
{
    begin: Position
    end: Position
    docBlock: string[]
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
}

export interface DefineInfo
{
    name: string
    begin: Position,
    end: Position,
    docBlock: string[]
}

export interface GlobalVariable extends NameAndType
{
    begin: Position
    end: Position
    docBlock: string[]
}

export interface GlobalFunction extends WithContext, NameAndType
{
    context: ContextTag.FUNCTION
    begin: Position
    end: Position
    args: MethodArgument[]
    variables: ClassMethodVariable[]
    docBlock: string[]
}

export type Span = ClassInfo | InterfaceInfo | ClassMethodInfo | GlobalFunction

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

    // temporal state
    private stack: (Span)[] = []

    // list of spanning objects in order of begin position
    private span: Span[] = []

    constructor(fileName: string)
    {
        this.fileName = fileName;
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

    public beginClass(name: string, impl: string[], ext: [], location: FileRange)
    {
        const classInfo: ClassInfo = {
            context: ContextTag.CLASS,
            name: name,
            implements: impl,
            extends: ext,
            begin: location.start,
            end: location.end,
            methods: [],
            variables: []
        }

        this.class[name] = classInfo
        this.stack.push(classInfo)
        this.span.push(classInfo)
    }

    public beginInterface(name: string, inherit: string[], location: FileRange)
    {
        const classInfo: InterfaceInfo = {
            context: ContextTag.INTERFACE,
            name: name,
            inherit: inherit,
            begin: location.start,
            end: location.end,
            methods: [],
            readProp: [],
            writeProp: []
        }

        this.interface[name] = classInfo
        this.stack.push(classInfo)
        this.span.push(classInfo)
    }

    public addInterfaceMethod(type: Type, name: string, args: [Type,string][], location: FileRange, docBlock: string[])
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

    public addReadProperty(type: Type, name: string, location: FileRange, docBlock: string[])
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

    public addWriteProperty(type: Type, name: string, location: FileRange, docBlock: string[])
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


    public beginClassMethod(visibility: string, type: Type, name: string, args: [Type,string,FileRange][], location: FileRange, docBlock: string[])
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
            docBlock: docBlock
        }

        currentClass.methods.push(methodInfo)
        this.stack.push(methodInfo)
        this.span.push(methodInfo)
    }

    public addMethodVariables(type: Type, names: [string, FileRange][], location: FileRange, docBlock: string[])
    {
        const current = this.getCurrentContext() == ContextTag.METHOD ? this.getCurrentMethod(location) : this.getCurrentFunction(location)

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

    public addClassVariable(type: Type, name: string, location: FileRange, docBlock: string[])
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

    public addGlobalVariable(type: Type, names: [string, FileRange][], location: FileRange, docBlock: string[])
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

    public beginGlobalFunction(type: Type, name: string, args: [Type,string,FileRange][], location: FileRange, docBlock: string[])
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

    public addDefine(name: string, location: FileRange, docBlock: string[])
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

    public addType(name: string, def: string, location: FileRange, docBlock: string[]): void
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
        return t.context ?? CurrentContext.TOP_LEVEL
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

export enum CurrentContext
{
    TOP_LEVEL = 'top-level',
    INTERFACE = 'interface',
    CLASS = 'class',
    METHOD = 'method',
    FUNCTION = 'function',
}

export interface ParseContext
{
    in: CurrentContext
    depth: number
    name: string
}

export interface Condition
{
    context: ParseContext[]
    depth: number
    minDepth: number

    selectedContext: ParseContext[]
}

export class ParseError extends Error
{
    constructor(message: string, public location: FileRange)
    {
        super(message)
    }
}

export class ParserHelper
{

    private logger = logSystem.getLogger(ParserHelper)
    public docBlock: string[] = [];
    private currentContext: ParseContext[] = []
    private conditions: Condition[] = []
    private topLevelContext: ParseContext = {
        name: "top-level",
        in: CurrentContext.TOP_LEVEL,
        depth: 0
    }


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static objArrayCopy<T extends {[k:string]: any}>(data: T[]): T[]
    {
        return data.map( e => Object.assign({}, e))
    }

    static stripBlockComments(t: string): string[]
    {
        const sub = t.substring(2, t.length - 2);
        const re = /^[ \t]*[*]?(.*)/

        return sub.split('\n').map(e => {
            const m = re.exec(e)
            return m![1].trim()
        })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    public trace(location: FileRange, msg: string, ...data: any[]): void
    {
        let source = location.source;
        const prefix = '@../../../valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/'

        if (source.startsWith(prefix))
            source = source.substring(prefix.length)

        const position = `${source}:${location.start.line}:${location.start.column}..${location.end.line}:${location.end.column}: `
        this.logger.debug(position + msg, ...data)
    }

    isTopLevel(): boolean
    {
        return this.currentContext.length === 0
    }

    isInterface(): boolean
    {
        return this.currentContext.length > 0
            && this.currentContext[this.currentContext.length-1].in === CurrentContext.INTERFACE
    }

    isClass(): boolean
    {
        return this.currentContext.length > 0
            && this.currentContext[this.currentContext.length-1].in === CurrentContext.CLASS
    }

    isMethod(): boolean
    {
        return this.currentContext.length > 0
            && this.currentContext[this.currentContext.length-1].in === CurrentContext.METHOD
    }

    isFunction(): boolean
    {
        return this.currentContext.length > 0
            && this.currentContext[this.currentContext.length-1].in === CurrentContext.FUNCTION
    }

    saveContext() : ParseContext[]
    {
        return ParserHelper.objArrayCopy(this.currentContext)
    }

    restoreContext(context: ParseContext[]): void
    {
        const newContext = ParserHelper.objArrayCopy(context);
        this.currentContext.splice(0, this.currentContext.length, ...newContext)
    }

    topContext(): ParseContext
    {
        return this.currentContext.length === 0
            ? this.topLevelContext
            : this.currentContext[this.currentContext.length - 1]
    }

    beginContext(inContext: CurrentContext, name: string, location: FileRange, depth ?: number ): void
    {
        this.trace(location, `Enter context ${inContext} ${name}`)
        this.currentContext.push({
            in: inContext, name: name, depth: depth ?? 0
        })
    }

    endContext(location: FileRange): void
    {
        const context = this.topContext()
        this.trace(location, `Leave context ${context.in} ${context.name}`)
        this.currentContext.pop()
    }

    topCondition(): Condition | undefined
    {
        return this.conditions.length > 0
            ? this.conditions[ this.conditions.length - 1]
            : undefined
    }

    beginCondition(location: FileRange): void
    {
        const context = this.saveContext()
        this.conditions.push({
            context: context,
            selectedContext: context,
            depth: 0,
            minDepth: Number.MAX_VALUE
        })

        this.trace(location, `${location.source}:${location.start.line}:${location.start.column}: BEGIN COND`);
    }

    restartCondition(location: FileRange): void
    {
        const condition = this.topCondition();
        if (!condition)
            throw new ParseError("no current condition", location);

        if (condition.depth < condition.minDepth) {
            condition.selectedContext = this.saveContext();
            condition.minDepth = condition.depth
        }
        condition.depth = 0;
        this.restoreContext(condition.context)
        this.trace(location, `${location.source}:${location.start.line}:${location.start.column}: RESTART COND`);
    }

    endCondition(location: FileRange): void
    {
        const condition = this.topCondition();
        if (!condition)
            throw new ParseError("no current condition", location);

        if (condition.depth < condition.minDepth) {
            condition.selectedContext = this.saveContext();
            condition.minDepth = condition.depth
        }

        this.restoreContext(condition.selectedContext)
        this.conditions.pop();
        this.trace(location, `${location.source}:${location.start.line}:${location.start.column}: END COND`);
    }

    openCurly(): void
    {
        const context = this.topContext();
        const condition = this.topCondition();
        context.depth++;

        if (condition) {
            condition.depth++;
        }
    }

    closeCurly(unitInfo: UnitInfo, location: FileRange): string
    {
        const context = this.topContext();
        const condition = this.topCondition();
        let result = ""

        if (--context.depth === 0) {
            this.endContext(location);
            result = unitInfo.end(location)
        }

        if (condition && condition.depth > 0)
            condition.depth--

        return result
    }

    //
    // using that is really time consuming - it take an order longer to match input
    //
    static beginOfStatement(input: string, range: {source:string, start: number, end: number}): boolean
    {
        // look backward for any of "{};(", skip spaces and comments

        // match
        // require: [;{}(],
        // then possibly zero sequence of
        // - block comment: /* ... */
        // - line comment: // ... \n
        // - space or newline
        // require: end of buffer
        const re = /[;{}(](\/\*(((?!\*\/).)*)[*]\/|\/\/[^\n]*[\n]|[ \r\n\t])*$/
        return re.test(input.substring(0, range.start))
    }

}
