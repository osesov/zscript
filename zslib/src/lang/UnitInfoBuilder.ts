import { ClassInfo, ClassMethod, LocalVariable, ClassVariable, ContextTag, DocBlock, GlobalFunction, GlobalVariable, InterfaceInfo, InterfaceMethod, InterfaceProperty, SpanType, Type, TypeInfo, UnitInfo, EnumInfo, EnumValue } from "./UnitInfo";
import { FileRange } from "./zscript-parse";

export class UnitInfoBuilder extends UnitInfo
{
    // temporal state
    private stack: (SpanType | EnumInfo)[] = []

    private static combineDocs(docBlock: DocBlock, ...docs: string[]): DocBlock
    {
        return [...docBlock, ...docs.filter(e => e !== null && e !== undefined)]
    }

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
            context: ContextTag.INCLUDE,
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
            extends: inherit,
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

    public addInterfaceMethod(type: Type, name: string, args: [Type,string][], location: FileRange, docBlock: DocBlock, postDoc: string)
    {
        const currentInterface = this.getCurrentInterface()

        const info : InterfaceMethod = {
            context: ContextTag.INTERFACE_METHOD,
            name: name,
            type: type,
            begin: location.start,
            end: location.end,
            args: args.map(e => ({ type: e[0], name: e[1]})),
            docBlock: UnitInfoBuilder.combineDocs(docBlock, postDoc),
            parent: currentInterface
        }
        currentInterface.methods.push(info)
    }

    public addReadProperty(type: Type, name: string, location: FileRange, docBlock: DocBlock, postDoc: string)
    {
        const currentInterface = this.getCurrentInterface()

        const info : InterfaceProperty = {
            context: ContextTag.INTERFACE_PROPERTY,
            name: name,
            type: type,
            begin: location.start,
            end: location.end,
            docBlock: UnitInfoBuilder.combineDocs(docBlock, postDoc),
            parent: currentInterface
        }
        currentInterface.readProp.push(info)
    }

    public addWriteProperty(type: Type, name: string, location: FileRange, docBlock: DocBlock, postDoc: string)
    {
        const currentInterface = this.getCurrentInterface()

        const info : InterfaceProperty = {
            context: ContextTag.INTERFACE_PROPERTY,
            name: name,
            type: type,
            begin: location.start,
            end: location.end,
            docBlock: UnitInfoBuilder.combineDocs(docBlock, postDoc),
            parent: currentInterface
        }
        currentInterface.writeProp.push(info)
    }


    public beginClassMethod(visibility: string, type: Type, name: string, args: [Type,string,FileRange][], location: FileRange, docBlock: DocBlock)
    {
        const currentClass: ClassInfo = this.getCurrentClass()
        const methodInfo: ClassMethod = {
            context: ContextTag.CLASS_METHOD,
            begin: location.start,
            end: location.end,
            name: name,
            type: type,
            visibility: visibility,
            args: args.map( e=> ({
                context: ContextTag.ARGUMENT,
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

    public addMethodVariables(type: Type, names: [string, FileRange][], location: FileRange, docBlock: DocBlock, postDoc: string)
    {
        const currentClass = this.getCurrentMethod(location)

        for (const [name, location] of names) {
            const info: LocalVariable = {
                context: ContextTag.LOCAL_VARIABLE,
                begin: location.start,
                end: location.end,
                name: name,
                type: type,
                docBlock: UnitInfoBuilder.combineDocs(docBlock, postDoc),
                parent: currentClass
            }

            currentClass.variables.push(info)
        }
    }

    public addFunctionVariables(type: Type, names: [string, FileRange][], location: FileRange, docBlock: DocBlock, postDoc: string)
    {
        const currentFunction = this.getCurrentFunction(location)

        for (const [name, location] of names) {
            const info: LocalVariable = {
                context: ContextTag.LOCAL_VARIABLE,
                begin: location.start,
                end: location.end,
                name: name,
                type: type,
                docBlock: UnitInfoBuilder.combineDocs(docBlock, postDoc),
                parent: currentFunction
            }

            currentFunction.variables.push(info)
        }
    }

    public addClassVariable(type: Type, names: string[], location: FileRange, docBlock: DocBlock, postDoc: string)
    {
        const currentClass: ClassInfo = this.getCurrentClass()
        for (const name of names) {
            const info: ClassVariable = {
                context: ContextTag.CLASS_VARIABLE,
                begin: location.start,
                end: location.end,
                name: name,
                type: type,
                docBlock: UnitInfoBuilder.combineDocs(docBlock, postDoc),
                parent: currentClass
            }

            currentClass.variables.push(info)
        }
    }

    public addGlobalVariable(type: Type, names: [string, FileRange][], location: FileRange, docBlock: DocBlock, postDoc: string)
    {
        for (const [name, location] of names) {
            const info: GlobalVariable = {
                context: ContextTag.GLOBAL_VARIABLE,
                begin: location.start,
                end: location.end,
                name: name,
                type: type,
                docBlock: UnitInfoBuilder.combineDocs(docBlock, postDoc)
            }

            this.globalVariables[name] = info
        }
    }

    public beginEnum(location: FileRange, name: string, docBlock: DocBlock)
    {
        const info: EnumInfo = {
            context: ContextTag.ENUM,
            begin: location.start,
            end: location.end,
            name: name,
            values: [],
            docBlock: docBlock,
        }

        this.enums[name] = info
        this.stack.push(info)
    }

    public addEnumValue(location: FileRange, name: string, value: number|undefined, docBlock: DocBlock, postDoc: string[])
    {
        const t = this.getCurrentEnum(location)
        const info: EnumValue = {
            context: ContextTag.ENUM_VALUE,
            name,
            value,
            begin: location.start,
            end: location.end,
            docBlock: UnitInfoBuilder.combineDocs(docBlock, ...postDoc),
            parent: t
        }

        t.values.push(info);
    }

    public beginGlobalFunction(type: Type, name: string, args: [Type,string,FileRange][], location: FileRange, docBlock: DocBlock)
    {
        const methodInfo: GlobalFunction = {
            context: ContextTag.GLOBAL_FUNCTION,
            begin: location.start,
            end: location.end,
            name: name,
            type: type,
            args: args.map( e=> ({
                context: ContextTag.ARGUMENT,
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
        if (this.defines[name] === undefined) {
            this.defines[name] = {
                context: ContextTag.DEFINE,
                name: name,
                definitions: []
            }
        }

        this.defines[name].definitions.push({
            begin: location.start,
            end: location.end,
            docBlock: docBlock
        })
    }

    public addType(name: string, def: string, location: FileRange, docBlock: DocBlock, postDoc: string): void
    {
        const typeInfo: TypeInfo = {
            context: ContextTag.TYPE,
            name: name,
            type: [def],
            begin: location.start,
            end: location.end,
            docBlock: UnitInfoBuilder.combineDocs(docBlock, postDoc),
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

    public getCurrentMethod(location: FileRange): ClassMethod
    {
        const t = this.stack[ this.stack.length - 1];

        if (t.context === ContextTag.CLASS_METHOD)
            return t

        throw Error(`No current method: ${location.start.line}...${location.end.line}`)
    }

    public getCurrentFunction(location: FileRange): GlobalFunction
    {
        const t = this.stack[ this.stack.length - 1];

        if (t.context === ContextTag.GLOBAL_FUNCTION)
            return t

        throw Error(`No current function: ${location.start.line}...${location.end.line}`)
    }

    public getCurrentEnum(location: FileRange): EnumInfo
    {
        const t = this.stack[ this.stack.length - 1];

        if (t.context === ContextTag.ENUM)
            return t

        throw Error(`No current enum: ${location.start.line}...${location.end.line}`)
    }
}
