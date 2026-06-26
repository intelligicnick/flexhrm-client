import { randomUUID } from 'crypto';
import { powerMonitor, desktopCapturer, screen } from 'electron';
import { apiClient } from './api-client';
import { getActiveWindow, isMeetingApp } from './active-window';
import { collectUsbEvents, collectPrintEvents, collectFileActivity } from './device-collectors';
import { hideForScreenshot } from './setup-window';
import {
  isAgentWindow,
  resolveTrackedWebsite,
  shouldTrackWindow,
} from './activity-filter';
import { isWithinWorkingHours } from './working-hours';

function shouldCropToActiveWindow(
  captureActiveOnly: boolean,
  bounds?: { x: number; y: number; width: number; height: number },
): bounds is { x: number; y: number; width: number; height: number } {
  if (!captureActiveOnly || !bounds) return false;
  return bounds.width >= 240 && bounds.height >= 180;
}

function getPrimaryScreenSource(sources: Electron.DesktopCapturerSource[]) {
  const display = screen.getPrimaryDisplay();
  return (
    sources.find((source) => source.display_id === String(display.id)) ??
    sources.find((source) => /screen:0/i.test(source.id)) ??
    sources[0]
  );
}

const MIN_APP_SESSION_SECONDS = 3;

interface AppSession {
  id: string;
  appName: string;
  windowTitle: string;
  processName: string;
  startTime: Date;
}

interface IdleSession {
  id: string;
  startTime: Date;
  type: 'idle' | 'long_idle';
}

interface BreakSession {
  id: string;
  startTime: Date;
}

export class MonitorEngine {
  private interval: NodeJS.Timeout | null = null;
  private screenshotInterval: NodeJS.Timeout | null = null;
  private lastInputAt = Date.now();
  private loginTime: Date | null = null;
  private logoutTime: Date | null = null;
  private currentApp: AppSession | null = null;
  private idleSession: IdleSession | null = null;
  private breakSession: BreakSession | null = null;
  private activeSeconds = 0;
  private idleSeconds = 0;
  private meetingSeconds = 0;
  private meetingCount = 0;
  private keyCount = 0;
  private mouseClicks = 0;
  private scrollCount = 0;
  private mouseDistance = 0;
  private lastMousePos = { x: 0, y: 0 };
  private locked = false;
  private pendingIngest: Record<string, unknown> = {};
  private onBreakStateChange?: (onBreak: boolean) => void;
  private currentWebsite: {
    id: string;
    browserName: string;
    url: string;
    pageTitle: string;
    visitTime: string;
    durationSeconds: number;
  } | null = null;
  private liveViewSessionId: string | null = null;
  private liveViewCommandId: string | null = null;
  private liveViewInterval: NodeJS.Timeout | null = null;
  private processedCommandIds = new Set<string>();
  private lastScreenshotScheduleKey = '';
  private powerHandlers: {
    lock: () => void;
    unlock: () => void;
    suspend: () => void;
    resume: () => void;
  } | null = null;

  setBreakStateListener(cb: (onBreak: boolean) => void) {
    this.onBreakStateChange = cb;
  }

  isOnBreak() {
    return !!this.breakSession;
  }

  startBreak() {
    if (this.breakSession) return;
    this.breakSession = { id: randomUUID(), startTime: new Date() };
    this.onBreakStateChange?.(true);
  }

  endBreak() {
    if (!this.breakSession) return;
    const duration = Math.round((Date.now() - this.breakSession.startTime.getTime()) / 1000);
    this.pendingIngest.breakEvents = [
      ...((this.pendingIngest.breakEvents as unknown[]) ?? []),
      {
        id: this.breakSession.id,
        startTime: this.breakSession.startTime.toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds: duration,
      },
    ];
    this.breakSession = null;
    this.onBreakStateChange?.(false);
  }

  isRunning(): boolean {
    return this.interval !== null;
  }

  start() {
    if (this.interval) return;
    this.loginTime = new Date();
    this.interval = setInterval(() => this.tick(), 10000);
    this.refreshScreenshotSchedule(apiClient.getConfig());

    this.powerHandlers = {
      lock: () => { this.locked = true; },
      unlock: () => { this.locked = false; this.lastInputAt = Date.now(); },
      suspend: () => { this.locked = true; },
      resume: () => { this.locked = false; this.lastInputAt = Date.now(); },
    };
    powerMonitor.on('lock-screen', this.powerHandlers.lock);
    powerMonitor.on('unlock-screen', this.powerHandlers.unlock);
    powerMonitor.on('suspend', this.powerHandlers.suspend);
    powerMonitor.on('resume', this.powerHandlers.resume);
  }

  stop() {
    if (this.breakSession) this.endBreak();
    if (this.idleSession) this.endIdle();
    if (this.currentApp) this.endAppSession();
    this.flushWebsiteSession();
    this.logoutTime = new Date();
    void apiClient.ingest({
      activity: {
        loginTime: this.loginTime?.toISOString(),
        logoutTime: this.logoutTime.toISOString(),
        totalLoggedSeconds: this.activeSeconds + this.idleSeconds,
        activeSeconds: this.activeSeconds,
        idleSeconds: this.idleSeconds,
        meetingSeconds: this.meetingSeconds,
        meetingCount: this.meetingCount,
      },
      breakEvents: (this.pendingIngest.breakEvents as unknown[]) ?? [],
    });
    this.pendingIngest = {};
    if (this.interval) clearInterval(this.interval);
    if (this.screenshotInterval) clearInterval(this.screenshotInterval);
    if (this.liveViewInterval) clearInterval(this.liveViewInterval);
    this.interval = null;
    this.screenshotInterval = null;
    this.liveViewInterval = null;
    this.lastScreenshotScheduleKey = '';
    if (this.powerHandlers) {
      powerMonitor.removeListener('lock-screen', this.powerHandlers.lock);
      powerMonitor.removeListener('unlock-screen', this.powerHandlers.unlock);
      powerMonitor.removeListener('suspend', this.powerHandlers.suspend);
      powerMonitor.removeListener('resume', this.powerHandlers.resume);
      this.powerHandlers = null;
    }
  }

  recordInput(type: 'key' | 'click' | 'scroll' | 'move', data?: { x?: number; y?: number; keyLabel?: string }) {
    if (this.locked || this.breakSession) return;
    this.lastInputAt = Date.now();
    if (type === 'key') this.keyCount += 1;
    if (type === 'click') this.mouseClicks += 1;
    if (type === 'scroll') this.scrollCount += 1;
    if (type === 'move' && data?.x !== undefined && data?.y !== undefined) {
      const dx = data.x - this.lastMousePos.x;
      const dy = data.y - this.lastMousePos.y;
      this.mouseDistance += Math.sqrt(dx * dx + dy * dy);
      this.lastMousePos = { x: data.x, y: data.y };
    }
    if (this.idleSession) this.endIdle();
  }

  private refreshScreenshotSchedule(config: ReturnType<typeof apiClient.getConfig>) {
    if (!config?.features?.screenshots) {
      if (this.screenshotInterval) {
        clearInterval(this.screenshotInterval);
        this.screenshotInterval = null;
      }
      this.lastScreenshotScheduleKey = '';
      return;
    }

    const shot = config.screenshot as { mode?: string; intervalMinutes?: number } | undefined;
    const mode = shot?.mode ?? 'fixed_10';
    let mins = shot?.intervalMinutes ?? 10;
    if (mode === 'fixed_5') mins = 5;
    else if (mode === 'fixed_15') mins = 15;
    else if (mode === 'fixed_10') mins = 10;

    const key = `${mode}:${mins}`;
    if (key === this.lastScreenshotScheduleKey) return;

    if (this.screenshotInterval) clearInterval(this.screenshotInterval);
    this.lastScreenshotScheduleKey = key;
    const jitter = mode === 'random' ? Math.random() * mins * 60000 : 0;
    this.screenshotInterval = setInterval(
      () => { void this.captureScreenshot({ source: 'scheduled' }); },
      mins * 60 * 1000 + jitter,
    );
  }

  private async captureScreenshot(opts?: {
    source?: 'scheduled' | 'on_demand' | 'live_view';
    commandId?: string;
    sessionId?: string;
  }) {
    try {
      await hideForScreenshot(async () => {
        const config = apiClient.getConfig();
        const win = await getActiveWindow();
        if (isAgentWindow(win.appName, win.windowTitle)) return;

        const disabled = (config?.screenshot as { disabledApps?: string[] } | undefined)?.disabledApps ?? [];
        if (disabled.some((app) => win.appName.toLowerCase().includes(app.toLowerCase()))) return;

        const isLiveView = opts?.source === 'live_view';
        const captureActiveOnly = !isLiveView && config?.screenshot?.captureActiveWindowOnly === true;
        const display = screen.getPrimaryDisplay();
        const screenW = display.size.width;
        const screenH = display.size.height;
        const thumbSize = {
          width: Math.min(1920, screenW),
          height: Math.min(1080, screenH),
        };

        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: thumbSize });
        const source = getPrimaryScreenSource(sources);
        if (!source?.thumbnail) return;

        let image = source.thumbnail;
        const cropBounds = shouldCropToActiveWindow(captureActiveOnly, win.bounds) ? win.bounds : null;
        if (cropBounds) {
          const thumb = image.getSize();
          const scaleX = thumb.width / screenW;
          const scaleY = thumb.height / screenH;
          const x = Math.max(0, Math.round(cropBounds.x * scaleX));
          const y = Math.max(0, Math.round(cropBounds.y * scaleY));
          const width = Math.min(thumb.width - x, Math.round(cropBounds.width * scaleX));
          const height = Math.min(thumb.height - y, Math.round(cropBounds.height * scaleY));
          if (width >= 120 && height >= 90) {
            image = image.crop({ x, y, width, height });
          }
        }

        const shotId = randomUUID();
        const imageBase64 = image.toJPEG(80).toString('base64');
        await apiClient.uploadScreenshot({
          id: shotId,
          imageBase64,
          windowTitle: win.windowTitle,
          appName: win.appName,
          timestamp: new Date().toISOString(),
          source: opts?.source ?? 'scheduled',
          commandId: opts?.commandId ?? opts?.sessionId ?? '',
        });

        if (opts?.commandId) {
          await apiClient.completeCommand(opts.commandId, shotId);
        }
      });
    } catch {
      if (opts?.commandId) await apiClient.completeCommand(opts.commandId, undefined, true);
    }
  }

  private async processCommands(commands: Array<{ id: string; type: string; liveViewSessionId?: string }> = []) {
    for (const cmd of commands) {
      if (this.processedCommandIds.has(cmd.id)) continue;
      this.processedCommandIds.add(cmd.id);

      if (cmd.type === 'capture_screenshot') {
        await this.captureScreenshot({ source: 'on_demand', commandId: cmd.id });
      } else if (cmd.type === 'start_live_view') {
        this.liveViewSessionId = cmd.liveViewSessionId ?? cmd.id;
        this.liveViewCommandId = cmd.id;
        const config = apiClient.getConfig();
        const secs = (config?.liveView?.captureIntervalSeconds ?? 5) * 1000;
        if (this.liveViewInterval) clearInterval(this.liveViewInterval);
        this.liveViewInterval = setInterval(() => {
          void this.captureScreenshot({
            source: 'live_view',
            sessionId: this.liveViewSessionId ?? undefined,
          });
        }, secs);
        await apiClient.completeCommand(cmd.id);
      } else if (cmd.type === 'stop_live_view') {
        if (this.liveViewInterval) clearInterval(this.liveViewInterval);
        this.liveViewInterval = null;
        this.liveViewSessionId = null;
        this.liveViewCommandId = null;
        await apiClient.completeCommand(cmd.id);
      }
    }
    if (this.processedCommandIds.size > 200) {
      this.processedCommandIds = new Set([...this.processedCommandIds].slice(-100));
    }
  }

  private async tick() {
    const config = await apiClient.refreshConfig() ?? apiClient.getConfig();
    if (!config) return;

    this.refreshScreenshotSchedule(config);

    await this.processCommands(config.commands ?? []);

    const outsideWorkingHours = !isWithinWorkingHours(config.workingHours);

    const now = Date.now();
    const idleMs = now - this.lastInputAt;
    const idleMinutes = config.idle?.idleMinutes ?? 5;
    const longIdleMinutes = config.idle?.longIdleMinutes ?? 15;
    const isIdle = idleMs >= idleMinutes * 60 * 1000;
    const isLongIdle = idleMs >= longIdleMinutes * 60 * 1000;

    if (isIdle && !this.idleSession) {
      this.startIdle(isLongIdle ? 'long_idle' : 'idle');
    } else if (!isIdle && this.idleSession) {
      this.endIdle();
    } else if (this.idleSession && isLongIdle && this.idleSession.type === 'idle') {
      this.endIdle();
      this.startIdle('long_idle');
    }

    if (!this.locked && !isIdle && !this.breakSession) this.activeSeconds += 10;
    else this.idleSeconds += 10;

    const rawWin = await getActiveWindow();
    const trackingPaused = this.locked || !!this.breakSession || isIdle || outsideWorkingHours;
    const trackableWin = trackingPaused || !shouldTrackWindow(rawWin) ? null : rawWin;

    if (trackableWin) {
      await this.trackApp(trackableWin);
      if (isMeetingApp(trackableWin.appName)) {
        this.meetingSeconds += 10;
      }
    } else if (this.currentApp) {
      this.endAppSession();
    }

    const url = trackableWin ? resolveTrackedWebsite(trackableWin) : null;
    const activityState = this.locked || this.breakSession
      ? 'idle'
      : isIdle
        ? (isLongIdle ? 'long_idle' : 'idle')
        : 'active';

    await apiClient.heartbeat({
      currentApp: trackableWin?.appName ?? '',
      currentWindow: trackableWin?.windowTitle ?? '',
      currentWebsite: url ?? '',
      activityState,
      todayActiveSeconds: this.activeSeconds,
      todayIdleSeconds: this.idleSeconds,
    });

    if (config.features?.websiteTracking && url && trackableWin) {
      const nowIso = new Date().toISOString();
      if (this.currentWebsite?.url === url) {
        this.currentWebsite.durationSeconds += 10;
        this.currentWebsite.pageTitle = trackableWin.windowTitle || this.currentWebsite.pageTitle;
      } else {
        this.flushWebsiteSession();
        this.currentWebsite = {
          id: randomUUID(),
          browserName: trackableWin.appName,
          url,
          pageTitle: trackableWin.windowTitle,
          visitTime: nowIso,
          durationSeconds: 10,
        };
      }
    } else if (this.currentWebsite) {
      this.flushWebsiteSession();
    }

    this.pendingIngest.activity = {
      loginTime: this.loginTime?.toISOString(),
      logoutTime: this.logoutTime?.toISOString(),
      totalLoggedSeconds: this.activeSeconds + this.idleSeconds,
      activeSeconds: this.activeSeconds,
      idleSeconds: this.idleSeconds,
      meetingSeconds: this.meetingSeconds,
      meetingCount: this.meetingCount,
    };

    this.pendingIngest.keyboardMouse = [{
      keyCount: config.keyboard?.trackKeystrokes !== false ? this.keyCount : 0,
      mouseClicks: config.keyboard?.trackMouseActivity !== false ? this.mouseClicks : 0,
      scrollCount: config.keyboard?.trackScrollActivity !== false ? this.scrollCount : 0,
      mouseDistance: config.keyboard?.trackMouseActivity !== false ? Math.round(this.mouseDistance) : 0,
      typingSpeed: this.keyCount > 0 ? Math.round((this.keyCount / Math.max(this.activeSeconds / 60, 1))) : 0,
      hour: new Date().toISOString().slice(0, 13),
    }];

    this.keyCount = 0;
    this.mouseClicks = 0;
    this.scrollCount = 0;
    this.mouseDistance = 0;

    if (!trackingPaused) {
      if (config.features?.usbMonitoring) {
        this.pendingIngest.usbEvents = [
          ...((this.pendingIngest.usbEvents as unknown[]) ?? []),
          ...(await collectUsbEvents()),
        ];
      }
      if (config.features?.printMonitoring) {
        this.pendingIngest.printerEvents = [
          ...((this.pendingIngest.printerEvents as unknown[]) ?? []),
          ...(await collectPrintEvents()),
        ];
      }
      if (config.features?.fileActivity) {
        this.pendingIngest.fileEvents = [
          ...((this.pendingIngest.fileEvents as unknown[]) ?? []),
          ...collectFileActivity(),
        ];
      }
    }

    await apiClient.ingest({ ...this.pendingIngest });
    this.pendingIngest = {};
  }

  private flushWebsiteSession() {
    if (!this.currentWebsite) return;
    this.pendingIngest.websiteEvents = [
      ...((this.pendingIngest.websiteEvents as unknown[]) ?? []),
      { ...this.currentWebsite },
    ];
    this.currentWebsite = null;
  }

  private endAppSession() {
    if (!this.currentApp) return;
    const duration = Math.round((Date.now() - this.currentApp.startTime.getTime()) / 1000);
    if (duration >= MIN_APP_SESSION_SECONDS) {
      this.pendingIngest.appEvents = [
        ...((this.pendingIngest.appEvents as unknown[]) ?? []),
        {
          id: this.currentApp.id,
          appName: this.currentApp.appName,
          windowTitle: this.currentApp.windowTitle,
          processName: this.currentApp.processName,
          startTime: this.currentApp.startTime.toISOString(),
          endTime: new Date().toISOString(),
          durationSeconds: duration,
        },
      ];
    }
    this.currentApp = null;
  }

  private async trackApp(win: { appName: string; windowTitle: string; processName: string }) {
    if (!shouldTrackWindow(win)) {
      if (this.currentApp) this.endAppSession();
      return;
    }
    if (this.currentApp?.appName === win.appName && this.currentApp?.windowTitle === win.windowTitle) return;

    if (this.currentApp) this.endAppSession();

    if (isMeetingApp(win.appName)) this.meetingCount += 1;

    this.currentApp = {
      id: randomUUID(),
      appName: win.appName,
      windowTitle: win.windowTitle,
      processName: win.processName,
      startTime: new Date(),
    };
  }

  private startIdle(type: 'idle' | 'long_idle') {
    this.idleSession = { id: randomUUID(), startTime: new Date(), type };
  }

  private endIdle() {
    if (!this.idleSession) return;
    const duration = Math.round((Date.now() - this.idleSession.startTime.getTime()) / 1000);
    this.pendingIngest.idleEvents = [
      ...((this.pendingIngest.idleEvents as unknown[]) ?? []),
      {
        id: this.idleSession.id,
        startTime: this.idleSession.startTime.toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds: duration,
        type: this.idleSession.type,
      },
    ];
    this.idleSession = null;
  }
}

export const monitorEngine = new MonitorEngine();
