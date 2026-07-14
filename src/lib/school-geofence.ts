export function schoolGeofenceRadiusM(school: {
  geofenceRadiusM?: number;
  locationConfidence?: string;
}): number {
  const explicit = Number(school.geofenceRadiusM);
  if (explicit > 0) return explicit;
  return school.locationConfidence === "exact" ? 100 : 400;
}

export function geofenceAreaLabel(confidence?: string): string {
  if (confidence === "exact") return "school";
  if (confidence === "village") return "village";
  return "school or village area";
}

export function locationConfidenceLabel(confidence?: string): string {
  if (confidence === "exact") return "School pin (100 m)";
  if (confidence === "village") return "Village pin (400 m)";
  if (confidence === "partial") return "Approximate (400 m)";
  return confidence || "—";
}
