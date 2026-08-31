const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;

// Multi-tenant active partitions cache
const activePartitions = new Map();

function getOrCreatePartitionSession(partitionName) {
  const cleanPart = `persist:${partitionName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  if (!activePartitions.has(cleanPart)) {
    const ses = session.fromPartition(cleanPart, { cache: true });
    
    // Set custom user agent to match latest Edge/Chrome to allow unrestricted Microsoft Teams access
    ses.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
    );

    // Modify headers to allow cross-tenant iframe embedding & webviews
    ses.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = Object.assign({}, details.responseHeaders);
      delete responseHeaders['x-frame-options'];
      delete responseHeaders['X-Frame-Options'];
      delete responseHeaders['content-security-policy'];
      delete responseHeaders['Content-Security-Policy'];
      callback({ cancel: false, responseHeaders });
    });

    activePartitions.set(cleanPart, ses);
  }
  return activePartitions.get(cleanPart);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'TeamsHub - Enterprise Multi-Tenant Workspace',
    backgroundColor: '#0a0d14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      spellcheck: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  // Load production application with full Microsoft OAuth redirect support
  mainWindow.loadURL('https://teamshub-1.onrender.com');

  // Handle external link clicks
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'allow' };
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

// Setup Windows System Tray Icon
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  // Fallback empty icon if file doesn't exist yet
  try {
    tray = new Tray(fs.existsSync(iconPath) ? iconPath : path.join(__dirname, '..', 'web', 'public', 'favicon.ico'));
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open TeamsHub',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Workspaces',
        submenu: [
          { label: '🏢 Estatic Infotech', enabled: false },
          { label: '🏢 DR SCHAER AG', enabled: false },
          { label: '🏢 BayWa r.e.', enabled: false },
          { label: '🏢 Kerry Dines Ltd', enabled: false }
        ]
      },
      { type: 'separator' },
      {
        label: 'Quit TeamsHub',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('TeamsHub - Multi-Tenant Workspace');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {
    console.warn('[Tray Error]', e.message);
  }
}

// IPC Handlers
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.hide());

ipcMain.on('notification:show', (event, { title, body, onClickData }) => {
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: title || 'TeamsHub',
      body: body || 'New incoming message',
      icon: path.join(__dirname, '..', 'web', 'public', 'favicon.ico')
    });
    notif.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        if (onClickData) {
          mainWindow.webContents.send('navigate:chat', onClickData);
        }
      }
    });
    notif.show();
  }
});

ipcMain.on('badge:update', (event, count) => {
  if (app.setBadgeCount) {
    app.setBadgeCount(count || 0);
  }
  if (mainWindow && process.platform === 'win32') {
    if (count > 0) {
      mainWindow.flashFrame(true);
    }
  }
});

app.whenReady().then(() => {
  // Initialize default partition
  getOrCreatePartitionSession('home_estatic');
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
