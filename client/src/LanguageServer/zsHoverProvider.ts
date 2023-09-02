import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/lang/zsRepository'
import { Logger, logSystem } from '../../../zslib/src/util/logger';
import { fromVscode, toVscode } from '../../../zslib/src/util/vscodeUtil';
import { ClassInfo, ClassMethod, LocalVariable, ClassVariable, DefineInfo, DocBlock, GlobalFunction, GlobalVariable, InterfaceInfo, InterfaceMethod, InterfaceProperty, Argument, NameAndType, Type, TypeInfo, EnumInfo, EnumValue } from '../../../zslib/src/lang/UnitInfo';
import { languageId } from '../common';
import { ZsHover, ZsHoverSink } from '../../../zslib/src/services/zsHover'

class ZsHoverSinkImpl implements ZsHoverSink
{
    public hover: vscode.Hover | undefined

    private append(string: vscode.MarkdownString, range?: vscode.Range): void
    {
        if (this.hover === undefined) {
            this.hover = new vscode.Hover(string/*, range*/)
            return;
        }

        this.hover.contents.push(string)
    }

    private formatVariable(parent: ClassInfo|InterfaceInfo|undefined, name: string, ret: Type)
    {
        let result = ""

        result += ret.join(' ') + ' ';

        if (parent)
            result += parent.name + '::'

        result += name;
        return result;
    }

    private formatProto(parent: ClassInfo|InterfaceInfo|undefined, name: string, ret: Type, args: NameAndType[])
    {
        let result = ""

        result += ret.join(' ') + ' ';

        if (parent)
            result += parent.name + '::'

        result += name + '(';
        result += args.map(e => e.type.join(' ') + ' ' + e.name).join(', ')
        result += ')'
        return result;
    }

    private format(tag: string, name: string, doc: DocBlock): vscode.MarkdownString
    {
        const title = `(${tag}) ${name}`
        const ms = new vscode.MarkdownString()
        ms.appendCodeblock(title, languageId)

        if (doc.length > 0) {
            ms.appendMarkdown('---\n')
            doc.forEach(e => {
                ms.appendText(e)
                ms.appendMarkdown('\n\n')
            })
        }
        return ms;
    }

    setClassVariable(info: ClassVariable): void
    {
        const title = this.formatVariable(info.parent, info.name, info.type)
        this.append(this.format("class variable", title, info.docBlock))
    }

    setArgument(info: Argument): void
    {
        const title = this.formatVariable(undefined, info.name, info.type)
        this.append(this.format("argument", title, []))
    }

    setLocalVariable(info: LocalVariable): void {
        const title = this.formatVariable(undefined, info.name, info.type)
        this.append(
            this.format("local variable", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setClassMethod(info: ClassMethod): void
    {
        const title = this.formatProto(info.parent, info.name, info.type, info.args)

        this.append(
            this.format("method", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setGlobalVariable(info: GlobalVariable): void
    {
        const title = this.formatVariable(undefined, info.name, info.type)
        this.append(
            this.format("global variable", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setGlobalFunction(info: GlobalFunction): void
    {
        const title = this.formatProto(undefined, info.name, info.type, info.args)
        this.append(
            this.format("function", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setInterfaceMethod(info: InterfaceMethod): void
    {
        const title = this.formatProto(info.parent, info.name, info.type, info.args)
        this.append(
            this.format("method", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setClass(info: ClassInfo): void
    {
        this.append(
            this.format("class", info.name, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setInterface(info: InterfaceInfo): void
    {
        this.append(
            this.format("interface", info.name, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setInterfaceProperty(info: InterfaceProperty): void
    {
        const title = this.formatVariable(info.parent, info.name, info.type);
        this.append(
            this.format("property", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setDefine(info: DefineInfo): void {
        const result = new vscode.MarkdownString
        info.definitions.forEach( define => {
            const line = this.format("define", info.name, define.docBlock)
            result.appendMarkdown(line.value)
        })

        this.append(result);
    }

    setType(info: TypeInfo): void
    {
        const title = `${info.name}: ${info.type.join(' ')}`;
        this.append(
            this.format("type", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setEnum(info: EnumInfo): void {
        this.append(
            this.format("enum", info.name, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setEnumValue(info: EnumValue): void {
        const title = info.parent.name + "::" + info.name;
        this.append(
            this.format("enum value", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }
}

export class ZsHoverProvider implements vscode.HoverProvider
{
    private repo: ZsRepository
    private logger: Logger
    private provider: ZsHover

    constructor(repo: ZsRepository)
    {
        this.repo = repo;
        this.provider = new ZsHover(repo)
        this.logger = logSystem.getLogger(ZsHoverProvider)
    }

    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover|undefined>
    {
        const words = fromVscode.getWordsAtCursor(document, position)
        if (words.length === 0)
            return;
        const fileName = document.uri.fsPath
        this.logger.debug("Query hover for {word} in {file}", words, this.repo.stripPathPrefix(fileName));
        try {
            const sink = new ZsHoverSinkImpl
            await this.repo.onDocumentAccess(document);
            await this.provider.getHover(sink, fileName, words, fromVscode.position(position), token);

            const result = sink.hover
            const getText = (e: vscode.MarkedString) => {
                if (e instanceof vscode.MarkdownString)
                    return e.value;

                if (typeof e === "string")
                    return e;

                return `[language: ${e.language}] ${e.value}`
            }

            this.logger.info(`Hover for ${words.join('.')}: ${result?.contents.map(e=>getText(e)).join('\n')}`)
            return result;
        }

        catch(e: unknown) {
            this.logger.error("Query hover error: {error}", e);
        }
    }
}
