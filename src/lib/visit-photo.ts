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

export async function getGpsLocation(
  resolvePlaceName?: (lat: number, lng: number) => Promise<string>,
): Promise<VisitGpsCoords> {
  const coords = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS is not available on this device. Enable location services to capture visit photos."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow GPS access to stamp photos with place coordinates."
            : "Could not read GPS location. Move outdoors and try again.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });

  const placeName = resolvePlaceName
    ? await resolvePlaceName(coords.lat, coords.lng)
    : await reverseGeocodePlaceName(coords.lat, coords.lng);
  return {
    lat: coords.lat,
    lng: coords.lng,
    placeName,
    locationLabel: buildLocationLabel(coords.lat, coords.lng, placeName),
  };
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
    location.placeName ? `Place: ${location.placeName}` : null,
    `Location: ${formatCoords(location.lat, location.lng)}`,
  ].filter((line): line is string => Boolean(line));
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
