const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('formInspector', {
  analyze: (url) => ipcRenderer.invoke('analyze', url),
  saveReport: (filename, content) => ipcRenderer.invoke('saveReport', filename, content),
});
