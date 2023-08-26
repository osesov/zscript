import * as vscode from 'vscode'
import { ZsRepository } from '../../../zslib/src/zsRepository'
import { Logger, logSystem } from '../../../zslib/src/logger';
import { fromVscode, toVscode } from '../../../zslib/src/vscodeUtil';
import { ZsHoverSink, ZsHover } from '../../../zslib/src/zsHover'
import { ClassInfo, ClassMethodInfo, ClassMethodVariable, ContextTag, DocBlock, GlobalFunction, InterfaceInfo, InterfaceMethod, MethodArgument, NameAndType, Type } from '../../../zslib/src/lang';

class ZsHoverSinkImpl implements ZsHoverSink
{
    public hover: vscode.Hover | undefined

    private formatVariable(className: string|undefined, name: string, ret: Type)
    {
        let result = ""

        result += ret.join(' ') + ' ';

        if (className)
            result += className + '.'

        result += name;
        return result;
    }

    private formatProto(className: string|undefined, name: string, ret: Type, args: NameAndType[])
    {
        let result = ""

        result += ret.join(' ') + ' ';

        if (className)
            result += className + '.'

        result += name + '(';
        result += args.map(e => e.type.join(' ') + ' ' + e.name).join(', ')
        result += ')'
        return result;
    }

    private format(tag: string, name: string, doc: DocBlock): string
    {
        const result: string[] = []
        const title = `### [${tag}] ${name}`

        result.push(title)
        if (doc.length > 0) {
            result.push("", doc.join("\n\n"))
        }

        return result.join('\n')
    }

    setVariable(info: ClassMethodVariable): void
    {
        if (this.hover)
            return

        const title = this.formatVariable(undefined, info.name, info.type)
        this.hover = new vscode.Hover(this.format("variable", title, info.docBlock))
    }

    setArgument(info: MethodArgument): void
    {
        if (this.hover)
            return

        const title = this.formatVariable(undefined, info.name, info.type)
        this.hover = new vscode.Hover(this.format("argument", title, []))
    }

    setClassMethod(info: ClassMethodInfo): void
    {
        if (this.hover)
            return

        const title = this.formatProto(info.className, info.name, info.type, info.args)

        this.hover = new vscode.Hover(
            this.format("method", title, info.docBlock),
            toVscode.range(info.begin, info.end)
        )
    }

    setFunction(info: GlobalFunction): void
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
        const result = new ZsHoverSinkImpl
        await this.repo.onDocumentAccess(document);
        await this.provider.getHover(result, fileName, word.word, fromVscode.position(position), token);

        return result.hover
    }
}
