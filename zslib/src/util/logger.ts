/* eslint-disable @typescript-eslint/no-explicit-any */

import { assertUnreachable } from "./util";
import * as strftime from 'strftime'

export interface Logger {
    // eslint-disable-line
    output(msg: string, ...args: any[]): void;
    info(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
    debug(msg: string, ...args: any[]): void
}

export enum LogLevel {
    OUTPUT,
    FATAL,
    ERROR,
    WARN,
    INFO,
    DEBUG
}

export enum LogMessageItem {
    TIME,
    LEVEL,
    LOGGER,
    RAW_MESSAGE,
    RAW_DATA,
    MESSAGE,
}

export type LogMessageTemplate = (string | LogMessageItem)[]


export type LogJson = undefined | null | string | number | bigint | boolean | LogJson[] | { [k: string]: LogJson }
export type LogJsonObject = { [k: string]: LogJson }

export interface LogProperties
{
    [k: string]: any
    _?: any[]
}

export interface LogSink {
    write(event: LogEvent): void
    flush?(): void
}

interface TokenItem {
    name: string
    destructure: boolean
}

type Token = string | TokenItem

const re = /\{@?(\w+)\}/g

export class MessageTemplate {
    readonly raw: string
    readonly tokens: Token[]

    constructor(str: string) {
        const tokens: Token[] = []

        let pos = 0;
        let m: RegExpExecArray | null
        while ((m = re.exec(str)) !== null) {
            if (m.index !== pos)
                tokens.push(str.substring(pos, m.index))

            const destructure = m[0][1] === '@'
            const name = m[1]
            tokens.push({ name, destructure })
            pos = m.index + m[0].length
        }
        if (pos < str.length)
            tokens.push(str.substring(pos, str.length))

        this.tokens = tokens;
        this.raw = str;
    }
}

export interface LogEvent {
    time: Date
    logger: string
    level: LogLevel
    msg: string
    template: MessageTemplate
    properties: LogProperties
}

const logLevelName = new Map<LogLevel, string>(
    [
        [LogLevel.FATAL, "FTL"],
        [LogLevel.ERROR, "ERR"],
        [LogLevel.WARN, "WRN"],
        [LogLevel.INFO, "INF"],
        [LogLevel.DEBUG, "DBG"],
    ]
)

function buildEvent(name: string, level: LogLevel, msg: string, prop: any[]): LogEvent {
    const template = new MessageTemplate(msg)
    const logProperties: LogProperties = {}
    let index = 0

    for (const it of template.tokens) {
        if (typeof it === 'string')
            continue

        if (it.name === "") {
            it.name = String(index++)
        }

        const name = it.name
        logProperties[name] = prop.shift()
    }

    logProperties._ = prop.slice(0)

    return {
        logger: name,
        level: level,
        time: new Date,
        msg: msg,
        template: template,
        properties: logProperties
    }
}

export class ConsoleSink implements LogSink {
    private template: LogMessageTemplate

    private static methods = new Map<LogLevel, (...args: any[]) => void>(
        [
            [LogLevel.FATAL, console.error.bind(console)],
            [LogLevel.ERROR, console.error.bind(console)],
            [LogLevel.WARN, console.warn.bind(console)],
            [LogLevel.INFO, console.info.bind(console)],
            [LogLevel.DEBUG, console.debug.bind(console)],
        ]
    )

    constructor(template?: string) {
        this.template = logSystem.parseLogTemplate(template ?? "[%n] %m")
    }

    write(event: LogEvent): void {
        const str = logSystem.renderEvent(event, this.template);
        const method = ConsoleSink.methods.get(event.level) ?? console.log.bind(console)
        method(str, ...event.properties._ ?? []);
    }
}

export interface LogDestruct {
    msg: string
    extra: string[]
}

class LogSystem {
    private loggers: Map<string, Logger> = new Map
    private visibleLevel: LogLevel = LogLevel.INFO
    private sinks: LogSink[] = []
    private destructors = new Map<new () => any, (e: any) => LogDestruct>
    private serializers = new Map<new () => any, (e: any) => LogJson>
    private dumpStack: boolean = true
    private timeFormat: string = "%H:%M:%S"

    constructor() {
        this.addDestructor(Error, (e) => this.errorDestruct(e))
        this.addSerializer(Error, (e) => this.errorSerializer(e))

        this.addDestructor(Date, (e) => this.dateDestruct(e))
        this.addSerializer(Date, (e) => this.dateSerializer(e))
    }

    addSink(sink: LogSink) {
        this.sinks.push(sink)
    }

    setLevel(level: LogLevel) {
        this.visibleLevel = level
    }

    getLogger<T>(name: new (...args: any[]) => T): Logger;
    getLogger(name: string): Logger;
    getLogger<T>(name: string|(new (...args: any[]) => T)): Logger {
        const n = typeof name === "string" ? name : name.name
        const logger = this.loggers.get(n)
        if (logger)
            return logger

        const newLogger: Logger = {
            output: (msg: string, ...args: any[]) => this.logMessage(n, LogLevel.OUTPUT, msg, args),
            error: (msg: string, ...args: any[]) => this.logMessage(n, LogLevel.ERROR, msg, args),
            warn: (msg: string, ...args: any[]) => this.logMessage(n, LogLevel.WARN, msg, args),
            info: (msg: string, ...args: any[]) => this.logMessage(n, LogLevel.INFO, msg, args),
            debug: (msg: string, ...args: any[]) => this.logMessage(n, LogLevel.DEBUG, msg, args),
        }

        this.loggers.set(n, newLogger)
        return newLogger
    }

    logMessage(name: string, level: LogLevel, msg: string, prop: any[]) {
        if (level > this.visibleLevel)
            return

        const logEvent = buildEvent(name, level, msg, prop)

        for (const it of this.sinks) {
            try {
                it.write(logEvent)
            } catch (e: any) {
                console.error('Error in log write', e)
            }
        }
    }

    dumpErrorStack(state?: boolean) {
        this.dumpStack = state ?? true
    }

    dateDestruct(date: Date): LogDestruct {
        return {
            msg: strftime.default(this.timeFormat, date),
            extra: []
        }
    }

    dateSerializer(date: Date): LogJson {
        return {
            msec: date.getTime(),
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate(),
            hours: date.getHours(),
            minutes: date.getMinutes(),
            seconds: date.getSeconds(),
            milliseconds: date.getMilliseconds(),
        }
    }

    errorSerializer(e: Error): LogJson {
        const result: LogJson = {
            message: e.message,
            name: e.name
        }

        if (e.stack)
            result.stack = e.stack

        return result;
    }

    errorDestruct(e: Error): LogDestruct {
        const text = "[" + e.name + "]:" + e.message
        const data: string[] = []

        if (e.stack && this.dumpStack)
            data.push(e.stack)

        return {
            msg: text,
            extra: data
        }
    }

    public addDestructor<T>(constructor: new () => T, callback: (e: T) => LogDestruct) {
        this.destructors.set(constructor, callback)
    }

    public addSerializer<T>(constructor: new () => T, callback: (e: T) => LogJson) {
        this.serializers.set(constructor, callback)
    }

    private renderObject(destructure: boolean, data: any): LogDestruct {
        let result = ""
        const postStrings: string[] = []

        if (data === null || data === undefined) {
            result += String(data);
        }

        else if (data instanceof Error) {
            result += "[" + data.name + "]:" + data.message

            if (data.stack)
                postStrings.push(data.stack)
        }

        else if (destructure) {
            const destructor = this.destructors.get(data.constructor)

            if (destructor) {
                const x: LogDestruct = destructor(data)
                result += x.msg;
                postStrings.push(...x.extra)
            }
            else
                result += JSON.stringify(data)
        }
        else
            result += String(data)

        return {
            msg: result,
            extra: postStrings
        }
    }

    public render(message: MessageTemplate, properties: LogProperties): string {
        let result = ""
        const postStrings: string[] = []

        for (const it of message.tokens) {
            if (typeof it === "string")
                result += it
            else {
                const data: any = properties[it.name]
                const res = this.renderObject(it.destructure, data)

                result += res.msg
                postStrings.push( ... res.extra)
            }
        }

        if (properties.length > 0) {
            result += "\n";

            for (const it in properties) {
                const res = this.renderObject(true, it)
                result += "arg" + it + ": " + res.msg + "\n"

                postStrings.push(...res.extra);
            }
        }

        if (postStrings.length) {
            result += "\n" + postStrings.join("\n")
        }
        return result
    }

    public serializeEvent(event: LogEvent): LogJson {
        const result: LogJson = {
            time: this.serializeValue(event.time, null),
            logger: event.logger,
            level: logLevelName.get(event.level) ?? String(event.level),
            msg: event.msg,
            properties: this.serializeProperties(event.properties)
        }

        return result;
    }

    public renderEvent(event: LogEvent, template: LogMessageTemplate): string {
        let result = ""

        for (const it of template) {
            if (typeof it === "string")
                result += it

            else {
                switch (it) {
                    case LogMessageItem.LEVEL:
                        result += logLevelName.get(event.level) ?? String(event.level);
                        break

                    case LogMessageItem.LOGGER:
                        result += event.logger
                        break;

                    case LogMessageItem.TIME:
                        result += String(new Date)
                        break;

                    case LogMessageItem.MESSAGE:
                        result += this.render(event.template, event.properties)
                        break;

                    case LogMessageItem.RAW_MESSAGE:
                        result += event.template.raw
                        break;

                    case LogMessageItem.RAW_DATA:
                        result += JSON.stringify(event.properties)
                        break;

                    default:
                        assertUnreachable(it);
                }
            }
        }

        return result;
    }

    serializeValue(value: any, isArray: boolean | null): LogJson | undefined {
        switch (typeof value) {
            case 'string':
            case 'bigint':
            case 'boolean':
            case 'number':
                return value

            case 'undefined':
                return undefined;

            case 'symbol':
                return value.toString()

            case 'function':
                return undefined

            case 'object':
                {
                    const constructor = value.constructor;
                    const serializer = this.serializers.get(constructor);
                    if (serializer)
                        return serializer(value);

                    if ((isArray === null || isArray === true) && Array.isArray(value)) {
                        const result = []
                        for (const it of value) {
                            const val = this.serializeValue(it, null);
                            if (val === undefined)
                                continue
                            result.push(val);
                        }
                        return result;
                    }

                    if (isArray === true)
                        return undefined

                    const result: LogJson = {}

                    for (const it of Object.entries(value)) {
                        const val = this.serializeValue(it[1], null);
                        if (val)
                            result[String(it[0])] = val;
                    }

                    return result;
                }
        }
    }

    public serializeProperties(properties: LogProperties): LogJson {
        const entries = Object.entries(properties);

        if (properties.length === 0 && entries.length === 0)
            return undefined

        const props: LogJson = this.serializeValue(properties, false);
        const result: LogJsonObject = props && typeof props === "object" ? <LogJsonObject>props : {}

        const rExtra = this.serializeValue(properties._, true)
        if (Array.isArray(rExtra) && rExtra.length)
            result['_'] = rExtra;

        return result
    }

    parseLogTemplate(str: string): LogMessageTemplate {
        const re = /%[%tnlmMD]/g
        const result: LogMessageTemplate = []
        let m;
        let pos = 0;

        while ((m = re.exec(str)) != null) {
            if (pos != m.index)
                result.push(str.substring(pos, m.index));

            switch (m[0]) {
                case '%%': result.push("%"); break;
                case '%t': result.push(LogMessageItem.TIME); break;
                case '%n': result.push(LogMessageItem.LOGGER); break;
                case '%l': result.push(LogMessageItem.LEVEL); break;
                case '%m': result.push(LogMessageItem.MESSAGE); break;
                case '%M': result.push(LogMessageItem.RAW_MESSAGE); break;
                case '%D': result.push(LogMessageItem.RAW_DATA); break;
            }

            pos = m.index + m[0].length
        }

        if (pos != str.length)
            result.push(str.substring(pos));

        return result;
    }
}

export const logSystem = new LogSystem
