import { ZsDebugExchange, ZsDebugExchangeEvents } from '../ZsDebugExchange';
import { CommandBody, CommandHelp, CommandInfo, getWord } from '../util';

const file1Name = '/home/osesov/zodiac/vscode/zscript/sampleWorkspace/main.zs';
const file2Name = '/home/osesov/zodiac/vscode/zscript/sampleWorkspace/util.zs';

const file1Line1 = 1;
const file1Line2 = 2;
const file1Line3 = 3;
const file1Line4 = 4;

const file2line1 = 3;

function stackTrace(line: number)
{
    return [
        '',
        'Stack:',
        `--start:init(GroupSceneNode) ${file1Name}:${line}`,
        'parentGroupNode= obj 140305395197040',
        'this= obj 140305395338096',
        '--native code',
        '--start:createScreen(int,int) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/applications/overlays/tcui/Guide.zs:320',
        'focusedChannel= 4',
        'focusedTime= 1690476972',
        'this= obj 140305395518560',
        'group= obj 140305395300080',
        '--start:activate(str,OnAppActivated) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/applications/overlays/tcui/Guide.zs:442',
        'url= "app=guide&topMenuFocused=0"',
        'onAppActivated= func 932029 obj 140305390180064',
        'this= obj 140305395518560',
        'channel= 4',
        'time= 1690476972',
        'filter= ""',
        'player= obj 140305395134976',
        'lineup= obj 140305394828656',
        'mask= 512',
        'values= 512',
        '--native code',
        '--start:changeOverlayApplication(str,OnAppChangedListener) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/applications/AppManager.zs:565',
        'overlayUrl= "app = guide & topMenuFocused=0"',
        'onAppChanged= 0',
        'this= obj 140305390180064',
        'operationId= 3',
        'app= "guide"',
        'currentAppBehaviors= 0',
        'freeRAM= 268435456',
        'lowMemory= 0',
        '--native code',
        '--start:changeOverlayApplication(str) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/applications/AppManager.zs:688',
        'overlayUrl= "app = guide & topMenuFocused=0"',
        'this= obj 140305390180064',
        '--native code',
        '--start:_key_postProcess(int) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/data/uilogic/tcui/TCUILogic.zs:1577',
        'key= 10.this= obj 140305390839936',
        'app= "null"',
        'epglm= 0',
        '--native code',
        '--start:processKeyPress(bool,int,bool,int) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/data/KeyHandler.zs:588',
        'keyDown= 1',
        'key= 10',
        'systemRepeat= 0',
        'timestamp= 248543',
        'this= obj 140305390202592',
        'nameIndex= 50',
        'keyEchoStr= "[KEY] Key press 10, KEY_G, timestamp 248543"',
        'currentUI= 512',
        'processed= 0',
        '--native code',
        '--start:_sys_MainKeysHandler(bool,int,bool,int) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/data/KeyHandler.zs:733',
        'keyDown= 1',
        'key= 10',
        'systemRepeat= 0',
        'timestamp= 248543',
        '--start:onTickBegin() /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/framework/SysManager.zs:921',
        'this= obj 140305379655568',
        'newCount= 2',
        'totalCount= 2',
        'startProcessMs= 1690476972334',
        'haveBudgetToProcess= 1',
        'nonProcessedUICallbacks= 0',
        'nonProcessedSDLEvents= 0',
        'remainCount= 2',
        'i= 0',
        'evt= obj 140305379656944',
        'eventType= 768',
        'processed= 1',
        'keyDown= 1',
        'keyCode= 10',
        '--start:onTick() /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/framework/SysManager.zs:1281',
        'this= obj 140305379655568',
        '--native code'
    ].join('\n')
}

const variables: string = [
    '_sc_: CGuideTCUIInfo',
    'zGroupNode*: null',
    'zLabelTitle*: null',
    'zDetailsProgramIconsLeft*: null',
    'zDetailsProgramIconsRight*: null',
    'hint: null',
    'zLabelAirTimeInfo*: null',
    'description: null',
    'poster: null',
    'titleText: ""',
    'detailsIconsLeft: ""',
    'detailsIconsRight: ""',
    'iconsWidthLeft: 0',
    'iconsWidthRight: 0',
    'airTimeDataText: ""',
    'descriptionText: ""',
    'epg*: null',
    '_dcn: 0',
    '_chFlags: 0',
    '_progOptions: 0',
    'space: ""',
    '_startTime: 0',
    '_duration: 0',
    'imageUrl: ""',
    'needToUpdateData: 0',
    'buttonsHolder*: null',
    '_turboMode: 0',
    '_nodataMode: 0',
    '_vm_: start',
    '_addr_: 140305395338096',
    '_cls_: Component'
].join('\n')


export class ZsDebugExchangeSim extends ZsDebugExchange {
    constructor() {
        super()
    }

    private currentLine = 1;

    private emitEvent<K extends keyof ZsDebugExchangeEvents>(name: K, ...data: Parameters<ZsDebugExchangeEvents[K]>): void
    {
        Promise.resolve().then(() => this.emit(name, ...data));
    }

    public disconnect(): void
    {

    }

    public sendString(data: string): void
    {
        switch (data[0]) {
        case 'b': // set breakpoints
            break;

        case 'S':
            this.emitEvent('data', stackTrace(this.currentLine++));
            break;

        case 'O':
            this.emitEvent('data', variables);
            break;

        case 'G':
            this.emitEvent('data', variables);
            break;

        case 'd': // step into
            this.emitEvent('data', `b start\n${file1Line2} ${file1Name}\n`);
            break;

        case 's': // step
            this.emitEvent('data', `b start\n${file1Line3} ${file1Name}\n`);
            break;

        case 'u': // step out
            this.emitEvent('data', `b start\n${file1Line4} ${file1Name}\n`);
            break;

        case 'g': // go
            break;

        case '!': // disconnect
            break;

        case 'R': // dump roots
        case 'D': // func name?
        }
    }

    public getCommands(): CommandInfo {
        return {
            'sim': {
                'connect': {
                    [CommandHelp]: "Simulate connect request",
                    [CommandBody]: () => {
                        this.emitEvent('connect');
                        this.emitEvent('data', "l start\nver 2");
                    },
                },
                'data': {
                    [CommandHelp]: "Simulate data coming from debuggee",
                    [CommandBody]: (text) => {
                        this.emitEvent('data', text);
                    },
                },

                'error': {
                    [CommandHelp]: "Simulate error message",
                    [CommandBody]: (text) => this.emitEvent('error', Error(text)),
                },

                'print': {
                    [CommandHelp]: "Simulate print request",
                    [CommandBody]: (text) => this.emitEvent('data', text || "p [SYS] Renderer ready to use, area: 1280x720, drawable: 1280x720, renderer: software\n"),
                },
                'stop': {
                    [CommandHelp]: "Simulate stop signal",
                    [CommandBody]: (line: string) => {
                        if (line)
                            this.currentLine = Number(line);
                        this.emitEvent('data', `b start\n${this.currentLine} ${file1Name}\n`);
                    },
                }
            }
        }
    }
};
