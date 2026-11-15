'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petLobby', {
  snapshot: () => ipcRenderer.invoke('lobby:snapshot'),
  host: () => ipcRenderer.invoke('lobby:host'),
  join: invite => ipcRenderer.invoke('lobby:join', invite),
  goHome: () => ipcRenderer.invoke('lobby:go-home'),
  copyInvite: () => ipcRenderer.invoke('lobby:copy-invite'),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('lobby:state', listener);
    return () => ipcRenderer.removeListener('lobby:state', listener);
  }
});
