import { FileRange } from "./zscript-parse"

export enum ContextTag
{
    // TOP_LEVEL,
    INTERFACE,
    CLASS,
    METHOD,
}

export interface Position
{
    line: number
    column: number // TAB is a single character
}

export interface Include
{
    system: boolean
    position: Position
}

export interface NameAndType
{
    name: string
    type: string
}

export interface ClassVariable extends NameAndType
{
    position: Position
}

export interface Common
{
    context: ContextTag
}

export interface ClassMethodVariable extends NameAndType
{
    position: Position
    docBlock: string[]
}

export interface ClassMethodInfo extends NameAndType, Common
{
    context: ContextTag.METHOD
    begin: Position
    end: Position
    visibility: string
    args: NameAndType[]
    variables: ClassMethodVariable[]
}

export interface ClassInfo extends Common
{
    context: ContextTag.CLASS
    name: string
    implements: string
    begin: Position
    end: Position
    methods: ClassMethodInfo[]
    variables: ClassVariable[]
}

export interface TypeInfo extends NameAndType
{
    position: Position
}

export interface InterfaceMethod extends NameAndType
{
    docBlock: string[]
    position: Position
    args: NameAndType[]
}

export interface InterfaceProperty extends NameAndType
{
    position: Position
    docBlock: string[]
}

export interface InterfaceInfo
{
    context: ContextTag.INTERFACE
    name: string
    inherit: string
    begin: Position
    end: Position
    methods: InterfaceMethod[]
    readProp: InterfaceProperty[]
    writeProp: InterfaceProperty[]
}

export interface DefineInfo
{
    name: string
    position: Position,
    docBlock: string[]
}

export type Span = ClassInfo | InterfaceInfo | ClassMethodInfo

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
        [name: string]: DefineInfo
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

    public beginClass(name: string, impl: string, location: FileRange)
    {
        const classInfo: ClassInfo = {
            context: ContextTag.CLASS,
            name: name,
            implements: impl,
            begin: location.start,
            end: location.end,
            methods: [],
            variables: []
        }

        this.class[name] = classInfo
        this.stack.push(classInfo)
        this.span.push(classInfo)
        console.log('CLASS', name)
    }

    public beginInterface(name: string, inherit: string, location: FileRange)
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
        console.log('INTERFACE', name)
    }

    public addInterfaceMethod(type: string, name: string, args: any, location: FileRange, docBlock: string[])
    {
        const m = this.getCurrentInterface()

        const info : InterfaceMethod = {
            name: name,
            type: type,
            position: location.start,
            args: args,
            docBlock: docBlock
        }
        m.methods.push(info)
    }

    public addReadProperty(type: string, name: string, location: FileRange, docBlock: string[])
    {
        const m = this.getCurrentInterface()

        const info : InterfaceProperty = {
            name: name,
            type: type,
            position: location.start,
            docBlock: docBlock
        }
        m.readProp.push(info)
    }

    public addWriteProperty(type: string, name: string, location: FileRange, docBlock: string[])
    {
        const m = this.getCurrentInterface()

        const info : InterfaceProperty = {
            name: name,
            type: type,
            position: location.start,
            docBlock: docBlock
        }
        m.writeProp.push(info)
    }


    public beginClassMethod(visibility: string, type: string, name: string, args: NameAndType[], location: FileRange, docBlock: string[])
    {
        const currentClass: ClassInfo = this.getCurrentClass()
        const methodInfo: ClassMethodInfo = {
            context: ContextTag.METHOD,
            begin: location.start,
            end: location.end,
            name: name,
            type: type,
            visibility: visibility,
            args: args,
            variables: []
        }

        currentClass.methods.push(methodInfo)
        this.stack.push(methodInfo)
        this.span.push(methodInfo)

        console.log('CLASS METHOD', name)
    }

    public addMethodVariable(type: string, name: string, location: FileRange, docBlock: string[])
    {
        const current: ClassMethodInfo = this.getCurrentMethod()
        const info: ClassMethodVariable = {
            position: location.start,
            name: name,
            type: type,
            docBlock: docBlock
        }

        current.variables.push(info)
    }

    public addClassVariable(type: string, name: string, location: FileRange, docBlock: string[])
    {
        const currentClass: ClassInfo = this.getCurrentClass()
        const info: ClassVariable = {
            position: location.start,
            name: name,
            type: type,
        }

        currentClass.variables.push(info)
        console.log('CLASS VARIABLE', name)
    }

    public addDefine(name: string, location: FileRange, docBlock: string[])
    {
        this.define[name] = {
            name: name,
            position: location.start,
            docBlock: docBlock
        }
    }

    public addType(name: string, def: string, location: FileRange): void
    {
        const typeInfo: TypeInfo = {
            name: name,
            type: def,
            position: location.start
        }
        this.types[name] = typeInfo;
    }


    public end(location: FileRange)
    {
        const top = this.stack[ this.stack.length - 1]
        if (!top)
            return
        console.log('END ', top.name)
        this.stack.pop();
        top.end = location.end
    }

    public getCurrentClass(): ClassInfo
    {
        const t = this.stack[ this.stack.length - 1];

        if (!t)
            debugger

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

    public getCurrentMethod(): ClassMethodInfo
    {
        const t = this.stack[ this.stack.length - 1];

        if (!t)
            debugger

        if (t.context === ContextTag.METHOD)
            return t

        throw Error("No current class")
    }

    public getContext(position: Position): Span[]
    {
        const result: Span[] = []
        const active: Span[] = []

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
    METHOD = 'method'
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

    public docBlock: string[] = [];
    private currentContext: ParseContext[] = []
    private conditions: Condition[] = []
    private topLevelContext: ParseContext = {
        name: "top-level",
        in: CurrentContext.TOP_LEVEL,
        depth: 0
    }


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

    beginContext(inContext: CurrentContext, name: string, depth ?: number ): void
    {
        console.log(`Enter context ${inContext} ${name}`)
        this.currentContext.push({
            in: inContext, name: name, depth: depth ?? 0
        })
    }

    endContext(): void
    {
        const context = this.topContext()
        console.log(`Leave context ${context.in} ${context.name}`)
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

        console.log(`${location.source}:${location.start.line}:${location.start.column}: BEGIN COND`);
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
        console.log(`${location.source}:${location.start.line}:${location.start.column}: RESTART COND`);
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
        console.log(`${location.source}:${location.start.line}:${location.start.column}: END COND`);
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

    closeCurly(unitInfo: UnitInfo, location: FileRange): void
    {
        const context = this.topContext();
        const condition = this.topCondition();

        if (--context.depth === 0) {
            this.endContext();
            unitInfo.end(location)
        }

        if (condition && condition.depth > 0)
            condition.depth--
    }

}
