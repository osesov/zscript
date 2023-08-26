/* Simplified ZS grammar */
{
    const helper = new ParserHelper
    const unitInfo = new UnitInfo(options.fileName, options.fullFileName)
}

start
    = Chunk* { return unitInfo; }

Chunk
    = r:DocBlock { helper.docBlock = r; }
    / _ IfDirective
    / _ IfdefDirective
    / _ IfndefDirective
    / _ ElifDirective
    / _ ElseDirective
    / _ EndifDirective
    / _ DefineDirective
    / _ IncludeDirective

    / _ "{" { helper.openCurly() }
    / _ "}" { const name = helper.closeCurly(unitInfo, location()); if (name) helper.trace(location(), 'END', name) }

    / _ & {return helper.isTopLevel()}   ClassDeclaration
    / _ & {return helper.isTopLevel()}   GlobalVariable
    / _ & {return helper.isTopLevel()}   Function
    / _ & {return helper.isClass()}      ClassMethod
    / _ & {return helper.isClass()}      ClassVariableDeclaration
    / _ & {return helper.isTopLevel()}   InterfaceDeclaration
    / _ & {return helper.isInterface()}  InterfaceMethodDeclaration
    / _ & {return helper.isInterface()}  PropertyDeclaration
    / _ & {return helper.isTopLevel()}   TypeDeclaration
    / _ & {return helper.isMethod() || helper.isFunction()}     MethodExpression

    // TODO: this consumes sime unknown input to avoid errors
    // Comment and implement!
    / IgnoreStatement
_
    = (
        WhiteSpace
        / BlockCommentToken
        / LineCommentToken
    )*

DocBlock
    = WhiteSpace? doc:BlockCommentToken { return [doc] }
    / WhiteSpace? doc:(LineCommentToken+) { return [...doc] }

IfDirective
    = HashToken Spaces? "if" !IdentChar Spaces? PreprocessorLine
        { helper.beginCondition(location()) }

IfndefDirective
    = HashToken Spaces? "ifndef" !IdentChar Spaces? PreprocessorLine
        { helper.beginCondition(location()) }

IfdefDirective
    = HashToken Spaces? "ifdef" !IdentChar Spaces? PreprocessorLine
        { helper.beginCondition(location()) }

ElifDirective
    = HashToken Spaces? "elif" !IdentChar Spaces? PreprocessorLine
        { helper.restartCondition(location()) }

ElseDirective
    = HashToken Spaces? "else" !IdentChar Spaces? PreprocessorLine
        { helper.restartCondition(location()) }

EndifDirective
    = HashToken Spaces? "endif" !IdentChar Spaces? PreprocessorLine
        { helper.endCondition(location()) }

DefineDirective
    = HashToken Spaces? "define" !IdentChar Spaces name:IdentToken Spaces? PreprocessorLine
        {
            helper.trace(location(), 'DEFINE', name)
            unitInfo.addDefine(name, location(), helper.docBlock);
        }

IncludeDirective
    = HashToken Spaces? "include" !IdentChar Spaces ["] file:([^"\n]*) ["] WhiteSpace
        {
            const fileName = file.join('');
            helper.trace(location(), "INCLUDE", fileName)
            unitInfo.addInclude(false, fileName, location())
        }

    / HashToken Spaces? "include" !IdentChar Spaces [<] file:([^>\n]*) [>] WhiteSpace
        {
            const fileName = file.join('');
            helper.trace(location(), "INCLUDE", fileName)
            unitInfo.addInclude(true, fileName, location())
        }

PreprocessorLine
    = [^\n\r]* '\r'? "\n"

Expr
    = StringToken
    / BlockCommentToken
    / LineCommentToken
    / [^=;,]+

Variables
    = ( // &{return ParserHelper.beginOfStatement(input, range())}
        name:IdentToken ( _ "=" _ Expr )?
        { return [name, location()] }
    )|1.., _ "," _ |

GlobalVariable
    = type:Type _ vars:Variables _ ";"
        {
            helper.trace(location(), `global ${vars.map(e => e[0])}, type ${type}`)
            unitInfo.addGlobalVariable(type, vars, location(), helper.docBlock)
        }

Function
    = type:Type _ name:IdentToken _ "(" args:MethodArgumentsDeclaration? _ ")" _ &( '{' )
        {
            helper.trace(location(), 'Global method', name)

            helper.beginContext(CurrentContext.FUNCTION, name, location())
            unitInfo.beginGlobalFunction(type, name, args, location(), helper.docBlock)
        }

IdList
    = @IdentToken |1.., _ "," _|

InterfaceDeclaration
    = InterfaceToken _ name:IdentToken inherit:( _ ":" _ @IdList)? _ &('{')
        {
            helper.trace(location(), 'INTERFACE', name)
            helper.beginContext(CurrentContext.INTERFACE, name, location())
            unitInfo.beginInterface(name, inherit ?? [], location(), helper.docBlock)
        }
    / InterfaceToken _ name:IdentToken _ ';'
        {
            // forward interface declaration
            helper.trace(location(), `forward interface ${name}`);
        }

InterfaceMethodDeclaration
    = type:Type _ name:IdentToken _ "(" args:MethodArgumentsDeclaration? ")" _ ';'
        {
            helper.trace(location(), 'Method: ', name)
            unitInfo.addInterfaceMethod(type, name, args, location(), helper.docBlock)
        }

MethodArgumentsDeclaration
    // = head:MethodArgument tail:( _ "," _ @MethodArgumentsDeclaration ) *
    = @MethodArgument |.., _ "," _ |

MethodArgument
    = type:Type _ name:IdentToken { return [type, name, location()] }

MethodExpression
    = // &{ return ParserHelper.beginOfStatement(input, range())}
    type:Type _ vars:Variables _ ";"
        {
            helper.trace(location(), `local ${vars.map(e => e[0])}, type ${type}`)
            unitInfo.addMethodVariables(type, vars, location(), helper.docBlock)
        }

PropertyDeclaration
    = type:Type _ name:IdentToken _ ";"
        {
            helper.trace(location(), `PropRead ${name}, type ${type}`)
            unitInfo.addReadProperty(type, name, location(), helper.docBlock)
        }
    / name:IdentToken _ "=" _ type:Type ";"
        {
            helper.trace(location(), `PropWrite ${name}, type ${type}`)
            unitInfo.addWriteProperty(type, name, location(), helper.docBlock)
        }

TypeDeclaration
    = "type" _ name:IdentToken t:([^;]*) ";"
        {
            helper.trace(location(), `type ${name}`)
            unitInfo.addType(name, t.join(''.trim()), location(), helper.docBlock)
        }

ClassDeclaration
    = ClassToken _ name:IdentToken _ impl:("implements" _ @IdList) ext:("extends" _ @IdList) _ &('{')
        {
            helper.trace(location(), `class ${name}, impl ${impl}, ext:${ext}`)
            helper.beginContext(CurrentContext.CLASS, name, location())
            unitInfo.beginClass(name, impl ?? [], ext ?? [], location(), helper.docBlock)
        }

    / ClassToken _ name:IdentToken _ ';'
        {
            // forward class declaration
            helper.trace(location(), `forward class ${name}, impl ${impl}`)
        }

ClassMethod
    = visibility:Visibility _ type:Type _ name:IdentToken _ "(" args:MethodArgumentsDeclaration? ")" _ &( '{' )
        {
            helper.trace(location(), 'CLASS METHOD', name)

            helper.beginContext(CurrentContext.METHOD, name, location())
            unitInfo.beginClassMethod(visibility, type, name, args, location(), helper.docBlock)
        }

ClassVariableDeclaration
    = type:Type _ name:IdentToken _ ";"
        {
            helper.trace(location(), `variable ${name}, type ${type}`)
            unitInfo.addClassVariable(type, name, location(), helper.docBlock)
        }

Visibility
    = _ @"public"
    / _ @"protected"
    / _ @"private"

Type
    = n:PrimitiveType { return [n]}
    / CustomType

CustomType
    = (@"ptr" _ @IdentToken)
    / (@"shared" _ @IdentChar)
    / (@"this" _ @IdentToken)
    / (m:"const" _ t:Type { return [m, ...t] })
    / n:IdentToken { return [n]}

PrimitiveType
    = "void"
    / "bool"
    / "str"
    / "fix"
    / "int"
    / "long"
    / "byte"
    / "float"
    / "double"

IgnoreStatement
    = IdentToken
    / StringToken
    / NumberToken
    / Keyword
    / .

//============== Lexer
WhiteSpace
    = [ \t\r\n]+

Spaces
    = [ \t]+

BlockCommentToken
    = "/*" (!"*/" . )* "*/" { return ParserHelper.stripBlockComments(text())}

LineCommentToken
    = "//" (! "\n" . )* "\n" { return text().substring(2).trim() }

IdentToken
    = _ !Keyword name:(@[_a-zA-Z] @[_a-zA-Z0-9]*) !IdentChar { return text().trim() }

InterfaceToken
    = _ "interface" !IdentChar

ClassToken
    = _ "class" !IdentChar

StringToken
    = _ ["] ( [^\\"] / [\\]. )* ["]
    / _ ['] ( [^\\'] / [\\]. )* [']

NumberToken
    = _ [0-9]+ ([.] [0-9]* ([eE] [-+] [0-9]+)? )?
    / _ [0-9]* [.] [0-9]+ ([eE] [-+] [0-9]+)?

HashToken
    = _ "#"

IdentChar
    = [_a-zA-Z0-9]

Keyword
    = "_"           !IdentChar
    / "namespace"   !IdentChar
    / "event"       !IdentChar
    / "ptr"         !IdentChar
    / "shared"      !IdentChar
    / "final"       !IdentChar
    / "abstract"    !IdentChar
    / "static"      !IdentChar
    / "const"       !IdentChar
    / "if"          !IdentChar
    / "else"        !IdentChar
    / "while"       !IdentChar
    / "do"          !IdentChar
    / "break"       !IdentChar
	/ "continue"    !IdentChar
    / "return"      !IdentChar
    / "for"         !IdentChar
    / "true"        !IdentChar
    / "false"       !IdentChar
    / "null"        !IdentChar
	/ "enum"        !IdentChar
    / "interface"   !IdentChar
    / "class"       !IdentChar
    / "struct"      !IdentChar
    / "type"        !IdentChar
    / "this"        !IdentChar
    / "extends"     !IdentChar
	/ "implements"  !IdentChar
    / "switch"      !IdentChar
    / "as"          !IdentChar
    / "and"         !IdentChar
    / "or"          !IdentChar
    / "xor"         !IdentChar
    / "not"         !IdentChar
	/ "extern"      !IdentChar
    / "mod"         !IdentChar
    / "native"      !IdentChar

Operator
    = "+=" / "-=" / "*=" / "/=" / "%=" / "^=" / "&=" / ">>=" / "<<=" / "&&=" / "||="
    / "--" / "++" / "<<" / ">>" / "||" / "&&"
    / "==" / "!=" / ">" / ">=" / "<" / "<="
    / (("mod" / "shl" / "shr" / "or" / "and" / "xor" / "as" / "not") !IdentChar)
    / [-_+~!*/%^=\[\]|&?:.]
