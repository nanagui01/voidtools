export interface ElectronAPI {
  platform: string
  versions: {
    node: string
    chrome: string
    electron: string
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
  app: {
    getVersion: () => Promise<string>
    getPath: (name: string) => Promise<string>
    getDataPath: () => Promise<string>
    quit: () => void
  }
  dialog: {
    openDirectory: () => Promise<string | null>
    openFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>
  }
  webUtils: {
    getPathForFile: (file: File) => string
  }
  notification: {
    show: (opts: { title: string; body: string; icon?: string }) => void
  }
  shell: {
    openPath: (path: string) => Promise<string>
    showItemInFolder: (path: string) => void
    openExternal: (url: string) => Promise<void>
  }
  clipboard: {
    writeText: (text: string) => void
  }
  updater: {
    check: () => Promise<any>
    download: () => Promise<boolean>
    install: () => Promise<boolean>
    openReleases: () => Promise<void>
    getVersion: () => Promise<string>
    isPackaged: () => Promise<boolean>
    onStatus: (callback: (status: any) => void) => () => void
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
