'use strict';
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, shell } = require('electron');
const path = require('node:path');
const { createLife } = require('./life.cjs');
const life = createLife();
const { createChatService } = require('./chat-service.cjs');
const { adjacentBounds, bubbleBounds, pointInside } = require('./window-layout.cjs');
const chat = createChatService({ getPetState: () => life.snapshot() });
let lifeTimer, cursorTimer;
let gazeEnabled = true;
const debug = process.env.PET_DEBUG === '1';
let lastActivity;
function diagnostic(message) { if (debug) console.log(`[pet] ${message}`); }
function viewState() { return { ...life.snapshot(), gazeEnabled, debug }; }
const SIZE = { width: 220, height: 240 };
let petWindow, hintWindow, chatWindow, connectionWindow, bubbleWindow, tray, drag;
let hintReady = false, chatReady = false, connectionReady = false, bubbleReady = false, hintShowTimer, hintHideTimer;
let chatRequested = false, connectionRequested = false, returnToComposer = false, chatGeneration = 0;
let composerHeight = 106, bubbleHeight = 98, bubbleSerial = 0, speechTimer;
let persistentSpeech = false;
let currentCaption = { kind: 'thought', text: 'hmm… what shall I do?' };
let currentBubble = { ...currentCaption, serial: 0, persistent: false, side: 'left' };
let pointerInsidePet = false;
let quitting = false;

function validSender(event) {
  return petWindow && !petWindow.isDestroyed() && event.sender === petWindow.webContents;
}
function senderIs(event, window) {
  return window && !window.isDestroyed() && event.sender === window.webContents;
}
function secureWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
}
function chatSnapshot() { return { status: chat.getStatus() }; }
function publishChat() {
  if (chatReady && !chatWindow.isDestroyed()) chatWindow.webContents.send('chat:state', chatSnapshot());
  if (connectionReady && !connectionWindow.isDestroyed()) connectionWindow.webContents.send('chat:state', chatSnapshot());
}
function placeBeside(window, size) {
  const petBounds = petWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(petBounds);
  window.setBounds(adjacentBounds(petBounds, size, workArea));
}
function positionBubble() {
  if (!bubbleReady) return;
  const petBounds = petWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(petBounds);
  const placed = bubbleBounds(petBounds, { width: 280, height: bubbleHeight }, workArea);
  const { side, ...bounds } = placed;
  if (currentBubble.side !== side) { currentBubble.side = side; bubbleWindow.webContents.send('bubble:side', side); }
  bubbleWindow.setBounds(bounds);
}
function displayBubble(content) {
  currentBubble = { ...content, serial: ++bubbleSerial, side: currentBubble.side };
  if (!bubbleReady) return;
  positionBubble(); bubbleWindow.webContents.send('bubble:state', currentBubble);
  if (!drag) bubbleWindow.showInactive();
}
function showSpoken(text, persistent = false) {
  if (persistentSpeech && !persistent) return;
  clearTimeout(speechTimer); persistentSpeech = persistent;
  displayBubble({ kind: 'speech', text, persistent });
  if (!persistent) speechTimer = setTimeout(() => { speechTimer = null; displayBubble(currentCaption); }, 3000);
}
function dismissSpeech() {
  clearTimeout(speechTimer); speechTimer = null; persistentSpeech = false;
  displayBubble(currentCaption);
}
function hideHint() {
  clearTimeout(hintShowTimer); clearTimeout(hintHideTimer);
  hintShowTimer = null; hintHideTimer = null;
  if (hintWindow && !hintWindow.isDestroyed()) hintWindow.hide();
}
function updateHint(point) {
  if (!hintReady || drag || chatWindow?.isVisible() || connectionWindow?.isVisible()) { hideHint(); return; }
  const visible = hintWindow.isVisible();
  const inHint = visible && pointInside(point, hintWindow.getBounds(), 5);
  if (pointerInsidePet || inHint) {
    clearTimeout(hintHideTimer); hintHideTimer = null;
    if (!visible && !hintShowTimer) hintShowTimer = setTimeout(() => {
      hintShowTimer = null;
      if (!pointerInsidePet || drag || chatWindow.isVisible() || connectionWindow.isVisible()) return;
      placeBeside(hintWindow, { width: 248, height: 46 }); hintWindow.showInactive();
    }, 300);
  } else {
    clearTimeout(hintShowTimer); hintShowTimer = null;
    if (visible && !hintHideTimer) hintHideTimer = setTimeout(hideHint, 400);
  }
}
function openChat() {
  hideHint(); chatRequested = true;
  if (!chatReady) return;
  placeBeside(chatWindow, { width: 270, height: composerHeight });
  publishChat(); chatWindow.show(); chatWindow.focus(); chatWindow.webContents.send('chat:opened');
}
function closeChat() { chatRequested = false; chatWindow.hide(); }
function openConnection(fromComposer = false) {
  hideHint(); connectionRequested = true; returnToComposer = fromComposer;
  if (chatReady) chatWindow.hide();
  if (!connectionReady) return;
  placeBeside(connectionWindow, { width: 338, height: 252 });
  publishChat(); connectionWindow.show(); connectionWindow.focus(); connectionWindow.webContents.send('connection:opened');
}
function closeConnection() {
  connectionRequested = false; connectionWindow.hide();
  if (returnToComposer) { returnToComposer = false; openChat(); }
}
function addEditingMenu(window) {
  window.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const flags = params.editFlags;
    const template = params.isEditable ? [
      { role: 'undo', enabled: flags.canUndo }, { role: 'redo', enabled: flags.canRedo }, { type: 'separator' },
      { role: 'cut', enabled: flags.canCut }, { role: 'copy', enabled: flags.canCopy },
      { role: 'paste', enabled: flags.canPaste }, { role: 'selectAll', enabled: flags.canSelectAll }
    ] : [{ role: 'copy', enabled: flags.canCopy }];
    Menu.buildFromTemplate(template).popup({ window, frame: params.frame });
  });
}
function companionWindow(size, title, focusable) {
  const window = new BrowserWindow({ ...size, title, frame: false, transparent: true,
    backgroundColor: '#00000000', hasShadow: false, resizable: false, minimizable: false,
    maximizable: false, fullscreenable: false, focusable, skipTaskbar: true, alwaysOnTop: true,
    show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  secureWindow(window);
  if (!focusable) window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  else addEditingMenu(window);
  return window;
}
function createCompanionWindows() {
  hintWindow = companionWindow({ width: 248, height: 46 }, 'Say something', false);
  hintWindow.webContents.on('did-finish-load', () => { hintReady = true; });
  hintWindow.loadFile(path.join(__dirname, 'renderer', 'hint.html'));
  chatWindow = companionWindow({ width: 270, height: 106 }, 'Your words', true);
  chatWindow.webContents.on('did-finish-load', () => {
    chatReady = true; publishChat(); if (chatRequested) openChat();
  });
  chatWindow.on('close', event => { if (!quitting) { event.preventDefault(); closeChat(); } });
  chatWindow.loadFile(path.join(__dirname, 'renderer', 'chat.html'));
  connectionWindow = companionWindow({ width: 338, height: 252 }, 'Connection', true);
  connectionWindow.webContents.on('did-finish-load', () => {
    connectionReady = true; publishChat(); if (connectionRequested) openConnection(returnToComposer);
  });
  connectionWindow.on('close', event => { if (!quitting) { event.preventDefault(); closeConnection(); } });
  connectionWindow.loadFile(path.join(__dirname, 'renderer', 'connection.html'));
  bubbleWindow = companionWindow({ width: 280, height: 98 }, 'Pet bubble', false);
  bubbleWindow.setIgnoreMouseEvents(true, { forward: true });
  bubbleWindow.webContents.on('did-finish-load', () => { bubbleReady = true; displayBubble(currentBubble); });
  bubbleWindow.loadFile(path.join(__dirname, 'renderer', 'bubble.html'));
}
function validPoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y)
    && Math.abs(point.x) <= 1000000 && Math.abs(point.y) <= 1000000;
}
function setMouseHandling() {
  petWindow.setIgnoreMouseEvents(!pointerInsidePet && !drag, { forward: true });
}
function publishLife() {
  const state = life.snapshot();
  if (state.activity !== lastActivity) { diagnostic(`activity=${state.activity} energy=${state.energy.toFixed(1)} manualNap=${state.manualNap}`); lastActivity = state.activity; }
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('pet:life', viewState());
}
function toggleSleep() {
  if (life.snapshot().activity === 'sleep') life.wake(); else life.nap();
  publishLife();
}
function startLife() {
  clearInterval(lifeTimer);
  clearInterval(cursorTimer);
  let previous = performance.now();
  lifeTimer = setInterval(() => {
    const now = performance.now();
    life.tick((now - previous) / 1000);
    previous = now;
    publishLife();
  }, 250);
  cursorTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const point = screen.getCursorScreenPoint();
    const bounds = petWindow.getBounds();
    // Electron returns both in DIP, even on Retina or mixed-scale displays.
    petWindow.webContents.send('pet:cursor', { x: point.x - bounds.x, y: point.y - bounds.y });
    updateHint(point);
    if (bubbleReady && bubbleWindow.isVisible()) {
      const bubbleBounds = bubbleWindow.getBounds();
      bubbleWindow.webContents.send('bubble:cursor', { x: point.x - bubbleBounds.x, y: point.y - bubbleBounds.y });
    }
  }, 1000 / 15);
}
function keepOnScreen(bounds) {
  const { workArea } = screen.getDisplayMatching(bounds);
  return {
    x: Math.round(Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - SIZE.width))),
    y: Math.round(Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - SIZE.height)))
  };
}
function showPet() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const position = keepOnScreen(petWindow.getBounds());
  petWindow.setPosition(position.x, position.y);
  petWindow.showInactive();
}
function menuTemplate(fixedSleepLabel = false) {
  return [
    { label: 'Chat', click: openChat },
    { label: 'Connection…', click: () => openConnection(false) },
    { label: fixedSleepLabel ? 'Nap / Wake' : life.snapshot().activity === 'sleep' ? 'Wake' : 'Nap', click: toggleSleep },
    { label: 'Gaze', type: 'checkbox', checked: gazeEnabled, click: () => { gazeEnabled = !gazeEnabled; publishLife(); refreshAppMenu(); } },
    { label: 'Bring back', click: () => {
      const { workArea } = screen.getPrimaryDisplay();
      petWindow.setPosition(workArea.x + workArea.width - SIZE.width - 40, workArea.y + workArea.height - SIZE.height - 24);
      showPet();
    } },
    { type: 'separator' },
    { label: 'Quit', accelerator: 'CommandOrControl+Q', click: () => app.quit() }
  ];
}
function showPetMenu() {
  const menu = Menu.buildFromTemplate(menuTemplate());
  const options = { window: petWindow };
  if (process.platform === 'darwin') {
    const point = screen.getCursorScreenPoint();
    const { workArea } = screen.getDisplayNearestPoint(point);
    const bounds = petWindow.getBounds();
    // Leave room for our compact menu near display edges. Native macOS still
    // chooses the final fit; popup coordinates are window-content-local DIP.
    const x = Math.round(Math.max(workArea.x + 8, Math.min(point.x, workArea.x + workArea.width - 180)) - bounds.x);
    const y = Math.round(Math.max(workArea.y + 8, Math.min(point.y, workArea.y + workArea.height - 220)) - bounds.y);
    // Electron reserves -1 as the "current mouse position" sentinel.
    options.x = x === -1 ? -2 : x;
    options.y = y === -1 ? -2 : y;
    options.positioningItem = -1;
  }
  menu.popup(options);
}
function refreshAppMenu() {
  // Native macOS text shortcuts depend on these standard editing roles.
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Desktop Pet', submenu: menuTemplate(true) },
    { role: 'editMenu' }
  ]));
}
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  petWindow = new BrowserWindow({
    ...SIZE,
    x: workArea.x + workArea.width - SIZE.width - 40,
    y: workArea.y + workArea.height - SIZE.height - 24,
    title: 'Nest Pet — Desktop Shell',
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    resizable: false, maximizable: false, fullscreenable: false, minimizable: false,
    focusable: false, skipTaskbar: true, alwaysOnTop: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false
    }
  });
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  secureWindow(petWindow);
  petWindow.webContents.on('did-finish-load', () => { diagnostic('renderer loaded'); startLife(); publishLife(); });
  petWindow.webContents.on('render-process-gone', (_event, details) => diagnostic(`renderer gone: ${details.reason}`));
  petWindow.webContents.on('did-fail-load', (_event, code, description) => diagnostic(`load failure ${code}: ${description}`));
  petWindow.on('ready-to-show', () => { setMouseHandling(); showPet(); });
  petWindow.on('move', () => {
    hideHint();
    if (chatWindow?.isVisible()) placeBeside(chatWindow, { width: 270, height: composerHeight });
    if (connectionWindow?.isVisible()) placeBeside(connectionWindow, { width: 338, height: 252 });
    positionBubble();
  });
  petWindow.on('close', event => { if (!quitting) { event.preventDefault(); app.quit(); } });
  petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('◉');
  tray.setToolTip('Nest Pet — controls and Quit');
  tray.on('click', () => tray.popUpContextMenu(Menu.buildFromTemplate(menuTemplate())));
  tray.on('right-click', () => tray.popUpContextMenu(Menu.buildFromTemplate(menuTemplate())));
}
ipcMain.handle('pet:initial-state', event => validSender(event) ? viewState() : null);
ipcMain.on('pet:diagnostic', (event, detail) => {
  if (!debug || !validSender(event) || !['video-ready', 'video-error', 'video-alpha', 'gaze-ready', 'gaze-error', 'attention-on', 'attention-off'].includes(detail?.kind)
    || !['idle', 'play-cube', 'play-cat', 'sleep-loop'].includes(detail?.clip)) return;
  if (detail.kind === 'video-alpha') {
    if (![detail.opaque, detail.transparent].every(n => Number.isInteger(n) && n >= 0 && n <= 14400)) return;
    diagnostic(`${detail.kind} clip=${detail.clip} opaque=${detail.opaque} transparent=${detail.transparent}`);
  } else diagnostic(`${detail.kind} clip=${detail.clip}`);
});
ipcMain.on('pet:hit-test', (event, inside) => {
  if (!validSender(event) || typeof inside !== 'boolean') return;
  pointerInsidePet = inside;
  setMouseHandling();
});
ipcMain.on('pet:interact', event => {
  if (!validSender(event)) return;
  life.interact();
  publishLife();
  showSpoken('oh, hello!', false);
});
ipcMain.on('pet:context-menu', event => {
  if (validSender(event)) showPetMenu();
});
ipcMain.on('pet:drag-start', (event, point) => {
  if (!validSender(event) || !validPoint(point) || drag) return;
  hideHint(); if (bubbleReady) bubbleWindow.hide();
  drag = { pointer: point, window: petWindow.getBounds() };
  life.setHeld(true);
  publishLife();
  setMouseHandling();
});
ipcMain.on('pet:drag-move', (event, point) => {
  if (!validSender(event) || !drag || !validPoint(point)) return;
  const proposed = { ...drag.window, x: drag.window.x + point.x - drag.pointer.x, y: drag.window.y + point.y - drag.pointer.y };
  if (!Number.isFinite(proposed.x) || !Number.isFinite(proposed.y)) return;
  const next = keepOnScreen(proposed);
  petWindow.setPosition(next.x, next.y);
});
ipcMain.on('pet:drag-end', event => {
  if (!validSender(event)) return;
  drag = null;
  life.setHeld(false);
  publishLife();
  if (bubbleReady) { positionBubble(); bubbleWindow.showInactive(); }
  setMouseHandling();
});
ipcMain.on('chat:open', event => {
  if (senderIs(event, hintWindow) || validSender(event)) openChat();
});
ipcMain.on('chat:close', event => { if (senderIs(event, chatWindow)) closeChat(); });
ipcMain.handle('chat:state', event => senderIs(event, chatWindow) || senderIs(event, connectionWindow) ? chatSnapshot() : null);
ipcMain.handle('chat:configure', (event, config) => {
  if (!senderIs(event, connectionWindow)) return { ok: false, error: 'Unavailable.' };
  const result = chat.configure(config); publishChat(); return result;
});
ipcMain.handle('chat:send', async (event, message) => {
  if (!senderIs(event, chatWindow)) return { ok: false, error: 'Unavailable.' };
  life.interact(); publishLife();
  const generation = chatGeneration;
  const pending = chat.send(message); publishChat();
  const result = await pending;
  if (generation !== chatGeneration) return { ok: false, code: 'cancelled', error: 'This reply was cancelled.' };
  publishChat();
  if (result.ok && typeof result.reply === 'string' && !petWindow.isDestroyed()) {
    showSpoken(result.reply, true);
  }
  return result;
});
ipcMain.on('chat:clear', event => {
  if (!senderIs(event, connectionWindow)) return;
  chatGeneration++; chat.clear(); dismissSpeech(); publishChat();
  if (chatReady) chatWindow.webContents.send('chat:cleared');
});
ipcMain.on('chat:key-help', event => {
  if (senderIs(event, connectionWindow)) shell.openExternal('https://aistudio.google.com/api-keys');
});
ipcMain.on('chat:resize', (event, height) => {
  if (!senderIs(event, chatWindow) || !Number.isFinite(height)) return;
  composerHeight = Math.max(106, Math.min(194, Math.ceil(height)));
  if (chatReady) placeBeside(chatWindow, { width: 270, height: composerHeight });
});
ipcMain.on('connection:open', event => { if (senderIs(event, chatWindow)) openConnection(true); });
ipcMain.on('connection:close', event => { if (senderIs(event, connectionWindow)) closeConnection(); });
ipcMain.on('pet:caption', (event, value) => {
  if (!validSender(event) || !['thought','action'].includes(value?.kind) || typeof value.text !== 'string' || value.text.length > 160) return;
  currentCaption = { kind: value.kind, text: value.text };
  if (!persistentSpeech && !speechTimer) displayBubble(currentCaption);
});
ipcMain.handle('bubble:state', event => senderIs(event, bubbleWindow) ? currentBubble : null);
ipcMain.on('bubble:resize', (event, value) => {
  if (!senderIs(event, bubbleWindow) || value?.serial !== currentBubble.serial || !Number.isFinite(value.height)) return;
  bubbleHeight = Math.max(54, Math.min(230, Math.ceil(value.height))); positionBubble();
});
ipcMain.on('bubble:interactive', (event, interactive) => {
  if (senderIs(event, bubbleWindow) && typeof interactive === 'boolean') bubbleWindow.setIgnoreMouseEvents(!interactive, { forward: true });
});
ipcMain.on('bubble:dismiss', event => { if (senderIs(event, bubbleWindow)) dismissSpeech(); });
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showPet);
  app.whenReady().then(() => {
    createWindow();
    createCompanionWindows();
    refreshAppMenu();
  });
  app.on('activate', showPet);
  app.on('before-quit', () => { quitting = true; chatGeneration++; chat.clear(); clearTimeout(speechTimer); hideHint(); clearInterval(lifeTimer); clearInterval(cursorTimer); tray?.destroy(); });
  app.on('window-all-closed', () => app.quit());
}
