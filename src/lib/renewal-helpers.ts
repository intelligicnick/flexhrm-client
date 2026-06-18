import { Renewal, RenewalPeriod } from "../types";
import { parseFlexibleDateMs } from "./date-helpers";

export function computeNextExpiryDate(
  fromDate: string,
  period: RenewalPeriod,
): string {
  const base = fromDate.trim() || new Date().toISOString().slice(0, 10);
  const parsed = Date.parse(base);
  const date = Number.isNaN(parsed) ? new Date() : new Date(parsed);
  if (period === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else {
    date.setFullYear(date.getFullYear() + 1);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type ExpiryBand = "passed" | "soon" | "ok" | "none" | "no_expiry";

export function expiryBand(item: Pick<Renewal, "hasExpiry" | "expiresOn" | "expiryDate">): ExpiryBand {
  if (item.hasExpiry === false) return "no_expiry";
  const endDate = item.expiresOn || item.expiryDate || "";
  const ts = parseFlexibleDateMs(endDate);
  if (!endDate.trim()) return "none";
  if (ts === null) return "ok";
  const diffDays = (ts - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "passed";
  if (diffDays <= 60) return "soon";
  return "ok";
}

function urgencyRank(band: ExpiryBand): number {
  if (band === "passed") return 0;
  if (band === "soon") return 1;
  if (band === "ok") return 2;
  if (band === "none") return 3;
  return 4;
}

export function compareRenewalUrgency(a: Renewal, b: Renewal): number {
  const bandA = expiryBand(a);
  const bandB = expiryBand(b);
  const rankDiff = urgencyRank(bandA) - urgencyRank(bandB);
  if (rankDiff !== 0) return rankDiff;
  const tsA = parseFlexibleDateMs(a.expiresOn || a.expiryDate) ?? Number.MAX_SAFE_INTEGER;
  const tsB = parseFlexibleDateMs(b.expiresOn || b.expiryDate) ?? Number.MAX_SAFE_INTEGER;
  return tsA - tsB;
}

export function isNearingRenewal(item: Renewal): boolean {
  const band = expiryBand(item);
  return band === "passed" || band === "soon";
}

export function renewalPeriodLabel(period?: RenewalPeriod): string {
  return period === "monthly" ? "Monthly" : "Yearly";
}
