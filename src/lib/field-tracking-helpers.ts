import type { Employee } from "../types";

export type MapGeofence = {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  radiusMeters: number;
};

export type EmployeePunchPin = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  locationName: string;
  lat: number;
  lng: number;
  punchType: "in" | "out";
  punchedAt: string;
  withinGeofence: boolean;
  address: string;
};

export type FieldTrackingLayer = "supervisors" | "employees" | "all";

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

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchMapGeofences(): Promise<MapGeofence[]> {
  const res = await fetch("/api/attendance-punch/geofences", { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((row: Record<string, unknown>) => ({
      id: String(row.id || ""),
      name: String(row.name || row.location || "Office"),
      location: String(row.location || ""),
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      radiusMeters: Number(row.radiusMeters) || 200,
    }))
    .filter((row) => row.id && isValidCoord(row.lat, row.lng));
}

export async function fetchEmployeePunchPins(
  date: string,
  employees: Employee[],
): Promise<EmployeePunchPin[]> {
  const params = new URLSearchParams({ date, pageSize: "500", page: "1" });
  const res = await fetch(`/api/attendance-punch/punches?${params}`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  const employeeById = new Map(employees.map((emp) => [emp.id, emp]));

  return items
    .map((row: Record<string, unknown>) => {
      const loc = row.location as Record<string, unknown> | undefined;
      const lat = Number(loc?.latitude);
      const lng = Number(loc?.longitude);
      if (!isValidCoord(lat, lng)) return null;
      const employeeId = String(row.employeeId || "");
      const emp = employeeById.get(employeeId);
      const punchedAtRaw = row.punchedAt;
      const punchedAt =
        typeof punchedAtRaw === "string"
          ? punchedAtRaw
          : punchedAtRaw instanceof Date
            ? punchedAtRaw.toISOString()
            : new Date(String(punchedAtRaw)).toISOString();
      return {
        id: String(row.id || `${employeeId}-${punchedAt}`),
        employeeId,
        employeeCode: String(row.employeeCode || emp?.employeeCode || "—"),
        employeeName: emp?.nameAsPerAadhar || emp?.employeeCode || String(row.employeeCode || "Employee"),
        locationName: String(row.officeLocation || emp?.location || "—"),
        lat,
        lng,
        punchType: (row.punchType === "out" ? "out" : "in") as "in" | "out",
        punchedAt,
        withinGeofence: !!row.withinGeofence,
        address: String(loc?.address || ""),
      } satisfies EmployeePunchPin;
    })
    .filter((row): row is EmployeePunchPin => row !== null);
}
