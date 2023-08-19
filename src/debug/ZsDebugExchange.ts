import { EventEmitter } from 'events'
import { TypedEmitter } from 'tiny-typed-emitter';
import { CommandInfo } from './util';

const simulator = true;

export interface ZsDebugExchangeEvents
{
    'connect': () => void
    'disconnect': () => void
    'data': (data: string) => void
    'error': (data: Error) => void
}

export abstract class ZsDebugExchange extends TypedEmitter<ZsDebugExchangeEvents>
{
    abstract connect(): void
    abstract sendString(data: string): void;
    abstract disconnect(): void;
    abstract getCommands(): CommandInfo | undefined;
};
