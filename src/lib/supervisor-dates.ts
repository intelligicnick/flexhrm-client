export function isPastDate(iso: string, refDate = new Date()): boolean {
  return iso < toIsoDate(refDate);
}

export function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's date in Asia/Kolkata (YYYY-MM-DD). */
export function todayIsoInKolkata(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function getDateRangeForPeriod(period: "day" | "week" | "month", refDate = new Date()): {
  fromDate: string;
  toDate: string;
  monthKey?: string;
} {
  const d = new Date(refDate);
  d.setHours(12, 0, 0, 0);

  if (period === "day") {
    const iso = toIsoDate(d);
    return { fromDate: iso, toDate: iso };
  }

  if (period === "week") {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      fromDate: toIsoDate(monday),
      toDate: toIsoDate(sunday),
    };
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
  return {
    fromDate: `${year}-${month}-01`,
    toDate: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
    monthKey: `${year}-${month}`,
  };
}

export function formatDisplayDate(iso: string, lang: "en" | "hi" = "en"): string {
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso + "T12:00:00"));
}

export function enumerateIsoDates(fromDate: string, toDate: string): string[] {
  const start = fromDate <= toDate ? fromDate : toDate;
  const end = fromDate <= toDate ? toDate : fromDate;
  const dates: string[] = [];
  const cursor = new Date(start + "T12:00:00");
  const endDate = new Date(end + "T12:00:00");
  while (cursor <= endDate) {
    dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function isDateInRange(iso: string, fromDate: string, toDate: string): boolean {
  const start = fromDate <= toDate ? fromDate : toDate;
  const end = fromDate <= toDate ? toDate : fromDate;
  return iso >= start && iso <= end;
}

export function getCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDow = first.getDay();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let day = 1; day <= lastDay; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function resolveHistoryFilterBounds(filter: SupervisorHistoryFilter): {
  fromDate: string;
  toDate: string;
} {
  if (filter.mode === "selectMonth" && filter.monthKey) {
    const range = getMonthRangeFromKey(filter.monthKey);
    return { fromDate: range.fromDate, toDate: range.toDate };
  }
  if (filter.mode === "customDate" && filter.customDate) {
    return { fromDate: filter.customDate, toDate: filter.customDate };
  }
  if (filter.mode === "dateRange") {
    const fromDate = filter.fromDate || filter.toDate;
    const toDate = filter.toDate || filter.fromDate;
    if (fromDate && toDate) {
      return fromDate <= toDate
        ? { fromDate, toDate }
        : { fromDate: toDate, toDate: fromDate };
    }
    if (fromDate) return { fromDate, toDate: fromDate };
    if (toDate) return { fromDate: toDate, toDate };
  }

  if (filter.mode === "dateRange") {
    const fromDate = filter.fromDate || filter.toDate;
    const toDate = filter.toDate || filter.fromDate;
    if (fromDate && toDate) {
      return fromDate <= toDate
        ? { fromDate, toDate }
        : { fromDate: toDate, toDate: fromDate };
    }
    if (fromDate) return { fromDate, toDate: fromDate };
    if (toDate) return { fromDate: toDate, toDate };
  }

  if (filter.mode === "day" || filter.mode === "week" || filter.mode === "month") {
    const range = getDateRangeForPeriod(filter.mode);
    return { fromDate: range.fromDate, toDate: range.toDate };
  }

  return getDateRangeForPeriod("week");
}

export function visitMatchesFilter(visitDate: string, filter: SupervisorHistoryFilter): boolean {
  const { fromDate, toDate } = resolveHistoryFilterBounds(filter);
  if (!fromDate || !toDate) return true;
  const normalized = visitDate.slice(0, 10);
  return normalized >= fromDate && normalized <= toDate;
}

export function groupVisitsByDate<T extends { visitDate: string }>(
  visits: T[],
): { date: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const visit of visits) {
    const date = visit.visitDate.slice(0, 10);
    const list = map.get(date) || [];
    list.push(visit);
    map.set(date, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

export type SupervisorHistoryFilterMode =
  | "day"
  | "week"
  | "month"
  | "customDate"
  | "dateRange"
  | "selectMonth";

export interface SupervisorHistoryFilter {
  mode: SupervisorHistoryFilterMode;
  customDate: string;
  fromDate: string;
  toDate: string;
  monthKey: string;
}

export function getMonthRangeFromKey(monthKey: string): { fromDate: string; toDate: string; monthKey: string } {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    fromDate: `${monthKey}-01`,
    toDate: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
    monthKey,
  };
}

export function getMonthOptions(count = 24, lang: "en" | "hi" = "en"): { value: string; label: string }[] {
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  const options: { value: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setDate(1);

  for (let i = 0; i < count; i++) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const value = `${year}-${month}`;
    const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
    options.push({ value, label });
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return options;
}

export function buildHistoryVisitQuery(filter: SupervisorHistoryFilter): URLSearchParams {
  const params = new URLSearchParams();
  const { fromDate, toDate } = resolveHistoryFilterBounds(filter);
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  return params;
}

export function getHistoryFilterSummary(
  filter: SupervisorHistoryFilter,
  lang: "en" | "hi" = "en",
): string {
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso + "T12:00:00"));

  if (filter.mode === "selectMonth" && filter.monthKey) {
    const [y, m] = filter.monthKey.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  }
  if (filter.mode === "customDate" && filter.customDate) return fmt(filter.customDate);
  if (filter.mode === "dateRange" && filter.fromDate && filter.toDate) {
    return filter.fromDate === filter.toDate
      ? fmt(filter.fromDate)
      : `${fmt(filter.fromDate)} – ${fmt(filter.toDate)}`;
  }

  const range = getDateRangeForPeriod(filter.mode as "day" | "week" | "month");
  if (filter.mode === "day") return fmt(range.fromDate);
  if (filter.mode === "month") {
    const [y, m] = range.monthKey!.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  }
  return `${fmt(range.fromDate)} – ${fmt(range.toDate)}`;
}

export function createDefaultHistoryFilter(): SupervisorHistoryFilter {
  const today = toIsoDate(new Date());
  const monthKey = today.slice(0, 7);
  return {
    mode: "week",
    customDate: today,
    fromDate: today,
    toDate: today,
    monthKey,
  };
}
