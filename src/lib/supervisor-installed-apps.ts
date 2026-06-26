import { allSignificantTokensMatch } from "./supervisor-blocked-apps-defaults";
import blockedAppPackagesJson from "../../shared/blocked-app-packages.json";

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

const OWN_PACKAGE = "com.flexhrm.supervisor";
const MIN_PARTIAL_LABEL_LENGTH = 3;

const KNOWN_APP_PACKAGES: Record<string, string[]> = blockedAppPackagesJson as Record<string, string[]>;

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

function installedAppMatchesBlockedEntry(installed: InstalledApp, entry: string): boolean {
  const { label, packageNames } = parseBlockedAppEntry(entry);
  if (!label) return false;

  const packageNorm = normalizeKey(installed.packageName);
  const appLabelNorm = installed.appName ? normalizeKey(installed.appName) : "";
  const blockedLabelNorm = normalizeKey(label);

  for (const blockedPackage of packageNames) {
    if (packageNorm === normalizeKey(blockedPackage)) return true;
  }

  if (looksLikePackageName(label) && packageNorm === blockedLabelNorm) {
    return true;
  }

  if (appLabelNorm && appLabelNorm === blockedLabelNorm) {
    return true;
  }

  if (appLabelNorm && blockedLabelNorm.length >= MIN_PARTIAL_LABEL_LENGTH) {
    if (appLabelNorm.includes(blockedLabelNorm) || blockedLabelNorm.includes(appLabelNorm)) {
      return true;
    }
  }

  if (appLabelNorm && allSignificantTokensMatch(blockedLabelNorm, appLabelNorm, packageNorm)) {
    return true;
  }

  return false;
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

/** Scans every installed app against the configured blocked list from admin settings. */
export function findInstalledBlockedApps(
  blockedEntries: string[],
  installedApps: InstalledApp[],
): DetectedBlockedApp[] {
  const configuredEntries = blockedEntries
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!configuredEntries.length) return [];

  const detected: DetectedBlockedApp[] = [];
  const seen = new Set<string>();
  const ownPackageNorm = normalizeKey(OWN_PACKAGE);

  for (const installed of installedApps) {
    const packageNorm = normalizeKey(installed.packageName);
    if (packageNorm === ownPackageNorm) continue;

    let matchedEntry: string | undefined;
    for (const entry of configuredEntries) {
      if (installedAppMatchesBlockedEntry(installed, entry)) {
        matchedEntry = entry;
        break;
      }
    }

    if (!matchedEntry || seen.has(packageNorm)) continue;
    seen.add(packageNorm);

    detected.push({
      blockedEntry: matchedEntry,
      packageName: installed.packageName,
      appName: installed.appName || installed.packageName,
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
