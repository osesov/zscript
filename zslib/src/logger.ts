import { Position } from "./lang";

export interface FilePosition extends Position
{
    fileName: string
}

export interface Logger
{
    info(msg: string, position?: FilePosition): void;
    warn(msg: string, position?: FilePosition): void;
    error(msg: string, ...args: any[]): void;
    debug(msg: string): void
}
