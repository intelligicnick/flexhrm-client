export function buildGoogleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function buildDualPinGoogleMapsUrl(
  schoolLat: number,
  schoolLng: number,
  visitLat: number,
  visitLng: number,
): string {
  return `https://www.google.com/maps/dir/${schoolLat},${schoolLng}/${visitLat},${visitLng}`;
}

export function buildDualPinOsmUrl(
  schoolLat: number,
  schoolLng: number,
  visitLat: number,
  visitLng: number,
): string {
  const midLat = (schoolLat + visitLat) / 2;
  const midLng = (schoolLng + visitLng) / 2;
  return `https://www.openstreetmap.org/?mlat=${midLat}&mlon=${midLng}#map=16/${midLat}/${midLng}`;
}

export function extractVisitSupervisorCoords(visit: {
  gpsLocation?: { lat?: number; lng?: number };
  photos?: Array<{ lat?: number; lng?: number }>;
}): { lat: number; lng: number } | null {
  const gps = visit.gpsLocation;
  if (gps && isValidCoord(gps.lat, gps.lng)) {
    return { lat: Number(gps.lat), lng: Number(gps.lng) };
  }
  for (const photo of visit.photos || []) {
    if (isValidCoord(photo.lat, photo.lng)) {
      return { lat: Number(photo.lat), lng: Number(photo.lng) };
    }
  }
  return null;
}

function isValidCoord(lat?: number, lng?: number): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  return (
    Number.isFinite(la) &&
    Number.isFinite(ln) &&
    !(la === 0 && ln === 0) &&
    Math.abs(la) <= 90 &&
    Math.abs(ln) <= 180
  );
}
