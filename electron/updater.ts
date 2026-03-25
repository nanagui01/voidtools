import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, ipcMain, shell, app, dialog } from 'electron'
import path from 'path'

const isDev = !app.isPackaged

const GITHUB_OWNER = 'brunnoxw'
const GITHUB_REPO = 'BrunnoClear-V2'

export type UpdateStatus =
  | { status: 'checking' }
  | { status: 'available'; info: UpdateInfo }
  | { status: 'not-available'; info: UpdateInfo }
  | { status: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { status: 'downloaded'; info: UpdateInfo }
  | { status: 'error'; message: string }

let mainWindowRef: BrowserWindow | null = null

/**
 * Envia status de atualização para o renderer via IPC
 */
function send(status: UpdateStatus) {
  mainWindowRef?.webContents.send('updater:status', status)
}

/**
 * Inicializa o sistema de auto-update via electron-updater.
 * Configura handlers IPC, feed do GitHub e verificação periódica
 */
export function initUpdater(mainWindow: BrowserWindow) {
  mainWindowRef = mainWindow

  ipcMain.handle('updater:check', async () => {
    if (isDev) {
      return { status: 'dev', message: 'Running from source — use GitHub Releases.' }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      return result?.updateInfo ?? null
    } catch (err: any) {
      return { status: 'error', message: err?.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('updater:download', async () => {
    if (isDev) return false
    try {
      await autoUpdater.downloadUpdate()
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('updater:install', () => {
    if (isDev) return false
    autoUpdater.quitAndInstall(false, true)
    return true
  })

  ipcMain.handle('updater:openReleases', () => {
    shell.openExternal(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`)
  })

  ipcMain.handle('updater:getVersion', () => app.getVersion())

  ipcMain.handle('updater:isPackaged', () => app.isPackaged)

  if (isDev) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoRunAppAfterInstall = true

  const ghToken = process.env.GH_TOKEN || ''

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    private: true,
    token: ghToken,
  })

  autoUpdater.on('checking-for-update', () => {
    send({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    send({ status: 'available', info })
  })

  autoUpdater.on('update-not-available', (info) => {
    send({ status: 'not-available', info })
  })

  autoUpdater.on('download-progress', (progress) => {
    send({
      status: 'downloading',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    send({ status: 'downloaded', info })
  })

  autoUpdater.on('error', (err) => {
    send({ status: 'error', message: err?.message ?? 'Update error' })
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 30 * 60 * 1000)
}
