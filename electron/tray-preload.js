'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('trayBridge', {
  summary: () => ipcRenderer.invoke('tray:summary'),
  toggle: id => ipcRenderer.invoke('tray:toggle', id),
  add: text => ipcRenderer.invoke('tray:add', text),
  open: (view, extra) => ipcRenderer.invoke('tray:open', view, extra),
  hide: () => ipcRenderer.invoke('tray:hide'),
  call: (name, ...args) => ipcRenderer.invoke('tray:call', name, args),
  openItem: (name, id) => ipcRenderer.invoke('tray:openItem', name, id),
  onRefresh: cb => ipcRenderer.on('tray:refresh', () => cb()),
});
