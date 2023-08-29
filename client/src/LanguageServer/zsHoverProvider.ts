import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/lang/zsRepository'
import { Logger, logSystem } from '../../../zslib/src/util/logger';
import { fromVscode, toVscode } from '../../../zslib/src/util/vscodeUtil';
import { ClassInfo, ClassMethod, LocalVariable, ClassVariable, DefineInfo, DocBlock, GlobalFunction, GlobalVariable, InterfaceInfo, InterfaceMethod, InterfaceProperty, Argument, NameAndType, Type, TypeInfo } from '../../../zslib/src/lang/UnitInfo';
import { languageId } from '../common';
import { ZsHover, ZsHoverSink } from '../../../zslib/src/services/zsHover'

class ZsHoverSinkImpl implements ZsHoverSink
{
    public hover: vscode.Hover | undefined

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
        if (this.hover)
            return

        const title = this.formatVariable(undefined, info.name, info.type)
        this.hover = new vscode.Hover(this.format("class variable", title, info.docBlock))
    }

    setArgument(info: Argument): void
    {
        if (this.hover)
            return

        const title = this.formatVariable(undefined, info.name, info.type)
        this.hover = new vscode.Hover(this.format("argument", title, []))
    }

    setLocalVariable(info: LocalVariable): void {
        if (this.hover)
            return

        const title = this.formatVariable(undefined, info.name, info.type)
        this.hover = new vscode.Hover(
            this.format("local variable", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setClassMethod(info: ClassMethod): void
    {
        if (this.hover)
            return

        const title = this.formatProto(info.parent, info.name, info.type, info.args)

        this.hover = new vscode.Hover(
            this.format("method", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setGlobalVariable(info: GlobalVariable): void
    {
        if (this.hover)
            return

        const title = this.formatVariable(undefined, info.name, info.type)
        this.hover = new vscode.Hover(
            this.format("global variable", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setGlobalFunction(info: GlobalFunction): void
    {
        if (this.hover)
            return

        const title = this.formatProto(undefined, info.name, info.type, info.args)
        this.hover = new vscode.Hover(
            this.format("function", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setInterfaceMethod(info: InterfaceMethod): void
    {
        if (this.hover)
            return

        const title = this.formatProto(undefined, info.name, info.type, info.args)

        this.hover = new vscode.Hover(
            this.format("method", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setClass(info: ClassInfo): void
    {
        if (this.hover)
            return

        this.hover = new vscode.Hover(
            this.format("class", info.name, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setInterface(info: InterfaceInfo): void
    {
        if (this.hover)
            return

        this.hover = new vscode.Hover(
            this.format("interface", info.name, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setInterfaceProperty(info: InterfaceProperty): void
    {
        if (this.hover)
            return

        const title = this.formatVariable(info.parent, info.name, info.type);

        this.hover = new vscode.Hover(
            this.format("property", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setDefine(info: DefineInfo): void {
        if (this.hover)
            return

        const result = new vscode.MarkdownString
        info.definitions.forEach( define => {
            const line = this.format("define", info.name, define.docBlock)
            result.appendMarkdown(line.value)
        })

        this.hover = new vscode.Hover(result);
    }

    setType(info: TypeInfo): void
    {
        if (this.hover)
            return

        const title = `${info.name}: ${info.type.join(' ')}`;
        this.hover = new vscode.Hover(
            this.format("type", title, info.docBlock),
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
        const word = fromVscode.getWordAtCursor(document, position)
        if (!word)
            return;
        const fileName = document.uri.fsPath
        this.logger.debug("Query hover for {@word} in {file}", word, this.repo.stripPathPrefix(fileName));
        try {
            const sink = new ZsHoverSinkImpl
            await this.repo.onDocumentAccess(document);
            await this.provider.getHover(sink, fileName, word.word, fromVscode.position(position), token);

            const result = sink.hover
            const getText = (e: vscode.MarkedString) => {
                if (e instanceof vscode.MarkdownString)
                    return e.value;

                if (typeof e === "string")
                    return e;

                return `[language: ${e.language}] ${e.value}`
            }

            this.logger.info(`Hover for ${word.word}: ${result?.contents.map(e=>getText(e)).join('\n')}`)
            return result;
        }

        catch(e: unknown) {
            this.logger.error("Query hover error: {error}", e);
        }
    }
}
