export const MIN_DAYS_BETWEEN_SCHOOL_VISITS = 5;

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
