import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import si from 'systeminformation';

const execFileAsync = promisify(execFile);

export interface UsbEventPayload {
  id: string;
  event: 'connected' | 'removed';
  deviceName: string;
  serialNumber?: string;
  timestamp: string;
}

export interface PrinterEventPayload {
  id: string;
  printerName: string;
  printCount: number;
  timestamp: string;
}

export interface FileActivityPayload {
  id: string;
  action: 'created' | 'modified' | 'renamed' | 'copied';
  filePath: string;
  fileName: string;
  timestamp: string;
}

let usbSnapshot: Set<string> | null = null;
let printJobBaseline = 0;
const watchedFileMtimes = new Map<string, number>();
let fileBaselineReady = false;

function usbKey(device: { name?: string; vendor?: string; serialNumber?: string }): string {
  return `${device.vendor ?? ''}|${device.name ?? ''}|${device.serialNumber ?? ''}`;
}

export async function collectUsbEvents(): Promise<UsbEventPayload[]> {
  const events: UsbEventPayload[] = [];
  try {
    const devices = await si.usb();
    const next = new Set<string>();
    for (const d of devices) {
      const key = usbKey(d);
      next.add(key);
      if (usbSnapshot && !usbSnapshot.has(key)) {
        events.push({
          id: randomUUID(),
          event: 'connected',
          deviceName: d.name || d.manufacturer || 'USB device',
          serialNumber: d.serialNumber || '',
          timestamp: new Date().toISOString(),
        });
      }
    }
    if (usbSnapshot) {
      for (const key of usbSnapshot) {
        if (!next.has(key)) {
          const [vendor, name, serial] = key.split('|');
          events.push({
            id: randomUUID(),
            event: 'removed',
            deviceName: name || vendor || 'USB device',
            serialNumber: serial || '',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    usbSnapshot = next;
  } catch {
    /* ignore */
  }
  return events;
}

export async function collectPrintEvents(): Promise<PrinterEventPayload[]> {
  if (process.platform !== 'win32') return [];
  try {
    const ps = `
$jobs = Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue
$count = if ($jobs) { @($jobs).Count } else { 0 }
Write-Output $count
`;
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { timeout: 8000 });
    const count = parseInt(stdout.trim(), 10) || 0;
    if (printJobBaseline === 0) {
      printJobBaseline = count;
      return [];
    }
    if (count > printJobBaseline) {
      const delta = count - printJobBaseline;
      printJobBaseline = count;
      return [{
        id: randomUUID(),
        printerName: 'Windows Print Spooler',
        printCount: delta,
        timestamp: new Date().toISOString(),
      }];
    }
    printJobBaseline = count;
  } catch {
    /* ignore */
  }
  return [];
}

function scanDirectory(dir: string, events: FileActivityPayload[], depth = 0) {
  if (depth > 2 || !fs.existsSync(dir)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries.slice(0, 40)) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      const mtime = stat.mtimeMs;
      const prev = watchedFileMtimes.get(full);
      if (prev === undefined) {
        watchedFileMtimes.set(full, mtime);
        if (fileBaselineReady) {
          events.push({
            id: randomUUID(),
            action: 'created',
            filePath: full,
            fileName: entry.name,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (mtime > prev + 1000) {
        watchedFileMtimes.set(full, mtime);
        events.push({
          id: randomUUID(),
          action: 'modified',
          filePath: full,
          fileName: entry.name,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      /* ignore */
    }
  }
}

export function collectFileActivity(): FileActivityPayload[] {
  const home = os.homedir();
  const dirs = [
    path.join(home, 'Desktop'),
    path.join(home, 'Documents'),
    path.join(home, 'Downloads'),
  ];
  const events: FileActivityPayload[] = [];
  for (const dir of dirs) scanDirectory(dir, events);
  fileBaselineReady = true;
  return events.slice(0, 20);
}
