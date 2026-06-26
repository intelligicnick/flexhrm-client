import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { apiClient } from './services/api-client';
import { collectDeviceInfo } from './services/device-info';
import { monitorEngine } from './services/monitor-engine';
import { startInputListener, stopInputListener } from './services/input-listener';
import { bindSetupWindow } from './services/setup-window';
import { ensureHiddenBackgroundWindow, destroyHiddenBackgroundWindow } from './background-shell';

const APP_NAME = 'Flex HRM Connect';
const WATCHDOG_INTERVAL_MS = 60_000;

let tray: Tray | null = null;
let setupWindow: BrowserWindow | null = null;
let forceQuit = false;
let persistenceWatchdog: NodeJS.Timeout | null = null;

const isDev = !app.isPackaged;
const startedInBackground = process.argv.includes('--background');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.flexhrm.agent');
}

function isConnected(): boolean {
  return !!apiClient.getConfig()?.authToken;
}

function canUserQuit(): boolean {
  if (forceQuit || isDev || process.argv.includes('--allow-quit')) return true;
  return !isConnected();
}

function getIconPath(): string {
  if (isDev) {
    return path.join(__dirname, '..', 'assets', 'icon.ico');
  }
  return path.join(process.resourcesPath, 'icon.ico');
}

function loadTrayIcon(): Electron.NativeImage {
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) {
    return icon.resize({ width: 16, height: 16 });
  }
  return nativeImage.createEmpty();
}

function enableAutoLaunch() {
  const settings: Electron.Settings = {
    openAtLogin: true,
    openAsHidden: true,
    args: ['--background'],
  };
  if (process.platform === 'win32') {
    settings.path = process.execPath;
  }
  app.setLoginItemSettings(settings);
}

function disableAutoLaunch() {
  app.setLoginItemSettings({ openAtLogin: false });
}

function hideFromTaskbar() {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
}

function showInTaskbar() {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
  }
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

function createSetupWindow() {
  if (isConnected()) return;

  if (setupWindow) {
    setupWindow.show();
    setupWindow.focus();
    return;
  }

  setupWindow = new BrowserWindow({
    width: 440,
    height: 520,
    resizable: false,
    show: false,
    skipTaskbar: true,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    title: APP_NAME,
  });

  setupWindow.once('ready-to-show', () => {
    setupWindow?.show();
  });

  setupWindow.loadFile(path.join(__dirname, 'renderer', 'setup.html'));
  setupWindow.on('close', (event) => {
    if (isConnected()) {
      event.preventDefault();
      setupWindow?.hide();
      return;
    }
    if (startedInBackground && !isDev) {
      event.preventDefault();
      setupWindow?.hide();
    }
  });
  setupWindow.on('closed', () => {
    setupWindow = null;
    hideFromTaskbar();
  });
}

function buildTrayMenu(): Electron.MenuItemConstructorOptions[] {
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: APP_NAME, enabled: false },
    { type: 'separator' },
    {
      label: 'Open Setup',
      click: () => createSetupWindow(),
    },
  ];

  if (canUserQuit()) {
    items.push({
      label: 'Quit',
      click: () => {
        forceQuit = true;
        app.quit();
      },
    });
  }

  return items;
}

function createTray() {
  if (tray || isConnected() || (startedInBackground && !isDev)) return;

  tray = new Tray(loadTrayIcon());
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu()));
  tray.on('double-click', () => createSetupWindow());
}

function enterHiddenBackgroundMode() {
  destroyTray();
  ensureHiddenBackgroundWindow();
  hideFromTaskbar();
  if (setupWindow) {
    setupWindow.hide();
  }
}

function startPersistenceWatchdog() {
  if (persistenceWatchdog) return;
  persistenceWatchdog = setInterval(() => {
    if (!isConnected()) return;
    enterHiddenBackgroundMode();
    if (!monitorEngine.isRunning()) {
      startInputListener((type, data) => {
        monitorEngine.recordInput(type, data);
      });
      monitorEngine.start();
    }
    enableAutoLaunch();
  }, WATCHDOG_INTERVAL_MS);
}

function stopPersistenceWatchdog() {
  if (!persistenceWatchdog) return;
  clearInterval(persistenceWatchdog);
  persistenceWatchdog = null;
}

async function startMonitoring() {
  startInputListener((type, data) => {
    monitorEngine.recordInput(type, data);
  });
  monitorEngine.start();
  enableAutoLaunch();
  enterHiddenBackgroundMode();
  startPersistenceWatchdog();
}

async function stopMonitoring() {
  stopPersistenceWatchdog();
  stopInputListener();
  monitorEngine.stop();
  disableAutoLaunch();
  destroyHiddenBackgroundWindow();
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  forceQuit = true;
  app.quit();
} else {
  app.on('second-instance', () => {
    if (isConnected()) return;
    if (setupWindow) {
      if (setupWindow.isMinimized()) setupWindow.restore();
      setupWindow.show();
      setupWindow.focus();
      return;
    }
    createSetupWindow();
  });
}

app.whenReady().then(async () => {
  bindSetupWindow(() => setupWindow);
  ipcMain.handle('agent:test-connection', async (_e, apiBaseUrl: string) => apiClient.testConnection(apiBaseUrl));
  ipcMain.handle('agent:get-device-info', () => collectDeviceInfo());
  ipcMain.handle('agent:register', async (_e, payload: Record<string, unknown>) => {
    const wasConnected = isConnected();
    const deviceInfo = await collectDeviceInfo();
    const config = await apiClient.register({
      ...payload,
      ...deviceInfo,
      deviceName: payload.deviceName || deviceInfo.domainName,
      consentAccepted: true,
    });
    await startMonitoring();
    if (!wasConnected && setupWindow) {
      setupWindow.hide();
    }
    return config;
  });
  ipcMain.handle('agent:revoke', async () => {
    await apiClient.revoke();
    await stopMonitoring();
    createTray();
    createSetupWindow();
    return { success: true };
  });
  ipcMain.handle('agent:get-config', () => apiClient.getConfig());
  ipcMain.handle('agent:record-input', (_e, type: string, data?: { x?: number; y?: number }) => {
    monitorEngine.recordInput(type as 'key' | 'click' | 'scroll' | 'move', data);
  });

  if (isConnected()) {
    await startMonitoring();
  } else if (!startedInBackground || isDev) {
    createTray();
    createSetupWindow();
  } else {
    ensureHiddenBackgroundWindow();
    hideFromTaskbar();
  }
});

app.on('window-all-closed', () => {
  // Hidden background shell keeps the process alive while connected.
});

app.on('activate', () => {
  if (isConnected()) return;
  if (!setupWindow) {
    createSetupWindow();
  }
});

app.on('before-quit', (event) => {
  if (!canUserQuit()) {
    event.preventDefault();
    return;
  }
  stopPersistenceWatchdog();
  stopInputListener();
  monitorEngine.stop();
  destroyHiddenBackgroundWindow();
  destroyTray();
});
