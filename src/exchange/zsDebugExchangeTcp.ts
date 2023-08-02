import * as net from 'net'
import { ZsDebugExchange } from '../ZsDebugExchange';
import { Logger } from '../ZsDebugger';
import { CommandInfo } from '../util';

export class ZsDebugExchangeTcp extends ZsDebugExchange
{
    private serverSocket: net.Server | null = null;
    private clientSocket: net.Socket | null = null;
    private buffer: string = "";
    private logger: Logger

    constructor(logger: Logger, private host ?: string, private port ?: number)
    {
        super();

        this.logger = logger

        port ??= 2009;
        host ??= "localhost"

    }

    public connect(): void
    {
        this.logger.core.info(`Open TCP connection to ${this.host}:${this.port}`)
        this.serverSocket = net.createServer(this.connected.bind(this));
        this.serverSocket.listen(this.port, this.host, () => {
            const addr = this.serverSocket!.address() as net.AddressInfo;
            this.logger.core.info('ZS debug listening on ' + addr.address + ':' + addr.port)
        });
    }

    public disconnect(): void {
        this.close();
    }

    private connected(sock: net.Socket)
    {
        const rAddr = sock.remoteAddress;
        const rPort = sock.remotePort

        this.logger.core.info(`zsDebug: connected ${rAddr ?? "unknown"}:${rPort ?? "unnown"}`);
        if (this.clientSocket) {
            this.clientSocket.destroy();
            this.clientSocket = null
        }

        this.clientSocket = sock;

        sock.on('data', this.onData.bind(this));
        sock.on('error', this.onError.bind(this));
        this.emit('connect');
    }

    private close()
    {
        this.clientSocket?.destroy();
        this.clientSocket = null;

        this.serverSocket?.close();
        this.serverSocket = null
    }

    private onData(data: Buffer)
    {
        this.logger.comm.debug(`Got data: ${data}`);

        for (let offs  = 0; offs < data.length; ++offs) {
            if (data.readInt8(offs) === 0) {
                const line = this.buffer
                this.buffer = ""
                super.emit('data', line);
            }

            else {
                this.buffer += data.toString('ascii', offs, offs+1);
            }
        }
    }

    private onError(error: Error)
    {
        this.logger.core.error('******* ERROR ' + error + ' *******');
        this.close();
        this.emit('error', error)
    }

    public sendString(data: string)
    {
        if (!this.clientSocket)
            return;

        this.logger.comm.debug(`Send: ${data}`)
        this.clientSocket.write(data);
    }

    public getCommands(): CommandInfo | undefined {
        return undefined
    }

};
