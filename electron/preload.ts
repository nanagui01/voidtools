import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
    getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    openFile: (filters?: Array<{ name: string; extensions: string[] }>) =>
      ipcRenderer.invoke('dialog:openFile', filters),
  },
  webUtils: {
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
  },
  notification: {
    show: (opts: { title: string; body: string; icon?: string }) => ipcRenderer.invoke('notification:show', opts),
  },
  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    openReleases: () => ipcRenderer.invoke('updater:openReleases'),
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
    isPackaged: () => ipcRenderer.invoke('updater:isPackaged'),
    getReleaseNotes: (version?: string) => ipcRenderer.invoke('updater:getReleaseNotes', version),
    onStatus: (callback: (status: any) => void) => {
      const handler = (_event: any, status: any) => callback(status)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    },
  },
})
