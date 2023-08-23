import { OutputChannel } from 'vscode';
import { FilePosition, Logger } from '../../zslib/src/logger';

function formatMessage(msg: string, ...args: any[]): string
{
    const seen = new Set<number>
    const text = msg.replace(/\{(\d+)\}/g, function(a) {
        const indexStr = a.match(/(\d+)/g)
        if (!indexStr)
            return

        const index = parseInt(indexStr[0])
        seen.add(index);

        return args[index];
    });

    let suffix = ""
    for (let i = 0; i < args.length; ++i) {
        if (seen.has(i))
            continue

        if (suffix != "")
            suffix += ", "
        suffix += String(args[i])
    }

    if (suffix)
        suffix = " [" + suffix + "]"

    return text + suffix;
}

export class VscodeLogger implements Logger
{
    private outputChannel: OutputChannel

    constructor(outputChannel: OutputChannel)
    {
        this.outputChannel = outputChannel
    }

    info(msg: string, position?: FilePosition): void
    {
        this.outputChannel.appendLine('[INF]: ' + msg);
    }

    warn(msg: string, position?: FilePosition): void
    {
        this.outputChannel.appendLine('[WRN]: ' + msg);
    }

    error(msg: string, ...args: any[]): void
    {
        this.outputChannel.appendLine('[ERR]: ' + formatMessage(msg, args));
        this.outputChannel.show(true)
    }

    debug(msg: string, position?: FilePosition): void
    {
        this.outputChannel.appendLine('[DBG]: ' + msg);
        this.outputChannel.show(true)
    }
}
