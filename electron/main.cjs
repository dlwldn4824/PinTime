const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
} = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')

const isDev = !app.isPackaged
const PIN_BOUNDS_FILE = () => path.join(app.getPath('userData'), 'desktop-pin-bounds.json')

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {BrowserWindow | null} */
let pinWindow = null
/** @type {http.Server | null} */
let staticServer = null
/** @type {string} */
let appOrigin = isDev ? 'http://localhost:5173' : ''

function distDir() {
  return path.join(__dirname, '..', 'dist')
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }
  return map[ext] || 'application/octet-stream'
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const root = distDir()
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1')
        let rel = decodeURIComponent(url.pathname)
        if (rel === '/') rel = '/index.html'
        const filePath = path.normalize(path.join(root, rel))
        if (!filePath.startsWith(root)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          const index = path.join(root, 'index.html')
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          fs.createReadStream(index).pipe(res)
          return
        }
        res.writeHead(200, { 'Content-Type': contentType(filePath) })
        fs.createReadStream(filePath).pipe(res)
      } catch (err) {
        res.writeHead(500)
        res.end(String(err))
      }
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to bind static server'))
        return
      }
      staticServer = server
      appOrigin = `http://127.0.0.1:${addr.port}`
      resolve(appOrigin)
    })
    server.on('error', reject)
  })
}

function loadPinBounds() {
  try {
    const raw = fs.readFileSync(PIN_BOUNDS_FILE(), 'utf8')
    const parsed = JSON.parse(raw)
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number'
    ) {
      return parsed
    }
  } catch {
    /* ignore */
  }
  const display = screen.getPrimaryDisplay().workArea
  return {
    x: display.x + Math.round(display.width * 0.55),
    y: display.y + 48,
    width: Math.min(520, Math.round(display.width * 0.4)),
    height: Math.min(640, Math.round(display.height * 0.7)),
  }
}

function savePinBounds(bounds) {
  try {
    fs.writeFileSync(PIN_BOUNDS_FILE(), JSON.stringify(bounds))
  } catch {
    /* ignore */
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'PinTime',
    backgroundColor: '#e8f6ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.loadURL(appOrigin)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createPinWindow() {
  if (pinWindow && !pinWindow.isDestroyed()) {
    pinWindow.focus()
    return pinWindow
  }

  const bounds = loadPinBounds()
  pinWindow = new BrowserWindow({
    ...bounds,
    minWidth: 320,
    minHeight: 360,
    title: 'PinTime Desktop Calendar',
    frame: false,
    transparent: false,
    backgroundColor: '#e8f6ee',
    hasShadow: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    movable: true,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    focusable: true,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // 드래그로 위치·크기 조절 가능 · 다른 앱 위에 고정하지 않음
  pinWindow.setMovable(true)
  pinWindow.setVisibleOnAllWorkspaces(false)

  const persistBounds = () => {
    if (pinWindow && !pinWindow.isDestroyed()) {
      savePinBounds(pinWindow.getBounds())
    }
  }
  pinWindow.on('moved', persistBounds)
  pinWindow.on('resized', persistBounds)

  pinWindow.loadURL(`${appOrigin}/?mode=desktop-pin`)
  pinWindow.on('closed', () => {
    pinWindow = null
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop-pin:changed', false)
    }
  })

  return pinWindow
}

function closePinWindow() {
  if (pinWindow && !pinWindow.isDestroyed()) {
    const bounds = pinWindow.getBounds()
    savePinBounds(bounds)
    pinWindow.close()
  }
  pinWindow = null
}

ipcMain.handle('pintime:platform', () => ({
  isElectron: true,
  platform: process.platform,
  desktopPinOpen: !!(pinWindow && !pinWindow.isDestroyed()),
}))

ipcMain.handle('pintime:open-external', async (_evt, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false
  await shell.openExternal(url)
  return true
})

ipcMain.handle('desktop-pin:open', () => {
  createPinWindow()
  return true
})

ipcMain.handle('desktop-pin:close', () => {
  closePinWindow()
  return true
})

ipcMain.handle('desktop-pin:toggle', () => {
  if (pinWindow && !pinWindow.isDestroyed()) {
    closePinWindow()
    return false
  }
  createPinWindow()
  return true
})

ipcMain.handle('desktop-pin:is-open', () => {
  return !!(pinWindow && !pinWindow.isDestroyed())
})

ipcMain.handle('desktop-pin:set-view', (_evt, view) => {
  if (pinWindow && !pinWindow.isDestroyed()) {
    pinWindow.webContents.send('desktop-pin:view', view)
  }
  return true
})

app.whenReady().then(async () => {
  if (!isDev) {
    await startStaticServer()
  }

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (staticServer) staticServer.close()
    app.quit()
  }
})

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})
