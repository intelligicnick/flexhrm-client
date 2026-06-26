import type { BrowserWindow } from 'electron';

let getWindow: (() => BrowserWindow | null) | null = null;

export function bindSetupWindow(getter: () => BrowserWindow | null) {
  getWindow = getter;
}

export async function hideForScreenshot<T>(work: () => Promise<T>): Promise<T> {
  const win = getWindow?.() ?? null;
  const restore = !!(win && !win.isDestroyed() && win.isVisible());
  if (restore) win!.hide();
  if (restore) await new Promise((resolve) => setTimeout(resolve, 120));
  try {
    return await work();
  } finally {
    if (restore && win && !win.isDestroyed()) win.show();
  }
}
