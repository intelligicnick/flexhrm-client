import type { SchoolSupervisor, SchoolVisit } from "../types";

export type SupervisorMapPin = {
  supervisorId: string;
  name: string;
  lat: number;
  lng: number;
  locationLabel?: string;
  visitDate: string;
  schoolName: string;
  isOnline?: boolean;
  lastActiveAt?: string | null;
};

export type SupervisorPathPoint = {
  lat: number;
  lng: number;
  at: string;
  visitDate: string;
  schoolName: string;
  locationLabel?: string;
  visitId: string;
  step: number;
};

export type SupervisorPathSegment = {
  visitDate: string;
  points: SupervisorPathPoint[];
  distanceKm: number;
};

export type SupervisorPath = {
  supervisorId: string;
  name: string;
  color: string;
  isOnline?: boolean;
  lastActiveAt?: string | null;
  points: SupervisorPathPoint[];
  segments: SupervisorPathSegment[];
  distanceKm: number;
  latest: SupervisorPathPoint | null;
};

export type SupervisorPathPeriod = "day" | "week" | "month";

export type BuildSupervisorPathsOptions = {
  fromDate?: string;
  toDate?: string;
};

export const SUPERVISOR_PATH_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#059669",
  "#0891b2",
  "#ca8a04",
  "#dc2626",
  "#4f46e5",
  "#0d9488",
] as const;

function isValidCoord(lat: number, lng: number): boolean {
  return (
    lat !== 0 &&
    lng !== 0 &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)}:${lng.toFixed(5)}`;
}

function comparePathPoints(a: SupervisorPathPoint, b: SupervisorPathPoint): number {
  const dateCmp = a.visitDate.localeCompare(b.visitDate);
  if (dateCmp !== 0) return dateCmp;
  return a.at.localeCompare(b.at);
}

function extractVisitCoords(
  visit: SchoolVisit,
): { lat: number; lng: number; locationLabel?: string } | null {
  if (visit.gpsLocation && isValidCoord(visit.gpsLocation.lat, visit.gpsLocation.lng)) {
    return {
      lat: visit.gpsLocation.lat,
      lng: visit.gpsLocation.lng,
      locationLabel: visit.gpsLocation.locationLabel,
    };
  }
  for (const photo of visit.photos || []) {
    if (photo.lat != null && photo.lng != null && isValidCoord(photo.lat, photo.lng)) {
      return { lat: photo.lat, lng: photo.lng, locationLabel: photo.locationLabel };
    }
  }
  return null;
}

function extractVisitPathPoints(visit: SchoolVisit): Omit<SupervisorPathPoint, "step">[] {
  const raw: Omit<SupervisorPathPoint, "step">[] = [];

  if (visit.gpsLocation && isValidCoord(visit.gpsLocation.lat, visit.gpsLocation.lng)) {
    raw.push({
      lat: visit.gpsLocation.lat,
      lng: visit.gpsLocation.lng,
      at: `${visit.visitDate}T00:00:00`,
      visitDate: visit.visitDate,
      schoolName: visit.schoolName,
      locationLabel: visit.gpsLocation.locationLabel,
      visitId: visit.id,
    });
  }

  for (const photo of visit.photos || []) {
    if (photo.lat == null || photo.lng == null || !isValidCoord(photo.lat, photo.lng)) continue;
    raw.push({
      lat: photo.lat,
      lng: photo.lng,
      at: photo.takenAt?.trim() || `${visit.visitDate}T12:00:00`,
      visitDate: visit.visitDate,
      schoolName: visit.schoolName,
      locationLabel: photo.locationLabel,
      visitId: visit.id,
    });
  }

  if (raw.length === 0) {
    const fallback = extractVisitCoords(visit);
    if (fallback) {
      raw.push({
        lat: fallback.lat,
        lng: fallback.lng,
        at: `${visit.visitDate}T00:00:00`,
        visitDate: visit.visitDate,
        schoolName: visit.schoolName,
        locationLabel: fallback.locationLabel,
        visitId: visit.id,
      });
    }
  }

  return raw;
}

function dedupeConsecutivePoints(points: SupervisorPathPoint[]): SupervisorPathPoint[] {
  const deduped: SupervisorPathPoint[] = [];
  let lastKey = "";
  for (const point of points) {
    const key = coordKey(point.lat, point.lng);
    if (key === lastKey) continue;
    deduped.push(point);
    lastKey = key;
  }
  return deduped;
}

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computePathDistanceKm(points: Pick<SupervisorPathPoint, "lat" | "lng">[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += haversineDistanceKm(
      points[i].lat,
      points[i].lng,
      points[i + 1].lat,
      points[i + 1].lng,
    );
  }
  return total;
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return "0 km";
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function visitInDateRange(visitDate: string, fromDate?: string, toDate?: string): boolean {
  if (!fromDate || !toDate) return true;
  const normalized = visitDate.slice(0, 10);
  const start = fromDate <= toDate ? fromDate : toDate;
  const end = fromDate <= toDate ? toDate : fromDate;
  return normalized >= start && normalized <= end;
}

function buildPathSegments(points: SupervisorPathPoint[]): SupervisorPathSegment[] {
  if (points.length === 0) return [];

  const byDate = new Map<string, SupervisorPathPoint[]>();
  for (const point of points) {
    const bucket = byDate.get(point.visitDate) || [];
    bucket.push(point);
    byDate.set(point.visitDate, bucket);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([visitDate, dayPoints]) => ({
      visitDate,
      points: dayPoints,
      distanceKm: computePathDistanceKm(dayPoints),
    }));
}

export function buildSupervisorPaths(
  supervisors: SchoolSupervisor[],
  visits: SchoolVisit[],
  options: BuildSupervisorPathsOptions = {},
): SupervisorPath[] {
  const { fromDate, toDate } = options;
  const activeSupervisors = supervisors.filter((supervisor) => supervisor.status !== "inactive");
  const pointsBySupervisor = new Map<string, Omit<SupervisorPathPoint, "step">[]>();

  for (const visit of visits) {
    if (!visitInDateRange(visit.visitDate, fromDate, toDate)) continue;
    const visitPoints = extractVisitPathPoints(visit);
    if (visitPoints.length === 0) continue;
    const bucket = pointsBySupervisor.get(visit.supervisorId) || [];
    bucket.push(...visitPoints);
    pointsBySupervisor.set(visit.supervisorId, bucket);
  }

  return activeSupervisors
    .map((supervisor, index) => {
      const rawPoints = pointsBySupervisor.get(supervisor.id) || [];
      if (rawPoints.length === 0) return null;

      const sorted = [...rawPoints].sort(comparePathPoints);
      const numbered = dedupeConsecutivePoints(
        sorted.map((point, stepIndex) => ({ ...point, step: stepIndex + 1 })),
      ).map((point, stepIndex) => ({ ...point, step: stepIndex + 1 }));
      const segments = buildPathSegments(numbered);
      const distanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);

      return {
        supervisorId: supervisor.id,
        name: supervisor.name || supervisor.phone || "Supervisor",
        color: SUPERVISOR_PATH_COLORS[index % SUPERVISOR_PATH_COLORS.length],
        isOnline: supervisor.isOnline,
        lastActiveAt: supervisor.lastActiveAt,
        points: numbered,
        segments,
        distanceKm,
        latest: numbered.length > 0 ? numbered[numbered.length - 1] : null,
      } satisfies SupervisorPath;
    })
    .filter((path) => path !== null);
}

export function buildSupervisorMapPins(
  supervisors: SchoolSupervisor[],
  visits: SchoolVisit[],
): SupervisorMapPin[] {
  return buildSupervisorPaths(supervisors, visits)
    .filter((path) => path.latest)
    .map((path) => ({
      supervisorId: path.supervisorId,
      name: path.name,
      lat: path.latest!.lat,
      lng: path.latest!.lng,
      locationLabel: path.latest!.locationLabel,
      visitDate: path.latest!.visitDate,
      schoolName: path.latest!.schoolName,
      isOnline: path.isOnline,
      lastActiveAt: path.lastActiveAt,
    }));
}
