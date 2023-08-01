import * as net from 'net'
import { ZsDebugExchange } from '../ZsDebugExchange';
import { Logger } from '../ZsDebugger';
import { CommandInfo } from '../util';

export class ZsDebugExchangeTcp extends ZsDebugExchange
{
    private serverSocket: net.Server;
    private socket: net.Socket | null = null;
    private buffer: string = "";
    private logger: Logger

    constructor(logger: Logger, host ?: string, port ?: number)
    {
        super();

        this.logger = logger

        port ??= 2009;
        host ??= "localhost"

        this.logger.log(`Open TCP connection to ${host}:${port}`)
        this.serverSocket = net.createServer(this.connected.bind(this));
        this.serverSocket.listen(port, host, () => {
            this.logger.log('ZS debug listening on ' + host + ':' + (this.serverSocket!.address() as net.AddressInfo).port)
        });
    }

    public disconnect(): void {
        this.close();
    }

    private connected(sock: net.Socket)
    {
        const rAddr = sock.remoteAddress;
        const rPort = sock.remotePort

        this.logger.log(`zsDebug: connected ${rAddr ?? "unknown"}:${rPort ?? "unnown"}`);
        if (this.socket) {
            this.socket.end();
            this.socket = null
        }

        this.socket = sock;

        sock.on('data', this.onData.bind(this));
        sock.on('error', this.onError.bind(this));
        this.emit('connect');
    }

    private close()
    {
        this.socket?.end();
        this.socket = null;
    }

    private onData(data: Buffer)
    {
        this.logger.debug(`Got data: ${data}`);

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
        this.logger.error('******* ERROR ' + error + ' *******');
        this.close();
        this.emit('error', error)
    }

    public sendString(data: string)
    {
        if (!this.socket)
            return;

        this.logger.debug(`Send: ${data}`)
        this.socket.write(data);
    }

    public getCommands(): CommandInfo | undefined {
        return undefined
    }

};
