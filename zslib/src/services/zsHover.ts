import { getScopeContext, getScopeSymbols } from "../lang/InterUnitInfo";
import { ClassInfo, ClassMethod, LocalVariable, ClassVariable, ContextTag, DefineInfo, GlobalFunction, GlobalVariable, InterfaceInfo, InterfaceMethod, InterfaceProperty, Argument, Position, UnitInfo, TypeInfo, EnumInfo, EnumValue } from "../lang/UnitInfo";
import { ZsRepository } from "../lang/zsRepository";
import { CancellationToken, assertUnreachable } from "../util/util";

export interface ZsHoverSink
{
    setArgument(info: Argument): void
    setLocalVariable(info: LocalVariable): void

    setType(info: TypeInfo): void
    setEnum(info: EnumInfo): void
    setEnumValue(info: EnumValue): void

    setDefine(info: DefineInfo): void
    setClass(info: ClassInfo): void
    setClassMethod(info: ClassMethod): void
    setClassVariable(info: ClassVariable): void

    setGlobalVariable(info: GlobalVariable): void
    setGlobalFunction(info: GlobalFunction): void

    setInterface(info: InterfaceInfo): void
    setInterfaceMethod(info: InterfaceMethod): void
    setInterfaceProperty(info: InterfaceProperty): void
}

export class ZsHover
{
    constructor(private repo: ZsRepository)
    {
    }

    async getHover(result: ZsHoverSink, fileName: string, words: string[], position: Position, _token: CancellationToken): Promise<void>
    {
        const includes = await this.repo.getIncludeQueue(fileName)
        if (includes.length === 0)
            return

        const values = getScopeContext(includes, words, position)
        for (const value of values) {
            // const g = getScopeSymbols(includes, position, (e) => e.name === words[0] );
            // const generatorValue = g.next();

            // if (generatorValue.done)
            //     return

            // const value = generatorValue.value;

            switch(value.context) {

                // case ContextTag.INCLUDE:
            case ContextTag.DEFINE: result.setDefine(value); break;
            case ContextTag.INTERFACE: result.setInterface(value); break;
            case ContextTag.INTERFACE_PROPERTY: result.setInterfaceProperty(value); break;
            case ContextTag.INTERFACE_METHOD: result.setInterfaceMethod(value); break
            case ContextTag.CLASS: result.setClass(value); break;
            case ContextTag.CLASS_VARIABLE: result.setClassVariable(value); break;
            case ContextTag.CLASS_METHOD: result.setClassMethod(value); break;
            case ContextTag.LOCAL_VARIABLE: result.setLocalVariable(value); break;
            case ContextTag.GLOBAL_FUNCTION: result.setGlobalFunction(value); break;
            case ContextTag.GLOBAL_VARIABLE: result.setGlobalVariable(value); break;
            case ContextTag.ARGUMENT: result.setArgument(value); break;
            case ContextTag.TYPE: result.setType(value); break;
            case ContextTag.ENUM: result.setEnum(value); break;
            case ContextTag.ENUM_VALUE: result.setEnumValue(value); break;

            // default:
                // assertUnreachable(value.context);
            }
        }
    }
}
