import { isFlexHrmNativeApp } from "./supervisor-installed-apps";

export type RoutePoint = {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number | null;
  bearing?: number | null;
  isMock?: boolean;
};

export type RouteSummary = {
  totalDistanceMeters: number;
  travelTimeMs: number;
  stopDurationMs: number;
  idleTimeMs: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  workingHoursMs: number;
  pointCount: number;
};

export type RoutePeriod = "today" | "yesterday" | "last7" | "last30" | "custom";

type TrackingBridge = {
  getRoutePoints?: (fromMs: number, toMs: number) => string;
  getRouteSummary?: (fromMs: number, toMs: number) => string;
  getTrackingStatus?: () => string;
  startTracking?: () => void;
  stopTracking?: () => void;
  isBatteryOptimizationDisabled?: () => boolean;
  openBatterySettings?: () => void;
  getDeviceIntegrity?: () => string;
};

function getBridge(): TrackingBridge | undefined {
  if (typeof window === "undefined" || !isFlexHrmNativeApp()) return undefined;
  return (window as Window & { FlexHrmAndroid?: TrackingBridge }).FlexHrmAndroid;
}

export function getRoutePeriodBounds(
  period: RoutePeriod,
  customDate?: string,
): { fromMs: number; toMs: number } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { fromMs: start.getTime(), toMs: end.getTime() };
  }

  if (period === "yesterday") {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const stop = new Date(start);
    stop.setHours(23, 59, 59, 999);
    return { fromMs: start.getTime(), toMs: stop.getTime() };
  }

  if (period === "last7") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { fromMs: start.getTime(), toMs: end.getTime() };
  }

  if (period === "last30") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { fromMs: start.getTime(), toMs: end.getTime() };
  }

  const day = customDate || now.toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00`);
  const stop = new Date(`${day}T23:59:59.999`);
  return { fromMs: start.getTime(), toMs: stop.getTime() };
}

export function readNativeRoutePoints(fromMs: number, toMs: number): RoutePoint[] {
  try {
    const raw = getBridge()?.getRoutePoints?.(fromMs, toMs);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RoutePoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readNativeRouteSummary(fromMs: number, toMs: number): RouteSummary | null {
  try {
    const raw = getBridge()?.getRouteSummary?.(fromMs, toMs);
    if (!raw) return null;
    return JSON.parse(raw) as RouteSummary;
  } catch {
    return null;
  }
}

export function readNativeTrackingStatus(): {
  active: boolean;
  lastPointAt: number;
  pointCount: number;
  pendingUpload: number;
} | null {
  try {
    const raw = getBridge()?.getTrackingStatus?.();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      active?: boolean;
      lastPointAt?: number;
      pointCount?: number;
      pendingUpload?: number;
    };
    return {
      active: !!parsed.active,
      lastPointAt: Number(parsed.lastPointAt) || 0,
      pointCount: Number(parsed.pointCount) || 0,
      pendingUpload: Number(parsed.pendingUpload) || 0,
    };
  } catch {
    return null;
  }
}

export function formatDistanceKm(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "0 km";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function openNativeBatterySettings(): void {
  getBridge()?.openBatterySettings?.();
}

export function isNativeBatteryOptimizationDisabled(): boolean {
  return getBridge()?.isBatteryOptimizationDisabled?.() ?? true;
}

export function readNativeDeviceIntegrity(): { developerOptionsEnabled: boolean; rooted: boolean } | null {
  try {
    const raw = getBridge()?.getDeviceIntegrity?.();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { developerOptionsEnabled?: boolean; rooted?: boolean };
    return {
      developerOptionsEnabled: !!parsed.developerOptionsEnabled,
      rooted: !!parsed.rooted,
    };
  } catch {
    return null;
  }
}
