# debug protocol

listen port 2009

LF - 0x10
CR - 0x0D
NUL - 0x00

## Preamble

Client:

```text
l start<LF>
ver 2.<NUL>
```

## Debugger. Set Breakpoints

Resend the while set to change

```text
b<NUMBER-OF-BREAKPOINTS><LF>
<LINE> <FILE><LF>
... extra lines ...

```

Example

```text
b2
131 /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/gui/tcui/guide/GuideInfo.zs
383 /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/applications/channels/ChannelServiceLoader.zs
```

## Client: print log

```text
p [SYS] Renderer ready to use, area: 1280x720, drawable: 1280x720, renderer: software
```

## Client. Hit breakpoint

```text
b start<LF>
131 /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/gui/tcui/guide/GuideInfo.zs<LF>
<NUL>
```

## Debugger. Stacktrace

just a byte

```text
S
```

### Response

#### Start

```text
<LF>
Stack:<LF>
```

#### Frame

```text
--start:init(GroupSceneNode) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/gui/tcui/guide/GuideInfo.zs:131
parentGroupNode= obj 139832076551184
this= obj 139832076962432
```

1st line
"--": separate stack frames
start:init(GroupSceneNode): function name
FILE:LINE

2nd line and on: name= value

```text
parentGroupNode= obj 139832076551184
this= obj 139832076962432
filter= ""
mask= 512
```

obj line contains ObjID

### Example

```text
<LF>
Stack:<LF>
--start:init(GroupSceneNode) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/gui/tcui/guide/GuideInfo.zs:131<LF>
parentGroupNode= obj 139832076551184
this= obj 139832076962432
--native code
--start:createScreen(int,int) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/applications/overlays/tcui/Guide.zs:320
focusedChannel= 4
focusedTime= 1690475277
this= obj 139832091086096
group= obj 139832076901952
--start:activate(str,OnAppActivated) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/applications/overlays/tcui/Guide.zs:442
url= "app=guide&topMenuFocused=0"
onAppActivated= func 932029 obj 139832071362544
this= obj 139832091086096
channel= 4
time= 1690475277
filter= ""
player= obj 139832076339728
lineup= obj 139832076850160
mask= 512
values= 512
--native code
--start:changeOverlayApplication(str,OnAppChangedListener) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/applications/AppManager.zs:565
overlayUrl= "app=guide&topMenuFocused=0"
onAppChanged= 0
this= obj 139832071362544
operationId= 3
app= "guide"
currentAppBehaviors= 0
freeRAM= 268435456
lowMemory= 0
--native code
--start:changeOverlayApplication(str) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/applications/AppManager.zs:688
overlayUrl= "app=guide&topMenuFocused=0"
this= obj 139832071362544
--native code
--start:_key_postProcess(int) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/data/uilogic/tcui/TCUILogic.zs:1577
key= 10
this= obj 139832072023968
app= "null"
epglm= 0
--native code
--start:processKeyPress(bool,int,bool,int) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/data/KeyHandler.zs:588
keyDown= 1
key= 10
systemRepeat= 0
timestamp= 549469
this= obj 139832071385072
nameIndex= 50
keyEchoStr= "[KEY] Key press 10, KEY_G    , timestamp 549469"
currentUI= 512
processed= 0
--native code
--start:_sys_MainKeysHandler(bool,int,bool,int) /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/data/KeyHandler.zs:733
keyDown= 1
key= 10
systemRepeat= 0
timestamp= 549469
--start:onTickBegin() /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/framework/SysManager.zs:921
this= obj 139832060837696
newCount= 2
totalCount= 2
startProcessMs= 1690475277144
haveBudgetToProcess= 1
nonProcessedUICallbacks= 0
nonProcessedSDLEvents= 0
remainCount= 2
i= 0
evt= obj 139832060839072
eventType= 768
processed= 1
keyDown= 1
keyCode= 10
--start:onTick() /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/framework/SysManager.zs:1281
this= obj 139832060837696
--native code
```

## Debugger. Get Object data

```text
O<ObjID>
```

Example

```text
O139832091086096<LF>
```

Reply (lines separated by <LF>, terminated with <NUL>)

```text
_sc_: CGuideTCUI
holder: obj 139832076896832
zGroupNodePopups*: null
zGroupNodeChannels*: obj 139832076223152
zGroupNodePrograms*: obj 139832076948672
zGroupNodeInfo*: obj 139832076551184
zGroupNodeTopMenu*: obj 139832091417984
zGroupMouseControls*: null
zGroupNodeTimeLine*: obj 139832076937872
imgTV*: null
labelTV*: null
arrowUp: null
arrowDown: null
arrowLeft: null
arrowRight: null
shadowRight*: obj 139832076205120
shadowBottom*: obj 139832076802032
channels: null
programs: null
info: obj 139832076962432
timeline: null
topMenu: null
filters*: null
timeoutClick: null
filterMasks: obj 139832089103968
filterValues: obj 139832076747376
filterNames: obj 139832076753488
currentFilter: 0
countFavourites: 0
touchIdForScrollBoundsCheck: 0
loadingPopup*: null
_from: ""
_url: ""
_vm_: start
_addr_: 139832091086096
_cls_: Component
<NUL>
```

Open member is the same (example opens holder above - 139832076896832)

```text
O139832076896832
```

Reply

```text
_sc_: PtrSingleNode
_child: obj 139832076901952
paintChild*: obj 139832076901952
_parent*: null
_vm_: start
_addr_: 139832076896832
_cls_: Component
```

## Debugger. Step into

Debugger:

```text
d
```

Client:

```text
b start<LF>
2679 /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/framework/Scene.zs.
<NUL>
```

## Debugger. step

Debugger:

```text
s
```

Client:

```text
b start<LF>
2679 /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/framework/Scene.zs.
<NUL>
```

## Debugger. Step return

Debugger:

```text
u
```

Client:

```text
b start<LF>
2679 /home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts/framework/Scene.zs.
<NUL>


## Debugger. Continue

Debugger:

```text
g
```
