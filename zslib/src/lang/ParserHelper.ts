import * as parser from "./zscript-parse"
import { FileRange } from "./zscript-parse"
import { logSystem } from "../util/logger"
import { DocBlock } from "./UnitInfo"
import { UnitInfoBuilder, UnitInfoBuilderState } from "./UnitInfoBuilder"

export enum CurrentContext
{
    TOP_LEVEL = 'top-level',
    INTERFACE = 'interface',
    CLASS = 'class',
    METHOD = 'method',
    FUNCTION = 'function',
    ENUM = 'enum'
}

export interface ParseContext
{
    in: CurrentContext
    depth: number
    name: string
}

export interface State
{
    context: ParseContext[]
    builderState: UnitInfoBuilderState
}

export interface Condition
{
    state: State
    depth: number
    minDepth: number

    selectedState: State
}

export interface ParseRange
{
    source:string
    start: number
    end: number
}

export enum TokenTag
{
    PREPROCESSOR,
    COMMENT,
    IDENT,
    KEYWORD,
    OPERATOR,
    STRING_LITERAL,
    NUMBER_LITERAL,
    SPACE,
    UNDEFINED
}

export interface Token
{
    tag: TokenTag
    location: parser.FileRange
    text: string
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
    public docBlock: DocBlock = [];
    private currentContext: ParseContext[] = []
    private conditions: Condition[] = []
    private topLevelContext: ParseContext = {
        name: "top-level",
        in: CurrentContext.TOP_LEVEL,
        depth: 0
    }
    private builder: UnitInfoBuilder;


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static objArrayCopy<T extends {[k:string]: any}>(data: T[]): T[]
    {
        return data.map( e => Object.assign({}, e))
    }

    static trimDocBlock(t: string[]): string[]
    {
        while (t.length > 0 && t[0].trim() === "")
            t.splice(0,1);

        while (t.length > 0 && t[t.length - 1].trim() === "")
            t.splice(t.length - 1,1);

        return t;
    }

    static stripBlockComments(t: string): string[]
    {
        const sub = t.substring(2, t.length - 2);
        const re = /^[ \t]*[*]?(.*)/

        const result = sub.split('\n').map(e => {
            const m = re.exec(e)
            return m![1].trim()
        })
        return result
    }

    constructor(builder: UnitInfoBuilder)
    {
        this.builder = builder
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

    isEnum(): boolean
    {
        return this.currentContext.length > 0
            && this.currentContext[this.currentContext.length-1].in === CurrentContext.ENUM
    }

    saveContext() : State
    {
        const state: State = {
            context: ParserHelper.objArrayCopy(this.currentContext),
            builderState: this.builder.saveState()
        }

        return state
    }

    restoreContext(state: State): void
    {
        const newContext = ParserHelper.objArrayCopy(state.context);
        this.currentContext.splice(0, this.currentContext.length, ...newContext)
        this.builder.restoreState(state.builderState)
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
        const state = this.saveContext()
        this.conditions.push({
            state: state,
            selectedState: state,
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
            condition.selectedState = this.saveContext();
            condition.minDepth = condition.depth
        }
        condition.depth = 0;
        this.restoreContext(condition.state)
        this.trace(location, `${location.source}:${location.start.line}:${location.start.column}: RESTART COND`);
    }

    endCondition(location: FileRange): void
    {
        const condition = this.topCondition();
        if (!condition)
            throw new ParseError("no current condition", location);

        if (condition.depth < condition.minDepth) {
            condition.selectedState = this.saveContext();
            condition.minDepth = condition.depth
        }

        this.restoreContext(condition.selectedState)
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

    closeCurly(unitInfo: UnitInfoBuilder, location: FileRange): string
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

    setDocBlock(docBlock: parser.DocBlock )
    {
        if (typeof docBlock === "string")
            this.docBlock = ParserHelper.trimDocBlock([docBlock])
        else if (Array.isArray(docBlock))
            this.docBlock = ParserHelper.trimDocBlock(docBlock)
        else
            throw Error("Unsupported DocBlock type: " + docBlock)
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
