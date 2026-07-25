export const MIN_DAYS_BETWEEN_SCHOOL_VISITS = 5;

export interface SchoolVisitCooldownInfo {
  schoolWorkId: string;
  lastVisitDate: string | null;
  lastVisitBySupervisorId?: string | null;
  lastVisitBySupervisorName?: string | null;
  blockSharedCooldown: boolean;
  /** Star supervisors bypass the 5-day school visit cooldown. */
  cooldownExempt?: boolean;
}

export function daysSinceIsoDate(isoDate: string, from = new Date()): number {
  const past = new Date(`${isoDate}T12:00:00`);
  const now = new Date(from);
  now.setHours(12, 0, 0, 0);
  return Math.floor((now.getTime() - past.getTime()) / 86_400_000);
}

export function canVisitSchoolAgain(lastVisitDate?: string | null): boolean {
  if (!lastVisitDate) return true;
  return daysSinceIsoDate(lastVisitDate) >= MIN_DAYS_BETWEEN_SCHOOL_VISITS;
}

export function daysUntilSchoolVisitAllowed(lastVisitDate: string): number {
  return Math.max(0, MIN_DAYS_BETWEEN_SCHOOL_VISITS - daysSinceIsoDate(lastVisitDate));
}

export function latestVisitDateBySchool(
  visits: { schoolWorkId: string; visitDate: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const visit of visits) {
    const schoolId = String(visit.schoolWorkId || "").trim();
    if (!schoolId) continue;
    const prev = map.get(schoolId);
    if (!prev || visit.visitDate > prev) {
      map.set(schoolId, visit.visitDate);
    }
  }
  return map;
}

export function cooldownInfoBySchool(
  entries: SchoolVisitCooldownInfo[],
): Map<string, SchoolVisitCooldownInfo> {
  const map = new Map<string, SchoolVisitCooldownInfo>();
  for (const entry of entries) {
    const schoolId = String(entry.schoolWorkId || "").trim();
    if (!schoolId) continue;
    map.set(schoolId, entry);
  }
  return map;
}

export function formatVisitCooldownHint(
  t: (key: string) => string,
  options: {
    days: number;
    blockSharedCooldown?: boolean;
    lastVisitBySupervisorName?: string | null;
    currentSupervisorName?: string | null;
  },
): string {
  const {
    days,
    blockSharedCooldown,
    lastVisitBySupervisorName,
    currentSupervisorName,
  } = options;
  const peerName = String(lastVisitBySupervisorName || "").trim();
  const showPeer =
    blockSharedCooldown &&
    peerName &&
    peerName !== String(currentSupervisorName || "").trim();
  if (showPeer) {
    return t("visitCooldownHintShared")
      .replace("{days}", String(days))
      .replace("{supervisor}", peerName);
  }
  return t("visitCooldownHint").replace("{days}", String(days));
}
