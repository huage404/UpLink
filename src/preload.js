// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  uploadFiles: (serverConfig) => ipcRenderer.invoke('upload-files', serverConfig),
  cancelUpload: (serverId) => ipcRenderer.invoke('cancel-upload', serverId),
  exportServersToFile: (jsonString) => ipcRenderer.invoke('export-servers', jsonString),
  onUploadProgress: (callback) => {
    ipcRenderer.on('upload-progress', (event, data) => callback(data));
  },
  removeUploadProgressListener: () => {
    ipcRenderer.removeAllListeners('upload-progress');
  }
});
