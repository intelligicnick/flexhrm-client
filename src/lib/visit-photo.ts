import {
  readNativeGpsCoordinates,
  requestFreshNativeGpsCoordinates,
  warmupNativeGps,
} from "./native-android-bridge";
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
  takenAt: string;
  lat: number;
  lng: number;
  locationLabel: string;
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
  const parts = [
    address.village,
    address.town,
    address.city,
    address.suburb,
    address.neighbourhood,
    address.locality,
    address.county,
    address.state_district,
    address.state,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.slice(0, 3).join(", ");
}

async function reverseGeocodePlaceName(lat: number, lng: number): Promise<string> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("accept-language", "en");
    url.searchParams.set("zoom", "16");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "FlexHRM-Supervisor/1.5",
      },
    });
    if (!res.ok) return "";

    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const fromAddress = buildPlaceName(data.address);
    if (fromAddress) return fromAddress;

    const display = String(data.display_name || "").trim();
    if (!display) return "";
    return display.split(",").slice(0, 3).join(", ").trim();
  } catch {
    return "";
  }
}

function buildLocationLabel(lat: number, lng: number, placeName: string): string {
  const coords = formatCoords(lat, lng);
  return placeName ? `${placeName} (${coords})` : coords;
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

  throw new Error(
    "Place name could not be resolved from GPS. Check internet connection and tap Retry GPS before taking a photo.",
  );
}

async function buildMandatoryVisitLocation(
  resolvePlaceName?: PlaceNameResolver,
): Promise<VisitGpsCoords> {
  const { lat, lng } = await resolveCoordsMandatory();
  const placeName = await resolvePlaceNameMandatory(lat, lng, resolvePlaceName);
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
  return isValidCoords(location.lat, location.lng) && Boolean(location.placeName.trim());
}

/** GPS coordinates + place name are both required before stamping a visit photo. */
export async function requireGpsLocationForStamp(
  resolvePlaceName?: PlaceNameResolver,
): Promise<VisitGpsCoords> {
  const location = await buildMandatoryVisitLocation(resolvePlaceName);
  if (!hasValidVisitGps(location)) {
    throw new Error("GPS location and place name are required before stamping a photo.");
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
    throw new Error("Photo must include valid GPS coordinates and place name.");
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

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare photo canvas.");

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const padding = Math.max(12, Math.round(canvas.width * 0.02));
  const fontSize = Math.max(14, Math.round(canvas.width * 0.028));
  const lineHeight = Math.round(fontSize * 1.35);
  ctx.font = `700 ${fontSize}px Montserrat, Arial, sans-serif`;

  const lines = [
    `Date: ${dateLine}`,
    `Time: ${timeLine}`,
    `Place: ${location.placeName}`,
    `Location: ${formatCoords(location.lat, location.lng)}`,
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

  const stampedDataUrl = canvas.toDataURL(file.type || "image/jpeg", 0.92);

  return {
    caption: `Field visit photo ${index}`,
    mimeType: file.type || "image/jpeg",
    filename: file.name || `visit-${index}.jpg`,
    photoDataBase64: stampedDataUrl,
    takenAt: iso,
    lat: location.lat,
    lng: location.lng,
    locationLabel: location.locationLabel,
  };
}
