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
    / _ "}" { helper.closeCurly(unitInfo, location()) }

    / _ & {return helper.isTopLevel()}   ClassDeclaration
    / _ & {return helper.isClass()}      ClassMethod
    / _ & {return helper.isClass()}      ClassVariableDeclaration
    / _ & {return helper.isTopLevel()}   InterfaceDeclaration
    / _ & {return helper.isInterface()}  InterfaceMethodDeclaration
    / _ & {return helper.isInterface()}  PropertyDeclaration
    / _ & {return helper.isTopLevel()}   TypeDeclaration
    / _ & {return helper.isMethod()}     MethodExpression

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
            console.log(`define '${name}'`)
            unitInfo.addDefine(name, location(), helper.docBlock);
        }

IncludeDirective
    = HashToken Spaces? "include" !IdentChar Spaces ["] file:([^"\n]*) ["] WhiteSpace
            { unitInfo.addInclude(false, file.join(''), location()) }

    / HashToken Spaces? "include" !IdentChar Spaces [<] file:([^>\n]*) [>] WhiteSpace
            { unitInfo.addInclude(true, file.join(''), location()) }

PreprocessorLine
    = [^\n\r]* '\r'? "\n"

InterfaceDeclaration
    = InterfaceToken _ name:IdentToken inherit:( _ ":" _ @IdentToken)? _ &('{')
        {
            console.log(`interface ${name}`);
            helper.beginContext(CurrentContext.INTERFACE, name)
            unitInfo.beginInterface(name, inherit, location(), helper.docBlock)
        }
    / InterfaceToken _ name:IdentToken _ ';'
        {
            // forward interface declaration
            console.log(`forward interface ${name}`);
        }

InterfaceMethodDeclaration
    = type:Type _ name:IdentToken _ "(" args:MethodArgumentsDeclaration? ")" _ ';'
        {
            console.log('Method: ', name)
            unitInfo.addInterfaceMethod(type, name, args, location(), helper.docBlock)
        }

MethodArgumentsDeclaration
    // = head:MethodArgument tail:( _ "," _ @MethodArgumentsDeclaration ) *
    = @MethodArgument |.., _ "," _ |

MethodArgument
    = _ type:Type _ name:IdentToken { return [type, name] }

MethodExpression
    = StringToken
    / type:Type _ name:IdentToken _ ("=" / ";")
        {
            console.log(`local ${name}, type ${type}`)
            unitInfo.addMethodVariable(type, name, location(), helper.docBlock)
        }

PropertyDeclaration
    = type:Type _ name:IdentToken _ ";"
        {
            console.log(`PropRead ${name}, type ${type}`)
            unitInfo.addReadProperty(type, name, location(), helper.docBlock)
        }
    / name:IdentToken _ "=" _ type:Type ";"
        {
            console.log(`PropWrite ${name}, type ${type}`)
            unitInfo.addWriteProperty(type, name, location(), helper.docBlock)
        }

TypeDeclaration
    = "type" _ name:IdentToken t:([^;]*) ";"
        {
            console.log(`type ${name}`)
            unitInfo.addType(name, t.join(''.trim()), helper.docBlock)
        }

ClassDeclaration
    = ClassToken _ name:IdentToken _ impl:("implements" _ @IdentToken) _ &('{')
        {
            console.log(`class ${name}, impl ${impl}`)
            helper.beginContext(CurrentContext.CLASS, name)
            unitInfo.beginClass(name, impl, location(), helper.docBlock)
        }

    / ClassToken _ name:IdentToken _ ';'
        {
            // forward class declaration
            console.log(`forward class ${name}, impl ${impl}`)
        }

ClassMethod
    = visibility:Visibility _ type:Type _ name:IdentToken _ "(" args:MethodArgumentsDeclaration? ")" _ &( '{' )
        {
            console.log(`Class Method: ${name}`)
            helper.beginContext(CurrentContext.METHOD, name)

            unitInfo.beginClassMethod(visibility, type, name, args.map( e => ({
                type: e[0],
                name: e[1]
            })), location(), helper.docBlock)
        }

ClassVariableDeclaration
    = type:Type _ name:IdentToken _ ";"
        {
            console.log(`variable ${name}, type ${type}`)
            unitInfo.addClassVariable(type, name, location(), helper.docBlock)
        }

Visibility
    = _ @"public"
    / _ @"protected"
    / _ @"private"

Type
    = PrimitiveType
    / CustomType

CustomType
    = IdentToken
    / (@"ptr" _ @IdentToken)

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
    = "return"      !IdentChar
    / "break"       !IdentChar
    / "continue"    !IdentChar
    / "for"         !IdentChar
    / "if"          !IdentChar
    / "interface"   !IdentChar
    / "class"       !IdentChar
    / "const"       !IdentChar
    / "mod"         !IdentChar
    / "shl"         !IdentChar
    / "shr"         !IdentChar
    / "or"          !IdentChar
    / "and"         !IdentChar
    / "xor"         !IdentChar
    / "as"          !IdentChar
    / "not"         !IdentChar
    / "_"           !IdentChar
    / "ptr"         !IdentChar

Operator
    = "+=" / "-=" / "*=" / "/=" / "%=" / "^=" / "&=" / ">>=" / "<<=" / "&&=" / "||="
    / "--" / "++" / "<<" / ">>" / "||" / "&&"
    / "==" / "!=" / ">" / ">=" / "<" / "<="
    / (("mod" / "shl" / "shr" / "or" / "and" / "xor" / "as" / "not") !IdentChar)
    / [-_+~!*/%^=\[\]|&?:.]
