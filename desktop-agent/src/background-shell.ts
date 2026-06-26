import { BrowserWindow } from 'electron';

let backgroundWindow: BrowserWindow | null = null;

export function ensureHiddenBackgroundWindow() {
  if (backgroundWindow && !backgroundWindow.isDestroyed()) return;

  backgroundWindow = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    x: -32000,
    y: -32000,
    skipTaskbar: true,
    frame: false,
    focusable: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    fullscreenable: false,
    transparent: true,
    opacity: 0,
    hasShadow: false,
    thickFrame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  backgroundWindow.setMenuBarVisibility(false);
  backgroundWindow.on('close', (event) => {
    if (backgroundWindow) event.preventDefault();
  });
  void backgroundWindow.loadURL('about:blank');
}

export function destroyHiddenBackgroundWindow() {
  if (!backgroundWindow) return;
  backgroundWindow.removeAllListeners('close');
  if (!backgroundWindow.isDestroyed()) backgroundWindow.destroy();
  backgroundWindow = null;
}
