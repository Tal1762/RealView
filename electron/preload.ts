import { contextBridge, ipcRenderer } from 'electron';
import type { RoomShiftAPI, Signal } from '../src/types/api';
const api: RoomShiftAPI = {
  importAsset: kind => ipcRenderer.invoke('asset:import', kind),
  saveScene: scene => ipcRenderer.invoke('scene:save', scene),
  listScenes: () => ipcRenderer.invoke('scene:list'),
  loadScene: id => ipcRenderer.invoke('scene:load', id),
  deleteScene: id => ipcRenderer.invoke('scene:delete', id),
  openOutput: () => ipcRenderer.invoke('output:open'),
  closeOutput: () => ipcRenderer.invoke('output:close'),
  signal: message => ipcRenderer.send('output:signal', message),
  onSignal: callback => {
    const listener = (_event: Electron.IpcRendererEvent, message: Signal) => callback(message);
    ipcRenderer.on('output:signal', listener);
    return () => ipcRenderer.removeListener('output:signal', listener);
  },
  obsStatus: () => ipcRenderer.invoke('obs:status'),
  openObsGuide: () => ipcRenderer.invoke('obs:guide'),
};
contextBridge.exposeInMainWorld('roomshift', api);
