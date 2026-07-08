import type { SupervisorLiveLocation, SupervisorPathPoint } from "./supervisor-map-helpers";
import type { EmployeePunchPin } from "./field-tracking-helpers";
import {
  formatLatLngDecimal,
  formatLatLngLabeled,
  isValidGpsCoord,
} from "./gps-coords";

/** Strip trailing coordinate suffix from stored location labels. */
export function stripCoordsFromLocationLabel(label: string): string {
  return label
    .replace(/\s*\([^)]*\d+\s*°[^)]*\)\s*$/i, "")
    .replace(/\s*·\s*-?\d+\.\d+,\s*-?\d+\.\d+\s*$/i, "")
    .replace(/\s*·\s*Lat\s+-?\d+\.\d+\s*·\s*Lng\s+-?\d+\.\d+\s*$/i, "")
    .trim();
}

function appendGpsCoords(label: string, lat?: number, lng?: number): string {
  if (lat == null || lng == null || !isValidGpsCoord(lat, lng)) return label.trim();
  const labeled = formatLatLngLabeled(lat, lng);
  const compact = formatLatLngDecimal(lat, lng);
  if (!labeled) return label.trim();
  const base = stripCoordsFromLocationLabel(label);
  if (!base) return labeled;
  if (base.includes(compact) || /Lat\s+-?\d+\.\d+/i.test(base)) return base;
  return `${base} · ${labeled}`;
}

function isMeaningfulName(value?: string): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== "—" && trimmed !== "-");
}

function normalizeForCompare(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Known Bihar-style block / district scale names that OSM often returns instead of
 * the actual village (e.g. every GPS in Alamnagar block → "Alamnagar").
 */
const KNOWN_BLOCK_SCALE_NAMES = new Set(
  [
    "alamnagar",
    "alam nagar",
    "madhepura",
    "saharsa",
    "supaul",
    "khagaria",
    "bihar",
    "india",
    "भारत",
  ].map((n) => normalizeForCompare(n)),
);

/** Extract village / locality from school name: "N.P.S AOURA DIH" → "AOURA DIH". */
export function localityHintFromSchoolName(schoolName: string): string {
  const trimmed = schoolName.trim();
  if (!trimmed) return "";

  const withoutPrefix = trimmed
    .replace(
      /^(govt\.?|government|raja|n\.?\s?p\.?\s?s\.?|nps|u\.?\s?p\.?\s?s\.?|ups|u\.?\s?m\.?\s?s\.?|ums|m\.?\s?s\.?|p\.?\s?s\.?|ps|primary|middle|high|senior\s+secondary|secondary|h\.?\s?s\.?|hs|es|ss|kendra|kendriya)\s+/i,
      "",
    )
    .trim();

  let candidate = withoutPrefix !== trimmed ? withoutPrefix : trimmed;
  candidate = candidate
    .replace(
      /\s+(school|vidyalaya|vidyalay|high\s+school|middle\s+school|primary\s+school|hs|ms|ps|nps)\s*$/i,
      "",
    )
    .trim();

  if (candidate.length >= 3 && candidate.length <= 80) return candidate;
  return "";
}

function isBlockScaleLabel(label: string): boolean {
  const parts = stripCoordsFromLocationLabel(label)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return true;

  const skip = new Set([
    "india",
    "भारत",
    "bihar",
    "jharkhand",
    "uttar pradesh",
    "west bengal",
    "madhya pradesh",
  ]);
  const meaningful = parts.filter((part) => {
    const n = normalizeForCompare(part);
    if (skip.has(n)) return false;
    if (/^\d{6}$/.test(part)) return false;
    return true;
  });

  if (meaningful.length === 0) return true;
  if (meaningful.length === 1) {
    const only = normalizeForCompare(meaningful[0]);
    if (KNOWN_BLOCK_SCALE_NAMES.has(only)) return true;
    if (/block$/i.test(meaningful[0])) return true;
  }
  // "Alamnagar, Madhepura" still block-scale
  if (
    meaningful.length <= 2 &&
    meaningful.every((p) => KNOWN_BLOCK_SCALE_NAMES.has(normalizeForCompare(p)))
  ) {
    return true;
  }
  return false;
}

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
  return parts.slice(0, 2).join(", ");
}

/**
 * Prefer GPS street/village; if GPS only has a block name like Alamnagar,
 * use the school-derived village (AOURA DIH) instead.
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
  const schoolVillage = school ? localityHintFromSchoolName(school) : "";
  const fromGps = stripCoordsFromLocationLabel(options.locationLabel || "");
  const gpsShort = fromGps ? shortenFinePlace(fromGps) : "";

  // Prefer a real street / multi-part / village-looking GPS label
  if (gpsShort && !isBlockScaleLabel(gpsShort)) {
    return appendGpsCoords(gpsShort, options.lat, options.lng);
  }

  const address = options.address?.trim();
  if (address) {
    const shortAddress = shortenFinePlace(address);
    if (shortAddress && !isBlockScaleLabel(shortAddress)) {
      return appendGpsCoords(shortAddress, options.lat, options.lng);
    }
  }

  // School local name beats block-scale GPS (“Alamnagar”)
  if (schoolVillage && !isBlockScaleLabel(schoolVillage)) {
    return appendGpsCoords(schoolVillage, options.lat, options.lng);
  }
  if (isMeaningfulName(school) && !isBlockScaleLabel(school)) {
    return appendGpsCoords(school!, options.lat, options.lng);
  }

  const office = options.locationName?.trim();
  if (isMeaningfulName(office) && !isBlockScaleLabel(office)) {
    return appendGpsCoords(office!, options.lat, options.lng);
  }

  if (schoolVillage) return appendGpsCoords(schoolVillage, options.lat, options.lng);
  if (isMeaningfulName(school)) return appendGpsCoords(school!, options.lat, options.lng);

  if (options.lat != null && options.lng != null) {
    const labeled = formatLatLngLabeled(options.lat, options.lng);
    if (labeled) {
      if (options.step != null) {
        return `Stop ${options.step} · ${labeled}`;
      }
      return labeled;
    }
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
        label = `${stripCoordsFromLocationLabel(label)} · ${formatLatLngLabeled(item.lat, item.lng)}`;
      }
    }
    result.set(item.key, label);
  }

  return result;
}
