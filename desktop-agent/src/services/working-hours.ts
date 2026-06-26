export interface WorkingHoursConfig {
  startTime: string;
  endTime: string;
  workDays: number[];
  timezone?: string;
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function weekdayInTimezone(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? date.getUTCDay();
}

function minutesInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** Returns true when monitoring should run (inside configured work window). */
export function isWithinWorkingHours(
  workingHours: WorkingHoursConfig | undefined,
  now = new Date(),
): boolean {
  if (!workingHours?.startTime || !workingHours?.endTime) return true;

  const timezone = workingHours.timezone?.trim() || 'UTC';
  const workDays = workingHours.workDays?.length ? workingHours.workDays : [1, 2, 3, 4, 5];
  const day = weekdayInTimezone(now, timezone);
  if (!workDays.includes(day)) return false;

  const startMins = parseTimeToMinutes(workingHours.startTime);
  const endMins = parseTimeToMinutes(workingHours.endTime);
  if (startMins === null || endMins === null) return true;

  const currentMins = minutesInTimezone(now, timezone);
  if (startMins === endMins) return true;
  if (startMins < endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  return currentMins >= startMins || currentMins < endMins;
}
