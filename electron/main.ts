import { app, BrowserWindow, ipcMain, dialog, Notification, nativeImage, shell, Tray, screen, clipboard, session } from 'electron'
import path from 'path'
import { initUpdater } from './updater'

let mainWindow: BrowserWindow | null = null
let apiServer: any = null
let tray: Tray | null = null
let trayPopup: BrowserWindow | null = null
let isQuitting = false
let minimizeToTray = false
let trayTaskData: { tasks: Array<{ id: string; tool: string; status: string; progress: number; total: number; phase?: string; lastMessage?: string; subAction?: string }>; monitoredUsers: number; activeSessions: number; connectedTokens: number; totalTokens: number } = {
  tasks: [],
  monitoredUsers: 0,
  activeSessions: 0,
  connectedTokens: 0,
  totalTokens: 0,
}

const isDev = !app.isPackaged
if (app.isPackaged && !process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production'
}
const publicPath = path.join(app.getAppPath(), 'public')
const appIcon = path.join(publicPath, 'icon.ico')
const notifIcon = path.join(publicPath, 'icon.png')

app.setName('BrunnoClear')
if (process.platform === 'win32') {
  app.setAppUserModelId('BrunnoClear')
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function getLoadingHTML(): string {
  return `<!DOCTYPE html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#000;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif}
.container{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:20px;-webkit-app-region:drag}
.spinner{width:36px;height:36px;border:3px solid #222;border-top-color:#22c55e;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.text{color:#666;font-size:13px;letter-spacing:.3px}
</style></head><body>
<div class="container">
  <div class="spinner"></div>
  <span class="text">Iniciando BrunnoClear...</span>
</div>
</body></html>`
}

/**
 * Cria a janela principal do Electron com preload, CSP e loading screen
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#000000',
    icon: appIcon,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.imgur.com/*', 'https://*.discord.com/*', 'https://*.discordapp.com/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://discord.com/'
      callback({ requestHeaders: details.requestHeaders })
    },
  )

  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (_e, input) => {
      const blocked =
        input.key === 'F12' ||
        (input.control && input.shift && ['I', 'i', 'J', 'j', 'C', 'c'].includes(input.key)) ||
        (input.control && ['U', 'u'].includes(input.key)) ||
        (input.control && input.shift && ['R', 'r'].includes(input.key))
      if (blocked) _e.preventDefault()
    })
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    session.defaultSession.clearCache()
    mainWindow.loadFile(path.join(publicPath, 'loading.html'))
  }

  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:3777', 'http://localhost:3777']
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const parsed = new URL(url)
    if (!allowedOrigins.includes(parsed.origin)) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')) {
      return { action: 'allow' }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting && minimizeToTray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Inicia o servidor Express embutido (API + WebSocket)
 */
async function startServer() {
  await new Promise(resolve => setTimeout(resolve, 100))
  const { createApiServer } = require('../server')
  apiServer = createApiServer()
  await apiServer.start()
}

/**
 * Aguarda o servidor ficar saudável e carrega a URL principal na janela
 */
async function waitForServerAndLoad() {
  const url = 'http://127.0.0.1:3777/health'
  const maxAttempts = 50
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { net } = await import('electron')
      const response = await net.fetch(url)
      if (response.ok) {
        mainWindow?.loadURL('http://127.0.0.1:3777')
        return
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  mainWindow?.loadURL('http://127.0.0.1:3777')
}

ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.handle('window:close', () => {
  if (minimizeToTray) {
    mainWindow?.hide()
  } else {
    app.quit()
  }
})
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

ipcMain.handle('app:getVersion', () => app.getVersion())
ipcMain.handle('app:getPath', (_e, name: string) => app.getPath(name as Parameters<typeof app.getPath>[0]))
ipcMain.handle('app:quit', () => app.quit())
ipcMain.handle('app:getDataPath', () => app.getPath('userData'))

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:openFile', async (_e, filters?: Array<{ name: string; extensions: string[] }>) => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('notification:show', async (_e, opts: { title: string; body: string; icon?: string }) => {
  if (!Notification.isSupported()) return

  let icon: Electron.NativeImage | string = notifIcon
  if (opts.icon) {
    try {
      const { net } = await import('electron')
      const response = await net.fetch(opts.icon)
      const buffer = Buffer.from(await response.arrayBuffer())
      const img = nativeImage.createFromBuffer(buffer)
      if (!img.isEmpty()) icon = img
    } catch {}
  }

  new Notification({ title: opts.title, body: opts.body, icon }).show()
})

ipcMain.handle('shell:openPath', (_e, filePath: string) => shell.openPath(filePath))
ipcMain.handle('shell:showItemInFolder', (_e, filePath: string) => shell.showItemInFolder(filePath))
ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))
ipcMain.handle('clipboard:writeText', (_e, text: string) => clipboard.writeText(text))

const TOOL_LABELS: Record<string, string> = {
  'limpar-dm': 'Limpar DM',
  'backup': 'Backup',
  'limpar-package': 'Limpar Package',
  'limpar-dms-abertas': 'Limpar DMs Abertas',
  'remover-amigos': 'Remover Amigos',
  'remover-servidores': 'Remover Servidores',
  'clonar-servidor': 'Clonar Servidor',
  'scraper-icons': 'Scraper Icons',
  'fechar-dms': 'Fechar DMs',
  'call-utils': 'Call Utils',
  'prefix-commands': 'Comandos Prefix',
}

const PREFIX_SUB_LABELS: Record<string, string> = {
  'cl': '🗑️ Deletar Msgs',
  'coleira': '🐕 Coleira',
  'proteger': '🛡️ Proteger',
  'apelido': '✏️ Apelido',
  'elevador': '🛗 Elevador',
  'stalkear': '🔍 Stalkear',
  'farm': '⏰ Farm',
}

function getTrayPopupHtml(): string {
  const iconData = nativeImage.createFromPath(notifIcon).resize({ width: 24, height: 24 }).toDataURL()
  const version = app.getVersion()
  const d = trayTaskData
  const runningTasks = d.tasks.filter(t => t.status === 'running' || t.status === 'paused')
  const hasRunning = runningTasks.length > 0

  const taskRows = runningTasks.map(t => {
    let label = TOOL_LABELS[t.tool] || t.tool
    if (t.tool === 'prefix-commands' && t.subAction) {
      label = PREFIX_SUB_LABELS[t.subAction] || `Prefix: ${t.subAction}`
    }
    const statusIcon = t.status === 'paused' ? '⏸️ ' : ''
    const isContinuous = t.total === 0

    if (isContinuous) {
      const msg = t.lastMessage || 'Executando...'
      return `<div class="task">
        <div class="task-hdr"><span class="task-name">${statusIcon}${label}</span><span class="task-live">AO VIVO</span></div>
        <span class="task-msg">${msg}</span>
      </div>`
    }

    const pct = Math.round((t.progress / t.total) * 100)
    const phaseLabel = t.phase === 'fetching' ? 'Buscando...' : t.phase === 'deleting' ? 'Deletando...' : t.phase === 'backup' ? 'Backup...' : t.phase === 'backup-media' ? 'Baixando mídia...' : t.phase === 'backup-saving' ? 'Salvando...' : ''
    return `<div class="task">
      <div class="task-hdr"><span class="task-name">${statusIcon}${label}</span><span class="task-pct">${pct}%</span></div>
      ${phaseLabel ? `<span class="task-phase">${phaseLabel}</span>` : ''}
      <div class="task-bar"><div class="task-fill" style="width:${pct}%"></div></div>
      <span class="task-count">${t.progress}/${t.total}</span>
    </div>`
  }).join('')

  return `<!DOCTYPE html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent;overflow:hidden}
.popup{
  background:#0c0c0c;border:1px solid #222;border-radius:12px;
  font-family:'Segoe UI',system-ui,sans-serif;color:#e5e5e5;
  overflow:hidden;user-select:none;-webkit-app-region:no-drag;
  animation:fadeIn .15s ease-out;
}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.hdr{
  display:flex;align-items:center;gap:10px;padding:12px 14px;
  border-bottom:1px solid #1a1a1a;
}
.hdr img{width:24px;height:24px;border-radius:6px}
.hdr .t{font-weight:600;font-size:13px;flex:1}
.hdr .v{font-size:10px;color:#666;background:#1a1a1a;padding:2px 7px;border-radius:4px}
.stats{display:flex;gap:0;border-bottom:1px solid #1a1a1a}
.stat{flex:1;text-align:center;padding:8px 4px;border-right:1px solid #1a1a1a}
.stat:last-child{border-right:none}
.stat .n{font-size:15px;font-weight:700;color:#fff}
.stat .l{font-size:9px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.3px}
.stat.active .n{color:#22c55e}
.tasks{padding:6px 8px;border-bottom:1px solid #1a1a1a}
.tasks-title{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px;display:flex;align-items:center;gap:5px}
.tasks-title .dot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.task{background:#111;border-radius:8px;padding:8px 10px;margin-bottom:4px}
.task:last-child{margin-bottom:0}
.task-hdr{display:flex;justify-content:space-between;align-items:center}
.task-name{font-size:11.5px;font-weight:600;color:#ddd}
.task-pct{font-size:11px;font-weight:700;color:#22c55e;font-family:'SF Mono',Consolas,monospace}
.task-phase{font-size:9.5px;color:#888;display:block;margin-top:2px}
.task-bar{height:3px;background:#222;border-radius:2px;margin-top:5px;overflow:hidden}
.task-fill{height:100%;background:linear-gradient(90deg,#22c55e,#10b981);border-radius:2px;transition:width .3s}
.task-count{font-size:9px;color:#555;margin-top:3px;display:block;font-family:'SF Mono',Consolas,monospace}
.task-live{font-size:9px;font-weight:700;color:#22c55e;background:#22c55e18;padding:1px 6px;border-radius:4px;letter-spacing:.5px}
.task-msg{font-size:10px;color:#999;display:block;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.no-tasks{text-align:center;padding:10px;font-size:11px;color:#444}
.menu{padding:4px}
.item{
  display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;
  border:none;background:none;color:#ccc;font-size:12.5px;font-family:inherit;
  cursor:pointer;border-radius:8px;transition:all .12s;text-align:left;
}
.item:hover{background:#1a1a1a;color:#fff}
.item.quit:hover{background:rgba(255,68,68,.1);color:#ff4444}
.item svg{width:15px;height:15px;opacity:.6}
.item:hover svg{opacity:1}
.sep{height:1px;background:#1a1a1a;margin:2px 8px}
</style></head><body>
<div class="popup">
  <div class="hdr">
    <img src="${iconData}"/>
    <span class="t">BrunnoClear</span>
    <span class="v">v${version}</span>
  </div>
  <div class="stats">
    <div class="stat${d.connectedTokens > 0 ? ' active' : ''}">
      <div class="n">${d.connectedTokens}/${d.totalTokens}</div>
      <div class="l">Tokens</div>
    </div>
    <div class="stat${d.monitoredUsers > 0 ? ' active' : ''}">
      <div class="n">${d.monitoredUsers}</div>
      <div class="l">Monitorados</div>
    </div>
    <div class="stat${d.activeSessions > 0 ? ' active' : ''}">
      <div class="n">${d.activeSessions}</div>
      <div class="l">Calls</div>
    </div>
  </div>
  <div class="tasks">
    <div class="tasks-title">${hasRunning ? '<span class="dot"></span>' : ''}Tasks${hasRunning ? ` (${runningTasks.length})` : ''}</div>
    ${hasRunning ? taskRows : '<div class="no-tasks">Nenhuma task rodando</div>'}
  </div>
  <div class="menu">
    <button class="item" onclick="send('show')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
      Abrir
    </button>
    <div class="sep"></div>
    <button class="item quit" onclick="send('quit')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Sair
    </button>
  </div>
</div>
<script>
const{ipcRenderer}=require('electron');
function send(a){ipcRenderer.send('tray-action',a)}
</script></body></html>`
}

function refreshTrayPopup() {
  if (trayPopup && trayPopup.isVisible()) {
    trayPopup.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getTrayPopupHtml())}`)
  }
}

function updateTrayTooltip() {
  if (!tray) return
  const d = trayTaskData
  const running = d.tasks.filter(t => t.status === 'running')
  const parts = [`BrunnoClear`]
  if (d.connectedTokens > 0) parts.push(`${d.connectedTokens} token(s)`)
  if (d.monitoredUsers > 0) parts.push(`${d.monitoredUsers} monitorado(s)`)
  if (d.activeSessions > 0) parts.push(`${d.activeSessions} call(s)`)
  if (running.length > 0) {
    for (const t of running) {
      let label = TOOL_LABELS[t.tool] || t.tool
      if (t.tool === 'prefix-commands' && t.subAction) {
        label = PREFIX_SUB_LABELS[t.subAction] || `Prefix: ${t.subAction}`
      }
      if (t.total > 0) {
        const pct = Math.round((t.progress / t.total) * 100)
        parts.push(`${label}: ${pct}%`)
      } else {
        parts.push(`${label}: ativo`)
      }
    }
  }
  tray.setToolTip(parts.join('\n'))
}

function computePopupHeight(): number {
  const d = trayTaskData
  const running = d.tasks.filter(t => t.status === 'running' || t.status === 'paused')
  const hdr = 49
  const stats = 50
  const tasksTitle = 28
  const taskHeight = running.length > 0
    ? running.reduce((h, t) => h + (t.total === 0 ? 52 : 74), 0)
    : 30
  const menu = 82
  const padding = 16
  return hdr + stats + tasksTitle + taskHeight + menu + padding
}

function showTrayPopup(trayBounds: Electron.Rectangle) {
  const popupW = 240
  const popupH = computePopupHeight()

  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const taskbarAtTop = trayBounds.y < display.workArea.y + display.workArea.height / 2

  const x = Math.round(trayBounds.x + trayBounds.width / 2 - popupW / 2)
  const y = taskbarAtTop
    ? Math.round(trayBounds.y + trayBounds.height + 4)
    : Math.round(trayBounds.y - popupH - 4)

  if (!trayPopup) {
    trayPopup = new BrowserWindow({
      width: popupW,
      height: popupH,
      x, y,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
    })

    trayPopup.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getTrayPopupHtml())}`)
    trayPopup.on('blur', () => trayPopup?.hide())
    trayPopup.on('closed', () => { trayPopup = null })
  } else {
    trayPopup.setSize(popupW, popupH)
    trayPopup.setPosition(x, y)
    trayPopup.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getTrayPopupHtml())}`)
  }

  trayPopup.show()
  trayPopup.focus()
}

ipcMain.on('tray-action', (_e, action: string) => {
  trayPopup?.hide()
  if (action === 'show') {
    mainWindow?.show()
    mainWindow?.focus()
  } else if (action === 'quit') {
    isQuitting = true
    app.quit()
  }
})

function createTray() {
  tray = new Tray(appIcon)
  tray.setToolTip('BrunnoClear')

  tray.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  tray.on('right-click', (_e, bounds) => {
    if (trayPopup?.isVisible()) {
      trayPopup.hide()
      return
    }
    showTrayPopup(bounds)
  })
}

function syncMinimizeToTray() {
  const fetchSetting = async () => {
    try {
      const { net } = await import('electron')
      const res = await net.fetch('http://127.0.0.1:3777/api/settings')
      if (res.ok) {
        const json = (await res.json()) as any
        const newValue = !!json?.data?.general?.minimizeToTray
        if (newValue !== minimizeToTray) {
          minimizeToTray = newValue
          if (minimizeToTray && !tray) {
            createTray()
          } else if (!minimizeToTray && tray) {
            tray.destroy()
            tray = null
          }
        }
      }
    } catch {}
  }
  fetchSetting()
  setInterval(fetchSetting, 5000)
}

app.whenReady().then(async () => {
  await createWindow()

  await new Promise<void>((resolve) => {
    if (mainWindow?.webContents) {
      mainWindow.webContents.once('did-finish-load', () => resolve())
    }
    setTimeout(resolve, 300)
  })

  await startServer()
  subscribeToServerEvents()
  syncMinimizeToTray()
  if (!isDev) {
    await waitForServerAndLoad()
  }

  if (mainWindow) {
    initUpdater(mainWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

function subscribeToServerEvents() {
  if (!apiServer) return

  const tm = apiServer.taskManager
  const ms = apiServer.monitoringService

  function syncTasks() {
    trayTaskData.tasks = tm.getAllTasks().map((t: any) => {
      const lastResult = t.results.length > 0 ? t.results[t.results.length - 1] : null
      return {
        id: t.id,
        tool: t.tool,
        status: t.status,
        progress: t.progress,
        total: t.total,
        phase: (t as any).phase,
        lastMessage: lastResult?.message,
        subAction: (t.config as any)?.subAction,
      }
    })
    updateTrayTooltip()
    refreshTrayPopup()
  }

  function syncMonitoring() {
    try {
      const status = ms.getStatus()
      trayTaskData.monitoredUsers = status.monitoredUsers
      trayTaskData.activeSessions = status.activeSessions
      trayTaskData.connectedTokens = status.connectedTokens
      trayTaskData.totalTokens = status.totalTokens
    } catch {}
    updateTrayTooltip()
    refreshTrayPopup()
  }

  tm.on('task:created', syncTasks)
  tm.on('task:started', syncTasks)
  tm.on('task:progress', syncTasks)
  tm.on('task:completed', syncTasks)
  tm.on('task:error', syncTasks)
  tm.on('task:cancelled', syncTasks)
  tm.on('task:paused', syncTasks)
  tm.on('task:resumed', syncTasks)

  ms.on('session:start', syncMonitoring)
  ms.on('session:end', syncMonitoring)
  ms.on('token:status', syncMonitoring)
  ms.on('user:added', syncMonitoring)
  ms.on('user:removed', syncMonitoring)

  setTimeout(syncMonitoring, 3000)
}

app.on('before-quit', async (e) => {
  if (isQuitting) return
  e.preventDefault()
  isQuitting = true
  if (tray) {
    tray.destroy()
    tray = null
  }
  try {
    if (apiServer) await apiServer.stop()
  } catch {}
  app.exit(0)
})

app.on('window-all-closed', () => {
  if (!minimizeToTray) {
    app.quit()
  }
})
