import type { ActiveWindowInfo } from './active-window';
import { extractUrlFromTitle } from './active-window';

const AGENT_PATTERNS = ['flex hrm', 'flexhrm', 'desktop connection', 'flex hrm connect'];
const IGNORE_PATTERNS = [
  ...AGENT_PATTERNS,
  'windows input experience',
  'program manager',
  'searchhost',
  'startmenuexperiencehost',
  'shellexperiencehost',
  'textinputhost',
  'lockapp',
  'screen saver',
];
const BROWSER_PROCESSES = ['chrome', 'msedge', 'firefox', 'brave', 'opera', 'safari', 'vivaldi', 'arc', 'waterfox'];

export function isAgentWindow(appName: string, windowTitle: string): boolean {
  const haystack = `${appName} ${windowTitle}`.toLowerCase();
  return AGENT_PATTERNS.some((name) => haystack.includes(name));
}

export function isIgnorableWindow(appName: string, windowTitle: string, processName = ''): boolean {
  const haystack = `${appName} ${windowTitle} ${processName}`.toLowerCase().trim();
  if (!haystack || haystack === 'unknown') return true;
  return IGNORE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

export function isBrowserProcess(name: string): boolean {
  const lower = name.toLowerCase();
  return BROWSER_PROCESSES.some((browser) => lower.includes(browser));
}

export function resolveTrackedWebsite(win: ActiveWindowInfo): string | null {
  if (!isBrowserProcess(win.processName) && !isBrowserProcess(win.appName)) return null;

  const raw = win.url?.trim() || extractUrlFromTitle(win.windowTitle);
  if (!raw) return null;

  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    if (!host || host.length < 3 || !host.includes('.')) return null;
    if (host === 'localhost' || host.endsWith('.local')) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function shouldTrackWindow(win: {
  appName: string;
  windowTitle: string;
  processName?: string;
}): boolean {
  return !isIgnorableWindow(win.appName, win.windowTitle, win.processName ?? win.appName);
}

export function sanitizeActiveWindow(win: ActiveWindowInfo): ActiveWindowInfo | null {
  if (!shouldTrackWindow(win)) return null;
  return win;
}
