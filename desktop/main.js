const { app, BrowserWindow, dialog, shell } = require('electron');
const http = require('http');
const net = require('net');
const path = require('path');

const DEFAULT_PORT = 3000;
const MAX_PORT = 3100;
const STARTUP_TIMEOUT_MS = 30000;
const RETRY_DELAY_MS = 300;

let mainWindow = null;
let startUrl = null;
let startUrlPromise = null;

function resolveStorageRoot() {
  if (
    process.env.ARTARC_STORAGE_DIR ||
    process.env.ARTARC_DATA_DIR ||
    process.env.ARTARC_MEDIA_DIR ||
    process.env.ARTARC_DB_PATH
  ) {
    return null;
  }

  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir) {
    return path.join(portableDir, `${app.getName()}-Data`);
  }

  return app.getPath('userData');
}

function ensureStorageEnv() {
  const storageRoot = resolveStorageRoot();
  if (storageRoot) {
    process.env.ARTARC_STORAGE_DIR = storageRoot;
  }
}

function findAvailablePort(startPort, endPort) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > endPort) {
        return reject(new Error('No available port found for the server.'));
      }

      const tester = net
        .createServer()
        .once('error', () => tryPort(port + 1))
        .once('listening', () => tester.close(() => resolve(port)))
        .listen(port, '127.0.0.1');
    };

    tryPort(startPort);
  });
}

function waitForServerReady(port, timeoutMs = STARTUP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const attempt = () => {
      const req = http.get(
        { hostname: '127.0.0.1', port, path: '/api/admin/status', timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            return resolve();
          }
          return retry();
        }
      );

      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        return reject(new Error('Server failed to start in time.'));
      }
      setTimeout(attempt, RETRY_DELAY_MS);
    };

    attempt();
  });
}

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function ensureStartUrl() {
  if (startUrl) {
    return startUrl;
  }
  if (startUrlPromise) {
    return startUrlPromise;
  }

  startUrlPromise = (async () => {
    try {
      ensureStorageEnv();
      process.env.NODE_ENV = process.env.NODE_ENV || 'production';

      if (process.env.ELECTRON_START_URL) {
        startUrl = process.env.ELECTRON_START_URL;
        return startUrl;
      }

      const port = process.env.PORT
        ? Number(process.env.PORT)
        : await findAvailablePort(DEFAULT_PORT, MAX_PORT);
      process.env.PORT = String(port);

      require(path.join(__dirname, '..', 'server', 'index.js'));
      await waitForServerReady(port);

      startUrl = `http://127.0.0.1:${port}`;
      return startUrl;
    } catch (error) {
      startUrlPromise = null;
      throw error;
    }
  })();

  return startUrlPromise;
}

async function startDesktopApp() {
  const url = await ensureStartUrl();
  if (!mainWindow) {
    createMainWindow(url);
  }
}

app.whenReady()
  .then(startDesktopApp)
  .catch((err) => {
    dialog.showErrorBox('ArtArc4U startup failed', err.message);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startDesktopApp();
  }
});
