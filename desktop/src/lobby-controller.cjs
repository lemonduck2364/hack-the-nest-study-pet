'use strict';

const { randomUUID } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { startLobbyServer, joinLobby } = require('./lobby-network.cjs');

function loadPetId(directory) {
  const file = path.join(directory, 'pet-id');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    const id = readFileSync(file, 'utf8').trim();
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) {
      throw new Error('Invalid saved pet identity.');
    }
    return id.toLowerCase();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const id = randomUUID();
  writeFileSync(file, id + '\n', { flag: 'wx', mode: 0o600 });
  return id;
}

function createLobbyController({ BrowserWindow, ipcMain, clipboard, directory, getAppearance, secureWindow, onDeparture, onReturn }) {
  let current, shuttingDown = false;
  let cleanup = Promise.resolve();

  function publish(session, state) {
    session.state = { ...session.state, ...state };
    if (current === session && !session.window.isDestroyed()) {
      session.window.webContents.send('lobby:state', session.state);
    }
  }

  async function release(session) {
    const { server, client } = session;
    session.server = null;
    session.client = null;
    try {
      if (server) await server.close();
      else if (client) await client.leave();
    } catch {
      // The remote room may already be gone. Membership also expires remotely.
    }
  }

  function dispose(session) {
    if (current !== session) return;
    current = null;
    clearTimeout(session.pollTimer);
    const connecting = session.connecting;
    cleanup = Promise.all([cleanup, connecting]).then(() => release(session));
    if (session.state.phase === 'room' && !shuttingDown) onReturn();
  }

  function poll(session) {
    session.pollTimer = setTimeout(async () => {
      try {
        const state = await session.client.pulse();
        if (current !== session) return;
        publish(session, { ...state, invite: session.server?.invite ?? session.state.invite });
        poll(session);
      } catch {
        if (current === session) goHome();
      }
    }, 600);
  }

  async function connect(session, host, invite) {
    try {
      await cleanup;
      if (current !== session) return null;
      const { selfId } = session.state;
      const appearance = getAppearance();
      if (host) session.server = await startLobbyServer();
      if (current !== session) return null;
      session.client = await joinLobby(session.server?.localInvite ?? invite, { petId: selfId, appearance });
      if (current !== session) return null;
      publish(session, { ...session.client.initialState, phase: 'room', invite: session.server?.invite ?? invite.trim() });
      onDeparture();
      poll(session);
    } catch (error) {
      await release(session);
      if (current !== session) return null;
      publish(session, { phase: 'entry', error: error.message || 'Could not enter the Lobby.' });
    }
    return session.state;
  }

  function begin(session, host, invite) {
    if (session.state.phase !== 'entry' || !session.state.selfId) return session.state;
    publish(session, { phase: 'joining', error: '' });
    const connecting = connect(session, host, invite);
    session.connecting = connecting;
    connecting.then(() => {
      if (session.connecting === connecting) session.connecting = null;
    });
    return connecting;
  }

  function open() {
    if (shuttingDown) return;
    if (current) {
      current.window.show();
      current.window.focus();
      return;
    }
    let selfId = null;
    let error = '';
    try { selfId = loadPetId(directory); }
    catch { error = 'The app could not open the saved pet identity.'; }
    const window = new BrowserWindow({
      title: 'Nest Pet — Lobby',
      width: 720,
      height: 570,
      minWidth: 600,
      minHeight: 500,
      show: false,
      fullscreenable: false,
      webPreferences: {
        preload: path.join(__dirname, 'lobby-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: 'pet-lobby'
      }
    });
    secureWindow(window);
    const session = { window, state: { phase: 'entry', selfId, invite: '', pets: [], greeting: null, error } };
    current = session;
    window.once('ready-to-show', () => window.show());
    window.once('closed', () => dispose(session));
    window.webContents.on('render-process-gone', () => { if (current === session) goHome(); });
    window.loadFile(path.join(__dirname, 'renderer', 'lobby.html')).catch(() => {
      if (current === session) goHome();
    });
  }

  function goHome() {
    const session = current;
    if (!session) return;
    session.window.destroy();
  }

  function handle(channel, callback) {
    ipcMain.handle(channel, (event, ...args) => {
      const session = current;
      if (!session || session.window.isDestroyed()) return null;
      const contents = session.window.webContents;
      if (event.sender !== contents || event.senderFrame !== contents.mainFrame) return null;
      return callback(session, ...args);
    });
  }

  handle('lobby:snapshot', session => session.state);
  handle('lobby:host', session => begin(session, true));
  handle('lobby:join', (session, invite) => begin(session, false, invite));
  handle('lobby:go-home', () => {
    // Let the invoke response reach the renderer before closing its window.
    const session = current;
    setImmediate(() => { if (current === session) goHome(); });
    return true;
  });
  handle('lobby:copy-invite', session => {
    if (session.state.phase !== 'room') return false;
    const invite = session.server ? session.server.invite : session.state.invite;
    if (!invite) return false;
    clipboard.writeText(invite);
    return true;
  });
  return {
    open,
    goHome,
    isAway: () => current?.state.phase === 'room',
    isJoining: () => current?.state.phase === 'joining',
    shutdown: () => {
      shuttingDown = true;
      goHome();
      return cleanup;
    }
  };
}

module.exports = { createLobbyController, loadPetId };
