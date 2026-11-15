'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopPet', {
  resizeComposer: height => ipcRenderer.send('chat:resize', height),
  openConnection: () => ipcRenderer.send('connection:open'),
  closeConnection: () => ipcRenderer.send('connection:close'),
  setCaption: value => ipcRenderer.send('pet:caption', value),
  bubbleState: () => ipcRenderer.invoke('bubble:state'),
  resizeBubble: (height, serial) => ipcRenderer.send('bubble:resize', { height, serial }),
  bubbleInteractive: inside => ipcRenderer.send('bubble:interactive', inside),
  dismissBubble: () => ipcRenderer.send('bubble:dismiss'),
  onBubbleCursor: callback => {
    const listener = (_event, point) => callback(point);
    ipcRenderer.on('bubble:cursor', listener);
    return () => ipcRenderer.removeListener('bubble:cursor', listener);
  },
  onBubbleSide: callback => {
    const listener = (_event, side) => callback(side);
    ipcRenderer.on('bubble:side', listener);
    return () => ipcRenderer.removeListener('bubble:side', listener);
  },
  onBubble: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('bubble:state', listener);
    return () => ipcRenderer.removeListener('bubble:state', listener);
  },
  onConnectionOpened: callback => {
    const listener = () => callback();
    ipcRenderer.on('connection:opened', listener);
    return () => ipcRenderer.removeListener('connection:opened', listener);
  },
  onConversationCleared: callback => {
    const listener = () => callback();
    ipcRenderer.on('chat:cleared', listener);
    return () => ipcRenderer.removeListener('chat:cleared', listener);
  },
  openChat: () => ipcRenderer.send('chat:open'),
  closeChat: () => ipcRenderer.send('chat:close'),
  chatState: () => ipcRenderer.invoke('chat:state'),
  configureChat: config => ipcRenderer.invoke('chat:configure', config),
  sendChat: text => ipcRenderer.invoke('chat:send', text),
  clearChat: () => ipcRenderer.send('chat:clear'),
  keyHelp: () => ipcRenderer.send('chat:key-help'),
  onChatState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('chat:state', listener);
    return () => ipcRenderer.removeListener('chat:state', listener);
  },
  onChatOpened: callback => {
    const listener = () => callback();
    ipcRenderer.on('chat:opened', listener);
    return () => ipcRenderer.removeListener('chat:opened', listener);
  },
  onSpeech: callback => {
    const listener = (_event, text) => callback(text);
    ipcRenderer.on('pet:speech', listener);
    return () => ipcRenderer.removeListener('pet:speech', listener);
  },
  diagnostic: detail => ipcRenderer.send('pet:diagnostic', detail),
  initialState: () => ipcRenderer.invoke('pet:initial-state'),
  setPointerInside: inside => ipcRenderer.send('pet:hit-test', Boolean(inside)),
  interact: () => ipcRenderer.send('pet:interact'),
  showMenu: () => ipcRenderer.send('pet:context-menu'),
  beginDrag: (x, y) => ipcRenderer.send('pet:drag-start', { x, y }),
  moveDrag: (x, y) => ipcRenderer.send('pet:drag-move', { x, y }),
  endDrag: () => ipcRenderer.send('pet:drag-end'),
  onLife: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('pet:life', listener);
    return () => ipcRenderer.removeListener('pet:life', listener);
  },
  onCursor: callback => {
    const listener = (_event, point) => callback(point);
    ipcRenderer.on('pet:cursor', listener);
    return () => ipcRenderer.removeListener('pet:cursor', listener);
  },
  onReaction: callback => {
    const listener = () => callback();
    ipcRenderer.on('pet:reaction', listener);
    return () => ipcRenderer.removeListener('pet:reaction', listener);
  }
});
