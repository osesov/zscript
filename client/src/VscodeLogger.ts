/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogOutputChannel } from 'vscode';
import { LogEvent, LogLevel, LogMessageTemplate, LogSink, logSystem } from '../../zslib/src/logger';

export class VSCodeSink implements LogSink
{
    private outputChannel: LogOutputChannel
    private template : LogMessageTemplate

    private methods = new Map<LogLevel, (...args: any[]) => void>

    constructor(outputChannel: LogOutputChannel, template ?: string)
    {
        this.outputChannel = outputChannel
        this.template = logSystem.parseLogTemplate(template ?? "%n: %m")

        this.methods = new Map<LogLevel, (...args: any[]) => void>(
            [
                [LogLevel.OUTPUT, this.outputChannel.appendLine],
                [LogLevel.FATAL, this.outputChannel.error],
                [LogLevel.ERROR, this.outputChannel.error],
                [LogLevel.WARN, this.outputChannel.warn],
                [LogLevel.INFO, this.outputChannel.info],
                [LogLevel.DEBUG, this.outputChannel.debug],
            ]
        )
    }

    write(event: LogEvent): void {
        const str = logSystem.renderEvent(event, this.template);
        // this.outputChannel.appendLine(str);
        const method = (this.methods.get(event.level) ?? this.outputChannel.info).bind(this.outputChannel)
        method(str, ...event.properties._ ?? []);
    }

    flush(): void {
    }
}
