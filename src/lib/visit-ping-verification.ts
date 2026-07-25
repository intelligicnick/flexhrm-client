import type { SchoolVisit } from "../types";

export type VisitPingMatchStatus =
  | "verified"
  | "no_ping_trail"
  | "ping_mock"
  | "ping_far_from_school"
  | "visit_ping_mismatch"
  | string;

export function visitPingMatchLabel(status?: VisitPingMatchStatus): string {
  switch (status) {
    case "verified":
      return "APK trail confirms visit";
    case "no_ping_trail":
      return "No APK location trail";
    case "ping_mock":
      return "Fake GPS on APK trail";
    case "ping_far_from_school":
      return "APK trail far from school";
    case "visit_ping_mismatch":
      return "Visit GPS vs APK mismatch";
    case "school_pin_missing":
      return "School pin not set";
    case "outside_geofence":
      return "Outside school geofence";
    case "poor_gps_accuracy":
      return "Poor GPS accuracy";
    case "matched":
      return "Geofence matched";
    default:
      return status ? String(status) : "Not checked";
  }
}

export function visitPingMatchBadgeClass(status?: VisitPingMatchStatus): string {
  if (status === "verified" || status === "matched") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (!status) return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-900";
}

export function visitNeedsReview(visit: SchoolVisit): boolean {
  if (visit.needsReview === true) return true;
  const status = visit.locationMatchStatus;
  return !!status && status !== "verified" && status !== "matched";
}

export function visitPingEvidenceSummary(visit: SchoolVisit): string | null {
  if (visit.pingVerificationNotes) return visit.pingVerificationNotes;
  if (visit.locationMatchStatus === "verified") {
    const count = visit.pingTrailNearSchoolCount ?? 0;
    return count > 0
      ? `${count} APK ping(s) near school during visit window.`
      : "APK trail confirms visit location.";
  }
  return null;
}
