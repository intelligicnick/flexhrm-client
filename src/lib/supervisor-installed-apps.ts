export type InstalledApp = {
  packageName: string;
  appName?: string;
};

export type DetectedBlockedApp = {
  blockedEntry: string;
  packageName: string;
  appName?: string;
};

type NativeAndroidBridge = {
  getApiBase?: () => string;
  getDeviceId?: () => string;
  getInstalledApps?: () => string;
  getInstalledPackages?: () => string;
  uninstallApp?: (packageName: string) => void;
  openUninstall?: (packageName: string) => void;
  isNativeApp?: () => boolean;
};

declare global {
  interface Window {
    FlexHrmAndroid?: NativeAndroidBridge;
    Android?: NativeAndroidBridge;
  }
}

const KNOWN_APP_PACKAGES: Record<string, string[]> = {
  whatsapp: ["com.whatsapp", "com.whatsapp.w4b"],
  "whatsapp business": ["com.whatsapp.w4b"],
  telegram: ["org.telegram.messenger", "org.telegram.messenger.web"],
  facebook: ["com.facebook.katana", "com.facebook.lite"],
  instagram: ["com.instagram.android"],
  snapchat: ["com.snapchat.android"],
  tiktok: ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill"],
  twitter: ["com.twitter.android"],
  x: ["com.twitter.android"],
  zoom: ["us.zoom.videomeetings"],
  teams: ["com.microsoft.teams"],
  discord: ["com.discord"],
  signal: ["org.thoughtcrime.securesms"],
  viber: ["com.viber.voip"],
  wechat: ["com.tencent.mm"],
  truecaller: ["com.truecaller"],
  shareit: ["com.lenovo.anyshare.gps"],
  pubg: ["com.tencent.ig", "com.pubg.imobile"],
  "free fire": ["com.dts.freefireth", "com.dts.freefiremax"],
  anyto: ["com.imyfone.anytoandroid", "com.tenorshare.ianygo"],
  "imyfone anyto": ["com.imyfone.anytoandroid"],
  "tenorshare ianygo": ["com.tenorshare.ianygo"],
  "unicool tailorgo": ["com.unictool.tailorgo", "com.tailorgo.virtual"],
  tailorgo: ["com.unictool.tailorgo", "com.tailorgo.virtual"],
  "fake gps": ["com.lexa.fakegps", "com.incorporateapps.fakegps.fre", "com.blogspot.newapphorizons.fakegps"],
  "virtual location": ["com.lexa.fakegps", "com.imyfone.anytoandroid"],
  locationsimulator: ["com.lexa.fakegps", "com.incorporateapps.fakegps.fre"],
  "dr.fone virtual location": ["com.wondershare.drfonevirtuallocation"],
  "3utools": ["com.3u.tools"],
  "easeus mobianygo": ["com.easeus.mobianygo"],
  "wootechy imovego": ["com.wootechy.imovego"],
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function looksLikePackageName(value: string): boolean {
  const trimmed = value.trim();
  return /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(trimmed);
}

export function parseBlockedAppEntry(entry: string): { label: string; packageNames: string[] } {
  const trimmed = entry.trim();
  if (!trimmed) return { label: "", packageNames: [] };

  const pipeParts = trimmed.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    const label = pipeParts[0];
    const packageNames = pipeParts.slice(1).filter(looksLikePackageName);
    if (packageNames.length > 0) {
      return { label, packageNames };
    }
  }

  if (looksLikePackageName(trimmed)) {
    return { label: trimmed, packageNames: [trimmed] };
  }

  const known = KNOWN_APP_PACKAGES[normalizeKey(trimmed)];
  if (known?.length) {
    return { label: trimmed, packageNames: known };
  }

  return { label: trimmed, packageNames: [] };
}

function exactLabelMatch(label: string, installedApps: InstalledApp[]): InstalledApp | undefined {
  const labelNorm = normalizeKey(label);
  for (const app of installedApps) {
    if (app.appName && normalizeKey(app.appName) === labelNorm) {
      return app;
    }
  }
  return undefined;
}

function parseInstalledAppsPayload(raw: string): InstalledApp[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): InstalledApp | null => {
        if (typeof item === "string") {
          return { packageName: item.trim() };
        }
        if (item && typeof item === "object") {
          const packageName = String(item.packageName || item.package || "").trim();
          const appName = String(item.appName || item.label || item.name || "").trim();
          if (!packageName) return null;
          return { packageName, appName: appName || undefined };
        }
        return null;
      })
      .filter((item): item is InstalledApp => item !== null);
  } catch {
    return [];
  }
}

export function canScanInstalledApps(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = window.FlexHrmAndroid || window.Android;
  return Boolean(bridge?.getInstalledApps || bridge?.getInstalledPackages);
}

export function isFlexHrmNativeApp(): boolean {
  if (typeof window !== "undefined") {
    const bridge = window.FlexHrmAndroid || window.Android;
    if (bridge?.isNativeApp?.()) return true;
  }
  return typeof navigator !== "undefined" && /FlexHrmSupervisor/i.test(navigator.userAgent);
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (typeof window === "undefined") return [];

  const bridge = window.FlexHrmAndroid || window.Android;
  if (!bridge) return [];

  try {
    const raw = bridge.getInstalledApps?.() ?? bridge.getInstalledPackages?.();
    if (!raw) return [];
    return parseInstalledAppsPayload(raw);
  } catch {
    return [];
  }
}

export function findInstalledBlockedApps(
  blockedEntries: string[],
  installedApps: InstalledApp[],
): DetectedBlockedApp[] {
  const installedByPackage = new Map<string, InstalledApp>();

  for (const app of installedApps) {
    installedByPackage.set(normalizeKey(app.packageName), app);
  }

  const detected: DetectedBlockedApp[] = [];
  const seen = new Set<string>();

  for (const entry of blockedEntries) {
    const { label, packageNames } = parseBlockedAppEntry(entry);
    if (!label) continue;

    let match: InstalledApp | undefined;

    for (const packageName of packageNames) {
      match = installedByPackage.get(normalizeKey(packageName));
      if (match) break;
    }

    if (!match) {
      match = exactLabelMatch(label, installedApps);
    }

    if (!match) continue;

    const dedupeKey = normalizeKey(match.packageName);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    detected.push({
      blockedEntry: entry,
      packageName: match.packageName,
      appName: match.appName || label,
    });
  }

  return detected;
}

export function openAppUninstall(packageName: string): boolean {
  if (typeof window === "undefined" || !packageName.trim()) return false;

  const bridge = window.FlexHrmAndroid || window.Android;
  if (bridge?.uninstallApp) {
    bridge.uninstallApp(packageName);
    return true;
  }
  if (bridge?.openUninstall) {
    bridge.openUninstall(packageName);
    return true;
  }

  return false;
}
