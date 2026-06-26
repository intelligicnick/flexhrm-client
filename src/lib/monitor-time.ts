/** Human-readable duration, e.g. "30 min", "1h 15 min" */
export function formatDurationLabel(seconds: number): string {
  if (!seconds || seconds < 60) return "< 1 min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m} min`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

/** Short clock time, e.g. "12:30 PM" */
export function formatClock(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function resolveEndTime(
  start: string | null | undefined,
  end?: string | null,
  durationSeconds?: number,
): string | null {
  if (!start) return null;
  if (end) return end;
  if (!durationSeconds) return null;
  return new Date(new Date(start).getTime() + durationSeconds * 1000).toISOString();
}

/** e.g. "12:30 PM – 1:00 PM · 30 min" */
export function formatTimeRange(
  start: string | null | undefined,
  end?: string | null,
  durationSeconds?: number,
): string {
  if (!start) return "—";
  const endIso = resolveEndTime(start, end, durationSeconds);
  const startClock = formatClock(start);
  if (!endIso) return startClock;
  const endClock = formatClock(endIso);
  const secs =
    durationSeconds ??
    Math.max(0, Math.round((new Date(endIso).getTime() - new Date(start).getTime()) / 1000));
  return `${startClock} – ${endClock} · ${formatDurationLabel(secs)}`;
}

/** e.g. "Idle · 12:30 PM – 1:00 PM · 30 min" */
export function formatActivityRange(
  label: string,
  start: string | null | undefined,
  end?: string | null,
  durationSeconds?: number,
): string {
  const range = formatTimeRange(start, end, durationSeconds);
  if (range === "—") return label;
  return `${label} · ${range}`;
}
