import { ClassInfo, ClassMethodInfo, ClassMethodVariable, ClassVariable, ContextTag, DocBlock, GlobalFunction, GlobalFunctionVariable, GlobalVariable, InterfaceInfo, InterfaceMethod, InterfaceProperty, Span, Type, TypeInfo, UnitInfo } from "./UnitInfo";
import { FileRange } from "./zscript-parse";

export class UnitInfoBuilder extends UnitInfo
{
    // temporal state
    private stack: (Span)[] = []

    constructor(fileName: string)
    {
        super(fileName)
    }

    build(): UnitInfo
    {
        return this; //new UnitInfo(this.fileName)
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


}
