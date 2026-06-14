import { AppNotification } from "../types";

const POLL_INTERVAL_MS = 45_000;
const SOUND_ENABLED_KEY = "hrms_notification_sound";
const PUSH_ENABLED_KEY = "hrms_notification_push";

let audioContext: AudioContext | null = null;

export function isNotificationSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_ENABLED_KEY) !== "false";
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? "true" : "false");
}

export function isBrowserPushEnabled(): boolean {
  return localStorage.getItem(PUSH_ENABLED_KEY) !== "false";
}

export function setBrowserPushEnabled(enabled: boolean): void {
  localStorage.setItem(PUSH_ENABLED_KEY, enabled ? "true" : "false");
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function playNotificationSound(): void {
  if (!isNotificationSoundEnabled()) return;
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    const ctx = audioContext;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.26);
  } catch {
    /* ignore audio failures */
  }
}

export function showBrowserNotification(title: string, body: string): void {
  if (!isBrowserPushEnabled()) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `flexhrm-${Date.now()}`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    /* ignore */
  }
}

export function alertForNewNotifications(
  previousCount: number,
  nextCount: number,
  latest?: AppNotification | null,
): void {
  if (nextCount <= previousCount) return;
  playNotificationSound();
  const title = latest?.title || "New notification";
  const body = latest?.message || `You have ${nextCount} unread notification(s).`;
  showBrowserNotification(title, body);
}

export { POLL_INTERVAL_MS };
