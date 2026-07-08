import type { SupervisorLiveLocation, SupervisorPathPoint } from "./supervisor-map-helpers";
import type { EmployeePunchPin } from "./field-tracking-helpers";

/** Strip trailing coordinate parenthetical from stored location labels. */
export function stripCoordsFromLocationLabel(label: string): string {
  return label.replace(/\s*\([^)]*\d+\s*°[^)]*\)\s*$/i, "").trim();
}

function formatShortCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function isMeaningfulName(value?: string): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== "—" && trimmed !== "-");
}

/** Drop country / broad district-only tails when a finer part exists. */
function shortenFinePlace(label: string): string {
  const skip = new Set([
    "india",
    "भारत",
    "bihar",
    "jharkhand",
    "uttar pradesh",
    "west bengal",
    "madhya pradesh",
  ]);
  const parts = label
    .split(",")
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      if (skip.has(part.toLowerCase())) return false;
      if (/^\d{6}$/.test(part)) return false;
      return true;
    });
  if (parts.length === 0) return label.trim();
  // Prefer village/street first parts (usually most specific)
  return parts.slice(0, 2).join(", ");
}

/**
 * Prefer GPS village / street names from OpenStreetMap reverse geocode.
 * If GPS only has a broad area name, fall back to school name for clarity.
 */
export function resolveMapMarkerLabel(options: {
  schoolName?: string;
  locationLabel?: string;
  address?: string;
  locationName?: string;
  lat?: number;
  lng?: number;
  step?: number;
}): string {
  const school = options.schoolName?.trim();
  const fromGps = stripCoordsFromLocationLabel(options.locationLabel || "");
  const gpsShort = fromGps ? shortenFinePlace(fromGps) : "";

  // Prefer a multi-part village/street label from OSM over a single block-scale name.
  const gpsLooksFine =
    Boolean(gpsShort) &&
    (gpsShort.includes(",") ||
      /road|rd\.|street|st\.|gali|गली|marg|village|hamlet|lane|path|chowk/i.test(gpsShort));

  if (gpsLooksFine) return gpsShort;

  const address = options.address?.trim();
  if (address) {
    const shortAddress = shortenFinePlace(address);
    if (shortAddress) return shortAddress;
  }

  if (isMeaningfulName(school)) return school!;

  if (gpsShort) return gpsShort;

  const office = options.locationName?.trim();
  if (isMeaningfulName(office)) return office!;

  if (options.lat != null && options.lng != null) {
    if (options.step != null) {
      return `Stop ${options.step} · ${formatShortCoords(options.lat, options.lng)}`;
    }
    return formatShortCoords(options.lat, options.lng);
  }

  return "";
}

export function resolveSupervisorPointMapLabel(point: SupervisorPathPoint): string {
  return resolveMapMarkerLabel({
    schoolName: point.schoolName,
    locationLabel: point.locationLabel,
    lat: point.lat,
    lng: point.lng,
    step: point.step,
  });
}

export function resolveSupervisorLiveMapLabel(location: SupervisorLiveLocation): string {
  return resolveMapMarkerLabel({
    schoolName: location.schoolName,
    locationLabel: location.locationLabel,
    lat: location.lat,
    lng: location.lng,
  });
}

export function resolveEmployeePinMapLabel(pin: EmployeePunchPin): string {
  return resolveMapMarkerLabel({
    locationName: pin.locationName,
    address: pin.address,
    locationLabel: pin.address,
    lat: pin.lat,
    lng: pin.lng,
  });
}

/** Append step/coords when multiple markers would show the same label. */
export function dedupeMapLabels(
  items: Array<{ key: string; label: string; step?: number; lat: number; lng: number }>,
): Map<string, string> {
  const labelCounts = new Map<string, number>();
  for (const item of items) {
    labelCounts.set(item.label, (labelCounts.get(item.label) || 0) + 1);
  }

  const result = new Map<string, string>();
  const labelUsage = new Map<string, number>();

  for (const item of items) {
    let label = item.label;
    const count = labelCounts.get(label) || 1;
    if (count > 1) {
      const used = (labelUsage.get(label) || 0) + 1;
      labelUsage.set(label, used);
      if (item.step != null) {
        label = `${label} · Stop ${item.step}`;
      } else {
        label = `${label} · ${formatShortCoords(item.lat, item.lng)}`;
      }
    }
    result.set(item.key, label);
  }

  return result;
}
