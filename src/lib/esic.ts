export const ESIC_STATUS_YES = "Yes";
export const ESIC_STATUS_NO = "No";
export const ESIC_STATUS_EXEMPT = "Exempt";
export const ESIC_STATUS_APPLY_ABOVE_LIMIT = "Apply Above 21000";

export function normalizeEsicStatus(flag?: string | null): string {
  const value = String(flag || "").trim();
  if (!value) return "";

  const lower = value.toLowerCase();
  if (lower === "yes") return ESIC_STATUS_YES;
  if (lower === "no") return ESIC_STATUS_NO;
  if (lower === "exempt") return ESIC_STATUS_EXEMPT;
  if (
    lower === ESIC_STATUS_APPLY_ABOVE_LIMIT.toLowerCase() ||
    lower === "yesabovelimit" ||
    lower === "yes above 21000" ||
    lower === "yes (above 21000)" ||
    lower === "yes (above 21,000)"
  ) {
    return ESIC_STATUS_APPLY_ABOVE_LIMIT;
  }

  return value;
}

export function isEsicCoveredStatus(flag?: string | null): boolean {
  const normalized = normalizeEsicStatus(flag);
  return normalized === ESIC_STATUS_YES || normalized === ESIC_STATUS_APPLY_ABOVE_LIMIT;
}

export function computeEsicStatusFromGross(gross: number, esicLimit: number): string {
  return gross > 0 && gross <= esicLimit ? ESIC_STATUS_YES : ESIC_STATUS_NO;
}

export function getEsicDisplayLabel(flag?: string | null): string {
  return normalizeEsicStatus(flag) || ESIC_STATUS_NO;
}

export function matchesEsicCoverageFilter(
  flag: string | null | undefined,
  filterValue: string | null | undefined,
): boolean {
  const normalizedFilter = String(filterValue || "").trim().toLowerCase();
  if (!normalizedFilter || normalizedFilter === "all") return true;

  const isCovered = isEsicCoveredStatus(flag);
  if (normalizedFilter === "yes") return isCovered;
  if (normalizedFilter === "no") return !isCovered;

  return normalizeEsicStatus(flag).toLowerCase() === normalizedFilter;
}
