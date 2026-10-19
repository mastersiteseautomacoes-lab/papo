'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('papo', {
  state: () => ipcRenderer.invoke('papo:state'),
  hostStart: () => ipcRenderer.invoke('papo:host-start'),
  hostStop: () => ipcRenderer.invoke('papo:host-stop'),
  hostOpen: () => ipcRenderer.invoke('papo:host-open'),
  join: (address) => ipcRenderer.invoke('papo:join', address),
  home: () => ipcRenderer.invoke('papo:home'),
  copy: (text) => ipcRenderer.invoke('papo:copy', text),
  friendAdd: (name, address) => ipcRenderer.invoke('papo:friend-add', name, address),
  friendRemove: (address) => ipcRenderer.invoke('papo:friend-remove', address),
  friendRefresh: () => ipcRenderer.invoke('papo:friend-refresh'),
  onFriends: (cb) => ipcRenderer.on('papo:friends', (_e, list) => cb(list)),
})
