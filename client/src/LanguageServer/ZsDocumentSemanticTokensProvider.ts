import * as vscode from 'vscode';
import { Token, TokenTag, ZsRepository } from '../../../zslib/src/lang/zsRepository';
import { getClassByName, getDefineByName, getEnumByName, getGlobalFunctionByName, getGlobalVariableByName, getInterfaceByName, getScopeContext, getTypeByName } from '../../../zslib/src/lang/InterUnitInfo';

enum TokenType
{
    type,
    class,
    interface,
    enum,
    function,
    method,
    macro,
    variable,
    parameter,
    property
}

enum TokenModifiers
{
    declaration,
    documentation,
    readonly,
    static,
}

export class ZsDocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider
{
    constructor(private repo: ZsRepository)
    {

    }

    public static getLegend(): vscode.SemanticTokensLegend
    {
        const tokenTypes: string[] = []
        const tokenModifiers : string[] = []

        for (const [key, value] of Object.entries(TokenType)) {
            if (typeof value !== 'number')
                continue

            tokenTypes.push(key)
        }

        for (const [key, value] of Object.entries(TokenModifiers)) {
            if (typeof value !== 'number')
                continue

            tokenTypes.push(key)
        }

        return new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
    }

    async provideDocumentSemanticTokens(document: vscode.TextDocument, cancellationToken: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        this.repo.onDocumentAccess(document);

        const includes = await this.repo.getIncludeQueue(document.uri.fsPath);
        const builder = new vscode.SemanticTokensBuilder()
        const append = (token: Token, tokenType: TokenType, modifiers: number) =>
            builder.push(token.location.start.line - 1, token.location.start.column - 1, token.text.length,
                    tokenType, modifiers)

        const main = includes[0]
        if (!main)
            return builder.build();

        const tokens = this.repo.tokenize(document.uri.fsPath, document.getText())
        //
        // TODO: track context at the point, resolve
        // - arguments
        // - local variables
        // - methods
        //
        for(const token of tokens) {
            if (cancellationToken.isCancellationRequested)
                break;
            if (token.tag === TokenTag.IDENT) {
                if (getTypeByName(includes, token.text))
                    append(token, TokenType.type, 0);

                else if (getClassByName(includes, token.text))
                    append(token, TokenType.class, 0);

                else if (getInterfaceByName(includes, token.text))
                    append(token, TokenType.interface, 0);

                else if (getEnumByName(includes, token.text))
                    append(token, TokenType.enum, 0);

                else if (getGlobalFunctionByName(includes, token.text))
                        append(token, TokenType.function, 0);

                else if (getGlobalVariableByName(includes, token.text))
                    append(token, TokenType.variable, 0);

                else if (getDefineByName(includes, token.text))
                    append(token, TokenType.macro, 0);

            }

            continue
        }

        return builder.build()
    }
}
