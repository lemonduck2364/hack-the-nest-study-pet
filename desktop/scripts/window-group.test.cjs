'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { fitPetBounds, adjacentBounds, bubbleBounds } = require('../src/window-layout.cjs');
const { DEFAULT_CHARACTER_ID } = require('../src/appearance-store.cjs');
const primary = { id: 1, workArea: { x:0,y:25,width:1440,height:875 } };
const secondary = { id: 2, workArea: { x:-1920,y:0,width:1920,height:1080 } };
async function boot({ service, savedAppearance = DEFAULT_CHARACTER_ID, userData = '/synthetic-test-user-data', realAppearance = false, lobbyNetwork } = {}) {
  const windows=[], timers=[], intervals=[], menu={};
  const lobbyTimers = new Map();
  let nextLobbyTimer = 0;
  let displays=[primary,secondary];
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options=options; this.bounds={x:0,y:0,...options}; this.visible=false; this.focuses=0;
      this.webContents=new EventEmitter();
      Object.assign(this.webContents,{mainFrame:{},send(){},setWindowOpenHandler(){},session:{setPermissionRequestHandler(){}},reload:()=>{this.reloads=(this.reloads||0)+1;}});
      windows.push(this);
    }
    isDestroyed(){return Boolean(this.destroyed);} getBounds(){return this.bounds;}
    setBounds(b){this.bounds={...this.bounds,...b};}
    setPosition(x,y){this.bounds.x=x;this.bounds.y=y;this.emit('move');}
    showInactive(){this.visible=true;} show(){this.visible=true;} isVisible(){return this.visible;}
    hide(){const was=this.visible;this.visible=false;if(was)this.emit('hide');} focus(){this.focuses++;}
    destroy(){this.destroyed=true;this.visible=false;this.emit('closed');}
    setIgnoreMouseEvents(){} async loadFile(){} setVisibleOnAllWorkspaces(){throw new Error('must not broadcast across Spaces');}
  }
  let initialize;
  const app=new EventEmitter();Object.assign(app,{requestSingleInstanceLock:()=>true,whenReady:()=>({then:fn=>{initialize=fn;}}),getPath:()=>userData,quit(){}});
  const screen=new EventEmitter();Object.assign(screen,{
    getPrimaryDisplay:()=>primary,getCursorScreenPoint:()=>({x:-500,y:500}),
    getDisplayNearestPoint:()=>displays.find(d=>d.id===2)||primary,
    getDisplayMatching:b=>b.x<0?(displays.find(d=>d.id===2)||primary):primary
  });
  const ipc=new EventEmitter();const handlers={};ipc.handle=(name,handler)=>{handlers[name]=handler;};
  class Tray extends EventEmitter {setTitle(){}setToolTip(){}destroy(){}}
  const electron={app,BrowserWindow:Window,Menu:{buildFromTemplate:t=>({items:t,popup(){}}),setApplicationMenu:m=>{menu.current=m;}},
    clipboard:{writeText(value){this.value=value;}},
    Tray,ipcMain:ipc,nativeImage:{createEmpty:()=>({})},screen,shell:{},powerMonitor:new EventEmitter()};
  const main=path.resolve(__dirname,'../src/main.cjs');
  const lobby = path.resolve(__dirname, '../src/lobby-controller.cjs');
  const lobbyModule = { exports: {} };
  if (lobbyNetwork) {
    vm.runInNewContext(fs.readFileSync(lobby, 'utf8'), {
      require: name => name === './lobby-network.cjs' ? lobbyNetwork : require(name),
      module: lobbyModule, __dirname: path.dirname(lobby), setImmediate,
      setTimeout: fn => { lobbyTimers.set(++nextLobbyTimer, fn); return nextLobbyTimer; },
      clearTimeout: id => lobbyTimers.delete(id)
    }, { filename: lobby });
  }
  vm.runInNewContext(fs.readFileSync(main,'utf8'),{
    require:name=>name==='electron'?electron:name==='./lobby-controller.cjs'&&lobbyNetwork?lobbyModule.exports:name==='./appearance-store.cjs'&&!realAppearance?{DEFAULT_CHARACTER_ID,createAppearanceStore:()=>({load:()=>savedAppearance,save:id=>{savedAppearance=id;}})}:name==='./credential-store.cjs'?{createCredentialStore:()=>({load:async()=>null,save:async()=>{},remove:async()=>{}})}:name==='./chat-service.cjs'?{createChatService:()=>service||({getStatus:()=>({ready:false}),restoreCredentials:async()=>{},clear(){}})}:require(name.startsWith('.')?path.resolve(path.dirname(main),name):name),
    __dirname:path.dirname(main),process:{env:{},platform:'darwin'},performance:{now:()=>0},console,
    setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},Date
  },{filename:main});
  await initialize();
  windows.forEach(w=>w.webContents.emit('did-finish-load'));
  return {windows,electron,timers,intervals,ipc,handlers,menu,lobbyTimers,savedAppearance:()=>savedAppearance,removeSecondary(){displays=[primary];screen.emit('display-removed',{},secondary);}};
}

test('only Connection can replace/remove credentials and async changes finish before returning success',async()=>{
  let restored=false,finishSave,finishRemove;
  const service={getStatus:()=>({ready:restored}),restoreCredentials:async()=>{restored=true;},clear(){},
    configure:()=>new Promise(resolve=>{finishSave=resolve;}),disconnect:()=>new Promise(resolve=>{finishRemove=resolve;})};
  const {windows,handlers}=await boot({service});
  assert.equal(restored,true);assert.equal(windows.length,5);
  for(const window of [windows[0],windows[2],windows[4]]) {
    assert.equal((await handlers['chat:configure']({sender:window.webContents},{})).ok,false);
    assert.equal((await handlers['chat:disconnect']({sender:window.webContents})).ok,false);
  }
  assert.equal(finishSave,undefined);assert.equal(finishRemove,undefined);
  let settled=false;
  const saved=handlers['chat:configure']({sender:windows[3].webContents},{}).then(result=>{settled=true;return result;});
  await Promise.resolve();assert.equal(settled,false);
  finishSave({ok:true});assert.equal((await saved).ok,true);
  const removed=handlers['chat:disconnect']({sender:windows[3].webContents});
  finishRemove({ok:true});assert.equal((await removed).ok,true);
});
test('companions belong to one pet; explicit input opens without making passive windows focusable',async()=>{
  const {windows,menu}=await boot();const [pet,hint,chat,connection,bubble]=windows;
  assert.equal(windows.length,5);
  for(const w of windows.slice(1)){assert.equal(w.options.parent,pet);assert.equal(w.options.modal,false);}
  assert.equal(pet.options.focusable,false);assert.equal(hint.options.focusable,false);assert.equal(bubble.options.focusable,false);
  assert.ok(menu.current.items.some(item=>item.role==='editMenu'), 'native copy/paste shortcuts stay available');
  for(const editable of [chat,connection]) assert.equal(editable.webContents.listenerCount('context-menu'),1);
  const entries=menu.current.items[0].submenu;
  entries.find(e=>e.label==='Chat').click();
  assert.ok(pet.visible && chat.visible);assert.equal(chat.focuses,1);assert.equal(pet.focuses,0);
  pet.hide();assert.ok(windows.every(w=>!w.visible));
  pet.webContents.emit('pet:unused');assert.equal(chat.visible,false);
});

test('appearance menu changes only appearance and persists selection while preserving sleep, energy and chat service',async()=>{
  let clears=0;
  const service={getStatus:()=>({ready:true,credentialState:'saved'}),restoreCredentials:async()=>{},clear:()=>{clears++;}};
  const h=await boot({service});const event={sender:h.windows[0].webContents};
  h.menu.current.items[0].submenu.find(e=>e.label==='Nap / Wake').click();
  const before=h.handlers['pet:initial-state'](event);
  h.menu.current.items[0].submenu.find(e=>e.label==='Dafeiyu').click();
  const after=h.handlers['pet:initial-state'](event);
  assert.equal(after.characterId,'dafeiyu');
  assert.deepEqual({...after,characterId:before.characterId},{...before});
  assert.equal(clears,0);assert.equal(h.savedAppearance(),'dafeiyu');
  h.menu.current.items[0].submenu.find(e=>e.label==='Red panda').click();
  assert.deepEqual(h.handlers['pet:initial-state'](event),before);
});

test('visible composer receives pointer presence outside its window without needing a mouseleave event',async()=>{
  const {windows,electron,intervals,menu}=await boot();
  const chat=windows[2], presence=[];
  chat.webContents.send=(channel,value)=>{if(channel==='chat:presence')presence.push(value.inside);};
  menu.current.items[0].submenu.find(e=>e.label==='Chat').click();
  const bounds=chat.getBounds();
  electron.screen.getCursorScreenPoint=()=>({x:bounds.x+10,y:bounds.y+10});
  intervals.at(-1)();
  electron.screen.getCursorScreenPoint=()=>({x:bounds.x-200,y:bounds.y-200});
  intervals.at(-1)();
  assert.deepEqual(presence,[true,false]);
  chat.hide();intervals.at(-1)();assert.deepEqual(presence,[true,false]);
});
test('renderer failure hides orphan windows, retries are bounded and requested composer reopens after load',async()=>{
  const {windows,timers,menu}=await boot();const [pet,,chat,,,]=windows;
  menu.current.items[0].submenu.find(e=>e.label==='Chat').click();
  for(let n=0;n<3;n++){
    pet.webContents.emit('render-process-gone',{}, {reason:'crashed'});
    assert.ok(windows.slice(1).every(w=>!w.visible));
    const retry=timers.shift();if(retry)retry();
    if(n<2){pet.webContents.emit('did-finish-load');assert.ok(chat.visible);}
  }
  assert.equal(pet.reloads,2);
});
test('Bring back moves the single group to cursor display; disconnect moves it wholly onto remaining display',async()=>{
  const {windows,menu,removeSecondary}=await boot();
  const entries=menu.current.items[0].submenu;
  entries.find(e=>e.label==='Chat').click();entries.find(e=>e.label==='Bring back').click();
  const [pet,,chat,,bubble]=windows;
  for(const w of [pet,chat,bubble]){assert.ok(w.bounds.x>=-1920);assert.ok(w.bounds.x+w.bounds.width<=0);}
  removeSecondary();
  for(const w of [pet,chat,bubble]){assert.ok(w.bounds.x>=0);assert.ok(w.bounds.x+w.bounds.width<=1440);}
});
test('single-display fit and attached layouts retain DIP coordinates at mixed monitor boundaries',()=>{
  const area=secondary.workArea;
  const pet=fitPetBounds({x:-100,y:1000,width:220,height:240},area);
  assert.deepEqual(pet,{x:-220,y:840,width:220,height:240});
  for(const bounds of [pet,adjacentBounds(pet,{width:270,height:106},area),bubbleBounds(pet,{width:280,height:230},area)]){
    assert.ok(bounds.x>=area.x && bounds.x+bounds.width<=0);
    assert.ok(bounds.y>=area.y && bounds.y+bounds.height<=1080);
  }
});

test('a delayed hover cannot reopen an orphan hint after the parent hides', async()=>{
  const {windows,timers,intervals,ipc}=await boot();
  const pet=windows[0];
  ipc.emit('pet:hit-test',{sender:pet.webContents},true);
  intervals.at(-1)();
  assert.equal(timers.length,1);
  pet.hide();
  timers.shift()();
  assert.ok(windows.every(w=>!w.visible));
});
test('expired bubbles stay hidden after dragging, Bring back and renderer recovery until genuinely new content',async()=>{
  const {windows,timers,ipc,menu}=await boot();const [pet,,,,bubble]=windows;
  const event={sender:pet.webContents},caption={kind:'thought',text:'a quiet moment'};
  ipc.emit('pet:caption',event,caption);assert.equal(bubble.visible,true);
  timers.shift()(); // Dwell ends; the renderer receives a fade phase.
  timers.shift()(); // Fade ends; main hides the native window.
  assert.equal(bubble.visible,false);
  ipc.emit('pet:drag-start',event,{x:500,y:500});ipc.emit('pet:drag-end',event);
  assert.equal(bubble.visible,false);
  menu.current.items[0].submenu.find(e=>e.label==='Bring back').click();assert.equal(bubble.visible,false);
  bubble.webContents.emit('did-finish-load');assert.equal(bubble.visible,false);
  pet.webContents.emit('render-process-gone',{}, {reason:'crashed'});
  timers.shift()();pet.webContents.emit('did-finish-load');assert.equal(bubble.visible,false);
  ipc.emit('pet:caption',event,caption);assert.equal(bubble.visible,false);
  ipc.emit('pet:caption',event,{kind:'action',text:'playing again'});assert.equal(bubble.visible,true);
});


test('actual appearance storage survives fresh main startup beside Chromium Preferences on case-insensitive Macs', async t => {
  const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'nest-main-appearance-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  // Reserve both spellings on case-sensitive systems too; on macOS they refer to the same file.
  for(const name of ['Preferences','preferences']) fs.writeFileSync(path.join(dir,name),'chromium-owned');
  const first=await boot({userData:dir,realAppearance:true});
  assert.equal(first.handlers['pet:initial-state']({sender:first.windows[0].webContents}).characterId,'red-panda');
  first.menu.current.items[0].submenu.find(e=>e.label==='Dafeiyu').click();
  const second=await boot({userData:dir,realAppearance:true});
  assert.equal(second.handlers['pet:initial-state']({sender:second.windows[0].webContents}).characterId,'dafeiyu');
  assert.equal(fs.readFileSync(path.join(dir,'Preferences'),'utf8'),'chromium-owned');
});

function openTestLobby(app) {
  app.menu.current.items[0].submenu.find(entry => entry.label === 'Visit Lobby').click();
  const window = app.windows.at(-1);
  window.emit('ready-to-show');
  const invoke = (channel, ...args) => app.handlers['lobby:' + channel]({
    sender: window.webContents, senderFrame: window.webContents.mainFrame
  }, ...args);
  return { window, invoke };
}

function lobbyProfile(t) {
  const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'nest-lobby-profile-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('hosting transfers the selected pet only after acknowledgement and Go Home restores the same window', async t => {
  const userData = lobbyProfile(t);
  const localInvite = '127.0.0.1:5173/deadbeef1234';
  const publicInvite = '192.168.1.10:5173/deadbeef1234';
  let closeCount = 0;
  const network = {
    startLobbyServer: async () => ({ invite: publicInvite, localInvite, close: async () => { closeCount++; } }),
    joinLobby: async (invite, { petId, appearance }) => {
      assert.equal(invite, localInvite);
      return { initialState: { pets: [{ id: petId, appearance, seat: 0 }], greeting: null } };
    }
  };
  const app = await boot({ userData, lobbyNetwork: network, savedAppearance: 'dafeiyu' });
  const [pet, , chat] = app.windows;
  app.menu.current.items[0].submenu.find(entry => entry.label === 'Chat').click();
  const { window, invoke } = openTestLobby(app);
  const identity = invoke('snapshot').selfId;
  assert.ok(identity);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(app.handlers['lobby:host']({ sender: pet.webContents, senderFrame: pet.webContents.mainFrame }), null);
  assert.equal(app.handlers['lobby:snapshot']({ sender: window.webContents, senderFrame: {} }), null);
  const hosting = invoke('host');
  assert.equal(invoke('snapshot').phase, 'joining');
  assert.equal(pet.visible, true);
  assert.equal(chat.visible, true);
  const room = await hosting;
  assert.equal(room.phase, 'room');
  assert.deepEqual(room.pets, [{ id: identity, appearance: 'dafeiyu', seat: 0 }]);
  assert.equal(pet.visible, false);
  assert.equal(chat.visible, false);
  app.electron.app.emit('activate');
  assert.equal(pet.visible, false);
  assert.equal(invoke('copy-invite'), true);
  assert.equal(app.electron.clipboard.value, publicInvite);
  invoke('go-home');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(window.isDestroyed(), true);
  assert.equal(pet.visible, true);
  assert.equal(chat.visible, false);
  assert.equal(app.windows.length, 6);
  assert.equal(closeCount, 1);
  assert.equal(app.lobbyTimers.size, 0);

  const restarted = await boot({ userData, lobbyNetwork: network });
  const reopened = openTestLobby(restarted);
  assert.equal(reopened.invoke('snapshot').selfId, identity);
  reopened.window.destroy();
});

test('failed join preserves the desktop; closing during a later join releases the late membership', async t => {
  let completeJoin, leaveCount = 0;
  const network = {
    joinLobby: invite => {
      if (invite === 'invalid') throw new Error('Enter a valid Lobby invite.');
      return new Promise(resolve => { completeJoin = resolve; });
    }
  };
  const app = await boot({ userData: lobbyProfile(t), lobbyNetwork: network });
  const [pet] = app.windows;
  const { invoke, window } = openTestLobby(app);
  const failed = await invoke('join', 'invalid');
  assert.equal(failed.phase, 'entry');
  assert.match(failed.error, /valid Lobby invite/);
  assert.equal(pet.visible, true);
  const joining = invoke('join', 'valid');
  await Promise.resolve();
  window.destroy();
  completeJoin({ leave: async () => { leaveCount++; } });
  assert.equal(await joining, null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pet.visible, true);
  assert.equal(leaveCount, 1);
  assert.equal(app.lobbyTimers.size, 0);
});

test('a losing Lobby connection closes its window and returns the original pet', async t => {
  let leaveCount = 0;
  const network = {
    joinLobby: async (_invite, { petId, appearance }) => ({
      initialState: { pets: [{ id: petId, appearance, seat: 0 }], greeting: null },
      pulse: async () => { throw new Error('Host closed the Lobby.'); },
      leave: async () => { leaveCount++; }
    })
  };
  const app = await boot({ userData: lobbyProfile(t), lobbyNetwork: network });
  const [pet] = app.windows;
  const { invoke, window } = openTestLobby(app);
  assert.equal((await invoke('join', 'invite')).phase, 'room');
  assert.equal(pet.visible, false);
  await [...app.lobbyTimers.values()][0]();
  assert.equal(window.isDestroyed(), true);
  assert.equal(pet.visible, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(leaveCount, 1);
});
