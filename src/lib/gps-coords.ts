export function isValidGpsCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Decimal latitude, longitude — e.g. `25.59410, 85.13760`. */
export function formatLatLngDecimal(lat: number, lng: number, precision = 5): string {
  if (!isValidGpsCoord(lat, lng)) return "";
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

/** Explicit labels for map UI — e.g. `Lat 25.59410 · Lng 85.13760`. */
export function formatLatLngLabeled(lat: number, lng: number, precision = 5): string {
  if (!isValidGpsCoord(lat, lng)) return "";
  return `Lat ${lat.toFixed(precision)} · Lng ${lng.toFixed(precision)}`;
}

/** Degree format for photo stamps — e.g. `25.59410° N, 85.13760° E`. */
export function formatLatLngDegrees(lat: number, lng: number, precision = 5): string {
  if (!isValidGpsCoord(lat, lng)) return "";
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(precision)}° ${latDir}, ${Math.abs(lng).toFixed(precision)}° ${lngDir}`;
}

/** Place name with labeled decimal coords appended when available. */
export function formatPlaceWithCoords(
  placeName: string,
  lat: number,
  lng: number,
): string {
  const trimmed = placeName.trim();
  const labeled = formatLatLngLabeled(lat, lng);
  const compact = formatLatLngDecimal(lat, lng);
  if (!labeled) return trimmed;
  if (!trimmed || trimmed === compact || trimmed === formatLatLngDegrees(lat, lng) || trimmed === labeled) {
    return labeled;
  }
  if (trimmed.includes(compact) || /Lat\s+-?\d+\.\d+/i.test(trimmed)) return trimmed;
  return `${trimmed} · ${labeled}`;
}
