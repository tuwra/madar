'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = (ch, ...args) => ipcRenderer.invoke(ch, ...args);

contextBridge.exposeInMainWorld('madar', {
  loadState: () => call('state:load'),
  saveState: json => call('state:save', json),
  stateMtime: () => call('state:mtime'),
  getBlob: key => call('blob:get', key),
  setBlob: (key, bytes, type) => call('blob:set', key, bytes, type),
  delBlob: key => call('blob:del', key),
  folderInfo: () => call('folder:info'),
  chooseFolder: suggested => call('folder:choose', suggested),
  revealFolder: () => call('folder:reveal'),
  pickFile: opts => call('file:pick', opts),
  saveFile: opts => call('file:save', opts),
  saveToDrive: opts => call('file:saveToDrive', opts),
  openFile: p => call('file:open', p),
  revealFile: p => call('file:reveal', p),
  fileExists: p => call('file:exists', p),
  ask: opts => call('ask', opts),
});
