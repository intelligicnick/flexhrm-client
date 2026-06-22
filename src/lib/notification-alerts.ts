import { AppNotification } from "../types";
import { getSupervisorLang, SupervisorLang } from "./supervisor-i18n";
import { localizeSupervisorNotification } from "./supervisor-notifications-i18n";

const POLL_INTERVAL_MS = 45_000;
const SOUND_ENABLED_KEY = "hrms_notification_sound";
const PUSH_ENABLED_KEY = "hrms_notification_push";

let audioContext: AudioContext | null = null;
let audioPrimed = false;

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

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      audioContext = new AudioCtx();
    }
    void audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

/** Resume audio after first user gesture — required on mobile browsers and Android WebView. */
export function primeNotificationAudio(): void {
  if (audioPrimed) return;
  const ctx = getAudioContext();
  if (ctx) audioPrimed = true;
}

function scheduleChime(
  ctx: AudioContext,
  startTime: number,
  frequency: number,
  durationSec: number,
  volume = 0.82,
): void {
  const tone = ctx.createOscillator();
  const toneGain = ctx.createGain();
  tone.type = "sine";
  tone.frequency.setValueAtTime(frequency, startTime);

  const sparkle = ctx.createOscillator();
  const sparkleGain = ctx.createGain();
  sparkle.type = "triangle";
  sparkle.frequency.setValueAtTime(frequency * 2, startTime);

  toneGain.gain.setValueAtTime(0.0001, startTime);
  toneGain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  sparkleGain.gain.setValueAtTime(0.0001, startTime);
  sparkleGain.gain.exponentialRampToValueAtTime(volume * 0.22, startTime + 0.01);
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec * 0.65);

  tone.connect(toneGain);
  sparkle.connect(sparkleGain);
  toneGain.connect(ctx.destination);
  sparkleGain.connect(ctx.destination);
  tone.start(startTime);
  sparkle.start(startTime);
  tone.stop(startTime + durationSec);
  sparkle.stop(startTime + durationSec);
}

export function playNotificationSound(): void {
  if (!isNotificationSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    // Sweet ascending chime (C major) — warm bell tone, still loud and clear.
    scheduleChime(ctx, t, 523.25, 0.52, 0.84);
    scheduleChime(ctx, t + 0.16, 659.25, 0.52, 0.84);
    scheduleChime(ctx, t + 0.32, 783.99, 0.78, 0.9);

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([140, 70, 140]);
    }
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
  lang: SupervisorLang = getSupervisorLang(),
): void {
  if (nextCount <= previousCount) return;
  playNotificationSound();
  const localized = latest ? localizeSupervisorNotification(latest, lang) : null;
  const title = localized?.title || latest?.title || (lang === "hi" ? "नई सूचना" : "New notification");
  const body =
    localized?.message ||
    latest?.message ||
    (lang === "hi"
      ? `आपके पास ${nextCount} अपठित सूचनाएं हैं।`
      : `You have ${nextCount} unread notification(s).`);
  showBrowserNotification(title, body);
}

export { POLL_INTERVAL_MS };
