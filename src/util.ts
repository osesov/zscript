
export function addNewLine(str: string): string
{
    if (str === "")
        return "\n";

    if (str[str.length - 1] === '\n')
        return str;

    return str + "\n";
}

export const CommandBody = Symbol();
export const CommandHelp = Symbol();

export interface CommandTarget
{
    [CommandHelp]: string
    [CommandBody]: (args: string) => void
}

export interface CommandInfo
{
    [k: string]: CommandInfo | CommandTarget
};

export function getWord(str: string): [string, string]
{
    let buffer = ""
    let quote = ""
    let escape = false
    let pos;

    for(pos = 0; pos < str.length; pos++) {
        const c = str[pos];
        if (escape) {
            buffer += c
            escape = false
        }

        else if (c === '\\') {
            escape = true
        }

        else if (quote) {
            if (c === quote)
                quote = ""
            else
                buffer += c
        }

        else if (c === "'" || c === '"')
            quote = c

        else if (" \t\n\r".indexOf(c) >= 0) {
            if (buffer === "") // consume left
                continue;
            break
        }

        else
            buffer += c;
    }

    if (escape)
        throw new Error(`Incomplete escape in ${str}`)

    if (quote)
        throw new Error(`Incomplete string in ${str}`)

    return [buffer, str.substring(pos)];
}

export function executeCommand(command: CommandInfo | CommandTarget, str: string): void
{
    if (CommandBody in command) {
        return command[CommandBody](str);
    }

    const [name, rest] = getWord(str)
    const sub = command[name];

    if (!sub)
        throw new Error(`Unknown command at: ${str.trimStart()}`)

    executeCommand(sub, rest);
}

export function mergeCommands(...command: (CommandInfo | undefined)[]): CommandInfo
{
    // TODO: fix this should merge subcommands in depth, not overwrite it
    return Object.assign({}, ...command)
}

export function getCommandsHelp(commands: CommandInfo): string
{
    const align = (str: string, n: number) : string => {
        const append = Math.floor((str.length + n - 1) / n) * n - str.length;
        return str + Array(append).fill(' ').join('')
    }

    const calcWidth = (commands: CommandInfo, prefix: string) : number =>
    {
        let maxWidth = 0;

        for (const [name, body] of Object.entries(commands)) {
            const fullName: string = prefix + (prefix ? " " : "") + name;

            if (!body) {
            }
            else if (CommandBody in body) {
                if (fullName.length > maxWidth)
                    maxWidth = fullName.length;
            }

            else {
                const w = calcWidth(body, fullName);
                if (w > maxWidth)
                    maxWidth = w;
            }
        }

        return maxWidth
    }

    const printCommand = (commands: CommandInfo, prefix: string, width: number) : string =>
    {
        let buffer = ""

        for (const [name, body] of Object.entries(commands)) {
            const fullName: string = prefix + (prefix ? " " : "") + name;

            if (!body) {
            }
            else if (CommandBody in body) {
                const help = body[CommandHelp]


                buffer += align(fullName, width)
                if (help)
                    buffer += help;
                buffer += "\n"
            }

            else {
                const sub = printCommand(body, fullName, width);
                buffer += sub;
            }
        }

        return buffer;
    };

    return printCommand(commands, "", 2 + calcWidth(commands, ""));
}
