'use strict';
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, shell, powerMonitor, safeStorage } = require('electron');
const path = require('node:path');
const { createLife } = require('./life.cjs');
const life = createLife();
const { createChatService } = require('./chat-service.cjs');
const { createCredentialStore } = require('./credential-store.cjs');
const { dafeiyu } = require('./renderer/character-pack.js');
const { createBubbleScheduler } = require('./bubble-scheduler.cjs');
const { adjacentBounds, bubbleBounds, pointInside, fitPetBounds } = require('./window-layout.cjs');
let credentialStore;
const chat = createChatService({ getPetState: () => life.snapshot(), keyStore: {
  load: () => credentialStore.load(), save: key => credentialStore.save(key), remove: () => credentialStore.remove(),
} });
let lifeTimer, cursorTimer;
let gazeEnabled = true;
const debug = process.env.PET_DEBUG === '1';
let lastActivity;
function diagnostic(message) { if (debug) console.log(`[pet] ${message}`); }
function viewState() {
  return { ...life.snapshot(), gazeEnabled, cursorPlayAllowed: !chatWindow?.isVisible() && !connectionWindow?.isVisible(), debug };
}
const SIZE = { width: 220, height: 240 };
let petWindow, hintWindow, chatWindow, connectionWindow, bubbleWindow, tray, drag;
let hintReady = false, chatReady = false, connectionReady = false, bubbleReady = false, hintShowTimer, hintHideTimer;
let chatRequested = false, connectionRequested = false, returnToComposer = false, chatGeneration = 0;
let composerHeight = 48, bubbleHeight = 98;
let bubbleAnchor = { x: 105, y: 64 };
let currentBubble = { kind: 'thought', text: '', serial: 0, version: 0, phase: 'hidden', persistent: false, side: 'left' };
const bubbles = createBubbleScheduler({ now: () => Date.now(), setTimer: setTimeout, clearTimer: clearTimeout, onChange: displayBubble });
let pointerInsidePet = false;
let quitting = false;
let petReady = false, recoveryTimer, recoveryAttempts = 0, recoverySince = 0;

function repositionCompanions() {
  hideHint();
  if (chatWindow?.isVisible()) placeBeside(chatWindow, { width: 270, height: composerHeight });
  if (connectionWindow?.isVisible()) placeBeside(connectionWindow, { width: 338, height: 340 });
  positionBubble();
}
function recoverPetRenderer() {
  if (quitting || !petWindow || petWindow.isDestroyed() || recoveryTimer) return;
  petReady = false; pointerInsidePet = false; drag = null; life.setHeld(false); life.setMotionPending(false); setMouseHandling();
  for (const window of [hintWindow, bubbleWindow, chatWindow, connectionWindow]) window?.hide();
  const now = Date.now();
  if (now - recoverySince > 60000) { recoveryAttempts = 0; recoverySince = now; }
  if (recoveryAttempts >= 2) return;
  recoveryAttempts++;
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    if (!quitting && !petWindow.isDestroyed()) petWindow.webContents.reload();
  }, 500);
}

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
  const placed = bubbleBounds(petBounds, { width: 200, height: bubbleHeight }, workArea, bubbleAnchor);
  const { side, ...bounds } = placed;
  if (currentBubble.side !== side) { currentBubble.side = side; bubbleWindow.webContents.send('bubble:side', side); }
  bubbleWindow.setBounds(bounds);
}
function displayBubble(content) {
  currentBubble = { ...content, side: currentBubble.side };
  diagnostic(`bubble=${currentBubble.kind} phase=${currentBubble.phase} serial=${currentBubble.serial}`);
  if (!bubbleReady || bubbleWindow.isDestroyed()) return;
  positionBubble(); bubbleWindow.webContents.send('bubble:state', currentBubble);
  if (currentBubble.phase === 'hidden') {
    bubbleWindow.setIgnoreMouseEvents(true, { forward: true }); bubbleWindow.hide();
  } else if (currentBubble.phase === 'visible') syncBubbleVisibility();
}
function syncBubbleVisibility() {
  if (!bubbleReady || bubbleWindow.isDestroyed()) return;
  if (currentBubble.phase === 'visible' && !drag && petReady && petWindow.isVisible()) bubbleWindow.showInactive();
  else if (currentBubble.phase !== 'fading' || !petReady || drag || !petWindow.isVisible()) bubbleWindow.hide();
}
function showSpoken(text, reply = false) { bubbles.speak(text, reply); }
function dismissSpeech(serial) { bubbles.dismiss(serial); }
function hideHint() {
  clearTimeout(hintShowTimer); clearTimeout(hintHideTimer);
  hintShowTimer = null; hintHideTimer = null;
  if (hintWindow && !hintWindow.isDestroyed()) hintWindow.hide();
}
function updateHint(point) {
  if (!petReady || !petWindow.isVisible() || !hintReady || drag || chatWindow?.isVisible() || connectionWindow?.isVisible()) { hideHint(); return; }
  const visible = hintWindow.isVisible();
  const inHint = visible && pointInside(point, hintWindow.getBounds(), 5);
  if (pointerInsidePet || inHint) {
    clearTimeout(hintHideTimer); hintHideTimer = null;
    if (!visible && !hintShowTimer) hintShowTimer = setTimeout(() => {
      hintShowTimer = null;
      if (!petReady || !petWindow.isVisible() || !pointerInsidePet || drag || chatWindow.isVisible() || connectionWindow.isVisible()) return;
      placeBeside(hintWindow, { width: 248, height: 46 }); hintWindow.showInactive();
    }, 300);
  } else {
    clearTimeout(hintShowTimer); hintShowTimer = null;
    if (visible && !hintHideTimer) hintHideTimer = setTimeout(hideHint, 400);
  }
}
function openChat() {
  hideHint(); chatRequested = true;
  showPet();
  if (!chatReady || !petReady) return;
  placeBeside(chatWindow, { width: 270, height: composerHeight });
  publishChat(); chatWindow.show(); chatWindow.focus(); chatWindow.webContents.send('chat:opened');
}
function closeChat() { chatRequested = false; chatWindow.hide(); }
function openConnection(fromComposer = false) {
  hideHint(); connectionRequested = true; returnToComposer = fromComposer;
  showPet();
  if (chatReady) chatWindow.hide();
  if (!connectionReady || !petReady) return;
  placeBeside(connectionWindow, { width: 338, height: 340 });
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
  const window = new BrowserWindow({ ...size, title, parent: petWindow, modal: false, frame: false, transparent: true,
    backgroundColor: '#00000000', hasShadow: false, resizable: false, minimizable: false,
    maximizable: false, fullscreenable: false, focusable, skipTaskbar: true, alwaysOnTop: true,
    show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  secureWindow(window);
  // A single parent/child group stays in one Space and on the pet's display.
  if (focusable) addEditingMenu(window);
  return window;
}
function createCompanionWindows() {
  hintWindow = companionWindow({ width: 248, height: 46 }, 'Say something', false);
  hintWindow.webContents.on('did-finish-load', () => { hintReady = true; });
  hintWindow.loadFile(path.join(__dirname, 'renderer', 'hint.html'));
  chatWindow = companionWindow({ width: 270, height: 48 }, 'Your words', true);
  chatWindow.webContents.on('did-finish-load', () => {
    chatReady = true; publishChat(); if (chatRequested) openChat();
  });
  chatWindow.on('close', event => { if (!quitting) { event.preventDefault(); closeChat(); } });
  chatWindow.loadFile(path.join(__dirname, 'renderer', 'chat.html'));
  connectionWindow = companionWindow({ width: 338, height: 340 }, 'Connection', true);
  connectionWindow.webContents.on('did-finish-load', () => {
    connectionReady = true; publishChat(); if (connectionRequested) openConnection(returnToComposer);
  });
  connectionWindow.on('close', event => { if (!quitting) { event.preventDefault(); closeConnection(); } });
  connectionWindow.loadFile(path.join(__dirname, 'renderer', 'connection.html'));
  bubbleWindow = companionWindow({ width: 200, height: 98 }, 'Pet bubble', false);
  bubbleWindow.setIgnoreMouseEvents(true, { forward: true });
  bubbleWindow.webContents.on('did-finish-load', () => { bubbleReady = true; displayBubble({ ...bubbles.snapshot() }); });
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
  if (petReady && petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('pet:life', viewState());
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
    if (!petReady || !petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;
    const point = screen.getCursorScreenPoint();
    const bounds = petWindow.getBounds();
    // Electron returns both in DIP, even on Retina or mixed-scale displays.
    petWindow.webContents.send('pet:cursor', { x: point.x - bounds.x, y: point.y - bounds.y });
    if (chatReady && chatWindow.isVisible()) {
      chatWindow.webContents.send('chat:presence', { inside: pointInside(point, chatWindow.getBounds()) });
    }
    updateHint(point);
    if (bubbleReady && bubbleWindow.isVisible()) {
      const bubbleBounds = bubbleWindow.getBounds();
      bubbleWindow.webContents.send('bubble:cursor', { x: point.x - bubbleBounds.x, y: point.y - bubbleBounds.y });
    }
  }, 1000 / 15);
}
function keepOnScreen(bounds) {
  const { workArea } = screen.getDisplayMatching(bounds);
  // Reserve enough room for the compact bubble directly over the head.
  return fitPetBounds(bounds, workArea, 164);
}
function showPet() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const position = keepOnScreen(petWindow.getBounds());
  petWindow.setPosition(position.x, position.y);
  petWindow.showInactive();
  repositionCompanions();
  syncBubbleVisibility();
}
function menuTemplate(fixedSleepLabel = false) {
  return [
    { label: 'Chat', click: openChat },
    { label: 'Connection…', click: () => openConnection(false) },
    { label: fixedSleepLabel ? 'Nap / Wake' : life.snapshot().activity === 'sleep' ? 'Wake' : 'Nap', click: toggleSleep },
    { label: 'Eye tracking', type: 'checkbox', checked: gazeEnabled, click: () => { gazeEnabled = !gazeEnabled; publishLife(); refreshAppMenu(); } },
    { label: 'Bring back', click: () => {
      const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      petWindow.setPosition(workArea.x + workArea.width - SIZE.width - 40, workArea.y + workArea.height - SIZE.height - 24);
      if (!petReady) { recoveryAttempts = 0; recoverPetRenderer(); }
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
  secureWindow(petWindow);
  petWindow.webContents.on('did-finish-load', () => {
    petReady = true; diagnostic('renderer loaded'); startLife(); publishLife(); showPet();
    if (connectionRequested) openConnection(returnToComposer);
    else if (chatRequested) openChat();
  });
  petWindow.webContents.on('render-process-gone', (_event, details) => {
    diagnostic(`renderer gone: ${details.reason}`); recoverPetRenderer();
  });
  petWindow.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) { diagnostic(`load failure ${code}`); recoverPetRenderer(); }
  });
  petWindow.on('ready-to-show', () => { setMouseHandling(); showPet(); });
  petWindow.on('move', repositionCompanions);
  petWindow.on('hide', () => {
    pointerInsidePet = false; drag = null; life.setHeld(false); setMouseHandling();
    hideHint(); bubbleWindow?.hide(); chatWindow?.hide(); connectionWindow?.hide();
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
ipcMain.on('pet:motion-pending', (event, pending) => {
  if (validSender(event) && typeof pending === 'boolean') life.setMotionPending(pending);
});
ipcMain.on('pet:diagnostic', (event, detail) => {
  if (!debug || !validSender(event) || !['video-ready', 'video-error', 'video-alpha', 'gaze-ready', 'gaze-error', 'attention-on', 'attention-off', 'clip-visible', 'reaction-start', 'reaction-end'].includes(detail?.kind)
    || !(Object.hasOwn(dafeiyu.clips, detail?.clip) || detail?.clip === 'attention-look')) return;
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
  if (bubbleReady) { positionBubble(); syncBubbleVisibility(); }
  setMouseHandling();
});
ipcMain.on('chat:open', event => {
  if (senderIs(event, hintWindow) || validSender(event)) openChat();
});
ipcMain.on('chat:close', event => { if (senderIs(event, chatWindow)) closeChat(); });
ipcMain.handle('chat:state', event => senderIs(event, chatWindow) || senderIs(event, connectionWindow) ? chatSnapshot() : null);
ipcMain.handle('chat:configure', async (event, config) => {
  if (!senderIs(event, connectionWindow)) return { ok: false, error: 'Unavailable.' };
  const pending = chat.configure(config); publishChat();
  const result = await pending; publishChat(); return result;
});
ipcMain.handle('chat:disconnect', async event => {
  if (!senderIs(event, connectionWindow)) return { ok: false, error: 'Unavailable.' };
  const pending = chat.disconnect(); publishChat();
  const result = await pending;
  if (result.ok) {
    chatGeneration++; dismissSpeech();
    if (chatReady) chatWindow.webContents.send('chat:cleared');
  }
  publishChat(); return result;
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
  composerHeight = Math.max(48, Math.min(194, Math.ceil(height)));
  if (chatReady) placeBeside(chatWindow, { width: 270, height: composerHeight });
});
ipcMain.on('connection:open', event => { if (senderIs(event, chatWindow)) openConnection(true); });
ipcMain.on('connection:close', event => { if (senderIs(event, connectionWindow)) closeConnection(); });
ipcMain.on('pet:caption', (event, value) => {
  if (!validSender(event) || !['thought','action'].includes(value?.kind) || typeof value.text !== 'string' || value.text.length > 160) return;
  const anchor = value.anchor;
  if (Number.isFinite(anchor?.x) && Number.isFinite(anchor?.y) && anchor.x >= 40 && anchor.x <= 180 && anchor.y >= 20 && anchor.y <= 180) {
    bubbleAnchor = { x: anchor.x, y: anchor.y }; positionBubble();
  }
  bubbles.caption({ kind: value.kind, text: value.text });
});
ipcMain.handle('bubble:state', event => senderIs(event, bubbleWindow) ? currentBubble : null);
ipcMain.on('bubble:resize', (event, value) => {
  if (!senderIs(event, bubbleWindow) || value?.serial !== currentBubble.serial || currentBubble.phase !== 'visible' || !Number.isFinite(value.height)) return;
  bubbleHeight = Math.max(40, Math.min(190, Math.ceil(value.height))); positionBubble();
});
ipcMain.on('bubble:interactive', (event, value) => {
  if (senderIs(event, bubbleWindow) && value?.serial === currentBubble.serial && typeof value.inside === 'boolean') {
    bubbleWindow.setIgnoreMouseEvents(currentBubble.phase !== 'visible' || !value.inside, { forward: true });
  }
});
ipcMain.on('bubble:page', (event, value) => {
  if (!senderIs(event, bubbleWindow) || !Number.isInteger(value?.total) || value.total < 1 || value.total > 4000
    || !Number.isInteger(value.index) || value.index < 0 || value.index >= value.total) return;
  bubbles.pageChanged(value.serial, value.index, value.characters);
});
ipcMain.on('bubble:dismiss', (event, serial) => { if (senderIs(event, bubbleWindow) && serial === currentBubble.serial) dismissSpeech(serial); });
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showPet);
  app.whenReady().then(async () => {
    credentialStore = createCredentialStore({ directory: path.join(app.getPath('userData'), 'credentials'), safeStorage });
    await chat.restoreCredentials();
    diagnostic(`connection=${chat.getStatus().credentialState} ready=${chat.getStatus().ready}`);
    createWindow();
    createCompanionWindows();
    refreshAppMenu();
    screen.on('display-removed', showPet);
    screen.on('display-metrics-changed', showPet);
    powerMonitor.on('resume', showPet);
  });
  app.on('activate', showPet);
  app.on('before-quit', () => { quitting = true; chatGeneration++; chat.clear(); clearTimeout(recoveryTimer); bubbles.dispose(); hideHint(); clearInterval(lifeTimer); clearInterval(cursorTimer); tray?.destroy(); });
  app.on('window-all-closed', () => app.quit());
}
