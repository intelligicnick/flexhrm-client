import {
  readNativeGpsCoordinates,
  requestFreshNativeGpsCoordinates,
  warmupNativeGps,
} from "./native-android-bridge";
import { FIELD_TEAM_APP_VERSION } from "./native-app-version";
import { isFlexHrmNativeApp } from "./supervisor-installed-apps";

export interface VisitGpsCoords {
  lat: number;
  lng: number;
  locationLabel: string;
  placeName: string;
}

export interface StampedVisitPhoto {
  caption: string;
  mimeType: string;
  filename: string;
  photoDataBase64: string;
  thumbnailBase64?: string;
  /** Blob URL for in-app preview — not sent to the API. */
  previewUrl?: string;
  /** Blob URL for thumbnail preview — not sent to the API. */
  thumbPreviewUrl?: string;
  takenAt: string;
  lat: number;
  lng: number;
  locationLabel: string;
}

function parseDataUrl(dataUrl: string): { mime: string; rawBase64: string } {
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mime: match[1], rawBase64: match[2] };
  }
  return { mime: "image/jpeg", rawBase64: trimmed };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const { mime, rawBase64 } = parseDataUrl(dataUrl);
  const binary = atob(rawBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function revokeStampedVisitPhotoUrls(photo: StampedVisitPhoto): void {
  if (photo.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
  if (photo.thumbPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.thumbPreviewUrl);
}

type PlaceNameResolver = (lat: number, lng: number) => Promise<string>;

let gpsWatchId: number | null = null;
let cachedCoords: { lat: number; lng: number; at: number } | null = null;

const GPS_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const GPS_RETRY_ATTEMPTS = 4;
const PLACE_NAME_RETRY_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatVisitTimestamp(date: Date): { dateLine: string; timeLine: string; iso: string } {
  const dateLine = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const timeLine = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
  return { dateLine, timeLine, iso: date.toISOString() };
}

function formatCoords(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

function isValidCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function buildPlaceName(address: Record<string, string> | undefined): string {
  if (!address) return "";
  const streetFields = ["house_number", "road", "pedestrian", "footway", "path"] as const;
  const localityFields = [
    "hamlet",
    "village",
    "isolated_dwelling",
    "neighbourhood",
    "quarter",
    "locality",
    "suburb",
  ] as const;
  const streetParts = streetFields
    .map((key) => String(address[key] || "").trim())
    .filter(Boolean);
  const localityParts = localityFields
    .map((key) => String(address[key] || "").trim())
    .filter(Boolean);
  // Prefer street + fine locality; skip lone block-scale village names later via scoring
  const unique = [...new Set([...streetParts, ...localityParts])];
  return unique.slice(0, 3).join(", ");
}

function buildPlaceNameFromDisplayName(displayName: string): string {
  const skip = new Set(["india", "भारत", "bihar", "madhepura"]);
  const parts = displayName
    .split(",")
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      if (skip.has(part.toLowerCase())) return false;
      if (/^\d{6}$/.test(part)) return false;
      return true;
    });
  return parts.slice(0, 3).join(", ");
}

async function fetchNominatimCandidates(
  lat: number,
  lng: number,
  options?: { layer?: string; language?: string },
): Promise<string[]> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", options?.language ?? "en");
    url.searchParams.set("zoom", "18");
  if (options?.layer) {
    url.searchParams.set("layer", options.layer);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": options?.language ?? "en",
      "User-Agent": `FlexHRM-Supervisor/${FIELD_TEAM_APP_VERSION}`,
    },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };

  const candidates: string[] = [];
  const fromAddress = buildPlaceName(data.address);
  if (fromAddress) candidates.push(fromAddress);

  const displayName = String(data.display_name || "").trim();
  if (displayName) {
    const fromDisplay = buildPlaceNameFromDisplayName(displayName);
    if (fromDisplay) candidates.push(fromDisplay);
  }

  return candidates;
}

function scorePlaceCandidate(label: string): number {
  const trimmed = label.trim();
  if (!trimmed) return -1;

  // Reject block-only labels like "Alamnagar" / "Alamnagar, Madhepura"
  const lower = trimmed.toLowerCase();
  if (
    lower === "alamnagar" ||
    lower === "alam nagar" ||
    /^alamnagar,\s*madhepura/i.test(trimmed) ||
    /^alamnagar$/i.test(trimmed.split(",")[0]?.trim() || "")
  ) {
    // Keep only if there is a finer part besides Alamnagar/Madhepura/Bihar
    const fineParts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter(
        (p) =>
          p &&
          !/^(alamnagar|alam nagar|madhepura|bihar|india|भारत)$/i.test(p),
      );
    if (fineParts.length === 0) return 0;
  }

  let score = 5;
  if (/road|rd\.|street|st\.|गली|marg|path|lane|chowk/i.test(trimmed)) score += 25;

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) score += 15;
  if (/village|hamlet|गाँव|गांव|locality|neighbourhood|dih|tola/i.test(trimmed)) {
    score += 12;
  }
  score += Math.min(parts.length * 3, 12);
  return score;
}

function pickBestPlaceName(candidates: string[]): string {
  let best = "";
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scorePlaceCandidate(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate.trim();
    }
  }
  return bestScore > 0 ? best : "";
}

async function reverseGeocodePlaceName(lat: number, lng: number): Promise<string> {
  try {
    const candidateLists = await Promise.all([
      fetchNominatimCandidates(lat, lng, { language: "en" }),
      fetchNominatimCandidates(lat, lng, { language: "hi" }),
      fetchNominatimCandidates(lat, lng, { layer: "address", language: "en" }),
      fetchNominatimCandidates(lat, lng, { layer: "address", language: "hi" }),
    ]);
    return pickBestPlaceName(candidateLists.flat());
  } catch {
    return "";
  }
}

function buildLocationLabel(lat: number, lng: number, placeName: string): string {
  const coords = formatCoords(lat, lng);
  const trimmed = placeName.trim();
  if (!trimmed || trimmed === coords) return coords;
  return `${trimmed} (${coords})`;
}

function cachePosition(lat: number, lng: number) {
  cachedCoords = { lat, lng, at: Date.now() };
}

function readCachedPosition(maxAgeMs = GPS_CACHE_MAX_AGE_MS): { lat: number; lng: number } | null {
  if (!cachedCoords) return null;
  if (Date.now() - cachedCoords.at > maxAgeMs) return null;
  return { lat: cachedCoords.lat, lng: cachedCoords.lng };
}

function getCurrentPositionOnce(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function tryWebGeolocation(): Promise<{ lat: number; lng: number } | null> {
  const attempts: PositionOptions[] = [
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 15_000 },
    { enableHighAccuracy: false, timeout: 12_000, maximumAge: GPS_CACHE_MAX_AGE_MS },
  ];

  for (const options of attempts) {
    try {
      const pos = await getCurrentPositionOnce(options);
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!isValidCoords(lat, lng)) continue;
      cachePosition(lat, lng);
      return { lat, lng };
    } catch {
      /* try next */
    }
  }

  return null;
}

async function readNativeCoordsFresh(): Promise<{ lat: number; lng: number } | null> {
  const immediate = readNativeGpsCoordinates();
  if (immediate) {
    cachePosition(immediate.lat, immediate.lng);
    return { lat: immediate.lat, lng: immediate.lng };
  }

  const fresh = await requestFreshNativeGpsCoordinates(22_000);
  if (!fresh) return null;

  cachePosition(fresh.lat, fresh.lng);
  return { lat: fresh.lat, lng: fresh.lng };
}

async function resolveCoordsMandatory(): Promise<{ lat: number; lng: number }> {
  for (let attempt = 0; attempt < GPS_RETRY_ATTEMPTS; attempt++) {
    warmupNativeGps();

    if (isFlexHrmNativeApp()) {
      const nativeCoords = await readNativeCoordsFresh();
      if (nativeCoords) return nativeCoords;
    }

    const cached = readCachedPosition();
    if (cached) return cached;

    const webCoords = await tryWebGeolocation();
    if (webCoords) return webCoords;

    if (attempt < GPS_RETRY_ATTEMPTS - 1) {
      await sleep(1500);
    }
  }

  throw new Error(
    "GPS coordinates are required. Enable location services, allow location permission, step outdoors, and tap Retry GPS.",
  );
}

async function resolvePlaceNameMandatory(
  lat: number,
  lng: number,
  resolvePlaceName?: PlaceNameResolver,
): Promise<string> {
  for (let attempt = 0; attempt < PLACE_NAME_RETRY_ATTEMPTS; attempt++) {
    if (resolvePlaceName) {
      try {
        const fromApi = await resolvePlaceName(lat, lng);
        if (fromApi.trim()) return fromApi.trim();
      } catch {
        /* try fallback */
      }
    }

    const fromNominatim = await reverseGeocodePlaceName(lat, lng);
    if (fromNominatim.trim()) return fromNominatim.trim();

    if (attempt < PLACE_NAME_RETRY_ATTEMPTS - 1) {
      await sleep(1200);
    }
  }

  return "";
}

async function buildMandatoryVisitLocation(
  resolvePlaceName?: PlaceNameResolver,
): Promise<VisitGpsCoords> {
  const { lat, lng } = await resolveCoordsMandatory();
  const resolvedPlaceName = await resolvePlaceNameMandatory(lat, lng, resolvePlaceName);
  const trimmedPlace = resolvedPlaceName.trim();
  const placeName = trimmedPlace || formatCoords(lat, lng);
  return {
    lat,
    lng,
    placeName,
    locationLabel: buildLocationLabel(lat, lng, placeName),
  };
}

export function startGpsWarmup(): () => void {
  warmupNativeGps();

  if (!navigator.geolocation || gpsWatchId !== null) {
    return () => undefined;
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      cachePosition(pos.coords.latitude, pos.coords.longitude);
    },
    () => {
      /* keep trying in background */
    },
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 25_000 },
  );

  return () => {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
  };
}

export function hasValidVisitGps(location: VisitGpsCoords): boolean {
  return isValidCoords(location.lat, location.lng);
}

/** GPS coordinates are required before stamping a visit photo (place name is best-effort). */
export async function requireGpsLocationForStamp(
  resolvePlaceName?: PlaceNameResolver,
): Promise<VisitGpsCoords> {
  const location = await buildMandatoryVisitLocation(resolvePlaceName);
  if (!hasValidVisitGps(location)) {
    throw new Error("GPS coordinates are required before stamping a photo.");
  }
  return location;
}

export async function probeGpsLocation(resolvePlaceName?: PlaceNameResolver): Promise<VisitGpsCoords> {
  return requireGpsLocationForStamp(resolvePlaceName);
}

export async function getGpsLocation(
  resolvePlaceName?: PlaceNameResolver,
): Promise<VisitGpsCoords> {
  return requireGpsLocationForStamp(resolvePlaceName);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

export async function stampVisitPhoto(
  file: File,
  location: VisitGpsCoords,
  options?: { schoolName?: string; index?: number },
): Promise<StampedVisitPhoto> {
  if (!hasValidVisitGps(location)) {
    throw new Error("Photo must include valid GPS coordinates.");
  }

  const takenAt = new Date();
  const { dateLine, timeLine, iso } = formatVisitTimestamp(takenAt);
  const schoolName = options?.schoolName?.trim() || "";
  const index = options?.index ?? 1;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read photo file."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load photo for stamping."));
    image.src = dataUrl;
  });

  const maxDim = 1920;
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare photo canvas.");

  ctx.drawImage(img, 0, 0, width, height);

  const padding = Math.max(12, Math.round(canvas.width * 0.02));
  const fontSize = Math.max(14, Math.round(canvas.width * 0.028));
  const lineHeight = Math.round(fontSize * 1.35);
  ctx.font = `700 ${fontSize}px Montserrat, Arial, sans-serif`;

  const coordsLabel = formatCoords(location.lat, location.lng);
  const resolvedPlace = location.placeName.trim();
  const lines = [
    `Date: ${dateLine}`,
    `Time: ${timeLine}`,
    ...(resolvedPlace && resolvedPlace !== coordsLabel ? [`Place: ${resolvedPlace}`] : []),
    `Location: ${coordsLabel}`,
  ];
  if (schoolName) lines.unshift(`School: ${schoolName}`);

  const wrappedLines = lines.flatMap((line) => wrapText(ctx, line, canvas.width - padding * 2));
  const barHeight = padding * 2 + wrappedLines.length * lineHeight;

  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  wrappedLines.forEach((line, i) => {
    ctx.fillText(line, padding, canvas.height - barHeight + padding + i * lineHeight);
  });

  const mimeType = "image/jpeg";
  const stampedDataUrl = canvas.toDataURL(mimeType, 0.88);
  const { rawBase64: photoDataBase64 } = parseDataUrl(stampedDataUrl);
  if (!photoDataBase64) {
    throw new Error("Failed to encode stamped photo.");
  }

  const previewUrl = isFlexHrmNativeApp()
    ? stampedDataUrl
    : URL.createObjectURL(dataUrlToBlob(stampedDataUrl));

  const thumbW = 120;
  const thumbH = Math.max(1, Math.round(thumbW * (canvas.height / canvas.width)));
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext("2d");
  if (thumbCtx) {
    thumbCtx.drawImage(canvas, 0, 0, thumbW, thumbH);
  }
  const thumbDataUrl = thumbCtx ? thumbCanvas.toDataURL("image/jpeg", 0.5) : undefined;
  const thumbnailBase64 = thumbDataUrl ? parseDataUrl(thumbDataUrl).rawBase64 : undefined;
  const thumbPreviewUrl = thumbDataUrl
    ? isFlexHrmNativeApp()
      ? thumbDataUrl
      : URL.createObjectURL(dataUrlToBlob(thumbDataUrl))
    : undefined;

  const baseName = file.name?.replace(/\.[^.]+$/, "").trim();
  return {
    caption: `Field visit photo ${index}`,
    mimeType,
    filename: baseName ? `${baseName}.jpg` : `visit-${index}.jpg`,
    photoDataBase64,
    thumbnailBase64,
    previewUrl,
    thumbPreviewUrl,
    takenAt: iso,
    lat: location.lat,
    lng: location.lng,
    locationLabel: location.locationLabel,
  };
}
