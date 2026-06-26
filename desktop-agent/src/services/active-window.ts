import { execFile } from 'child_process';
import { promisify } from 'util';
import activeWindow from 'active-win';

const execFileAsync = promisify(execFile);

export interface ActiveWindowInfo {
  appName: string;
  windowTitle: string;
  processName: string;
  url: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

const MEETING_APPS = ['zoom', 'teams', 'meet.google'];

export function isMeetingApp(appName: string): boolean {
  const lower = appName.toLowerCase();
  return MEETING_APPS.some((m) => lower.includes(m));
}

async function getActiveWindowFallback(): Promise<ActiveWindowInfo> {
  if (process.platform === 'win32') {
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$title = New-Object System.Text.StringBuilder 256
[void][Win32]::GetWindowText($hwnd, $title, 256)
$pid = 0
[void][Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
$procName = if ($proc) { $proc.ProcessName } else { "unknown" }
Write-Output ($procName + "|" + $title.ToString())
`;
    try {
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { timeout: 5000 });
      const line = stdout.trim().split('\n').pop()?.trim() ?? '';
      const [processName, ...titleParts] = line.split('|');
      const windowTitle = titleParts.join('|');
      const appName = processName || 'unknown';
      const url = extractUrlFromTitle(windowTitle);
      return { appName, windowTitle, processName: appName, url };
    } catch {
      return { appName: 'unknown', windowTitle: '', processName: 'unknown', url: '' };
    }
  }

  if (process.platform === 'darwin') {
    try {
      const { stdout: appStdout } = await execFileAsync('osascript', [
        '-e',
        'tell application "System Events" to get name of first application process whose frontmost is true',
      ]);
      const appName = appStdout.trim();
      let windowTitle = appName;
      try {
        const { stdout: titleStdout } = await execFileAsync('osascript', [
          '-e',
          'tell application "System Events" to get title of front window of (first application process whose frontmost is true)',
        ]);
        windowTitle = titleStdout.trim() || appName;
      } catch {
        /* ignore */
      }
      const url = extractUrlFromTitle(windowTitle);
      return { appName, windowTitle, processName: appName, url };
    } catch {
      return { appName: 'unknown', windowTitle: '', processName: 'unknown', url: '' };
    }
  }

  return { appName: 'unknown', windowTitle: '', processName: 'unknown', url: '' };
}

export async function getActiveWindow(): Promise<ActiveWindowInfo> {
  try {
    const result = await activeWindow({
      accessibilityPermission: true,
      screenRecordingPermission: true,
    });
    if (result) {
      const appName = result.owner.name || 'unknown';
      const processName = result.owner.name || 'unknown';
      const windowTitle = result.title || appName;
      let url = '';
      if (result.platform === 'macos') {
        url = result.url?.trim() ?? '';
      } else if (process.platform === 'win32') {
        url = await getWindowsBrowserUrl(processName, windowTitle);
      }
      url = url || extractUrlFromTitle(windowTitle);
      return { appName, windowTitle, processName, url, bounds: result.bounds };
    }
  } catch {
    /* fall through */
  }
  return getActiveWindowFallback();
}

async function getWindowsBrowserUrl(processName: string, windowTitle: string): Promise<string> {
  const proc = processName.toLowerCase();
  if (!/(chrome|msedge|firefox|brave|opera)/i.test(proc)) {
    return extractUrlFromTitle(windowTitle);
  }
  return extractUrlFromTitle(windowTitle);
}

export function extractUrlFromTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return '';

  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) return urlMatch[0].replace(/[)\]}>.,;]+$/, '');

  const domainInTitle = trimmed.match(/\b([\w-]+\.(com|org|net|io|co|in|edu|gov|dev))(?:\/[^\s|–-]*)?/i);
  if (domainInTitle) return `https://${domainInTitle[0].replace(/^https?:\/\//i, '')}`;

  const dashParts = trimmed.split(/\s[-–|]\s/);
  if (dashParts.length >= 2) {
    const pagePart = dashParts[0].trim();
    const domainOnly = pagePart.match(/^[\w-]+\.[\w.-]+$/);
    if (domainOnly) return `https://${domainOnly[0]}`;
  }

  return '';
}
