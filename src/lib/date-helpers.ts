export const MONTH_NAME_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Fiscal year order: April through March. */
export const FISCAL_MONTH_NAME_LIST = [
  ...MONTH_NAME_LIST.slice(3),
  ...MONTH_NAME_LIST.slice(0, 3),
];

export const getCurrentFY = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 3) {
    return `FY ${year}-${String(year + 1).slice(-2)}`;
  }
  return `FY ${year - 1}-${String(year).slice(-2)}`;
};

export const getFinancialYears = () => {
  const today = new Date();
  const currentFY = getCurrentFY(today);
  const currentStartYear = parseInt(currentFY.substring(3, 7));
  const list = [];
  const startYear = Math.min(2025, currentStartYear - 1);
  const endYear = currentStartYear + 1;
  for (let y = startYear; y <= endYear; y++) {
    list.push(`FY ${y}-${String(y + 1).slice(-2)}`);
  }
  return list;
};

export const getMonthsForFY = (fyStr: string) => {
  const list: string[] = [];
  const trimmed = (fyStr || "").trim();
  let startYear = NaN;
  if (/^\d{4}-\d{4}$/.test(trimmed)) {
    startYear = parseInt(trimmed.split("-")[0], 10);
  } else {
    startYear = parseInt(trimmed.substring(3, 7), 10);
  }
  if (!Number.isFinite(startYear)) startYear = new Date().getFullYear();
  for (let m = 3; m < 12; m++) list.push(`${MONTH_NAME_LIST[m]} ${startYear}`);
  for (let m = 0; m < 3; m++) list.push(`${MONTH_NAME_LIST[m]} ${startYear + 1}`);
  return list;
};

export const getCalendarYearFromFYRange = (monthName: string, fyRange: string): string => {
  const years = fyRange.split("-");
  const startYear = years[0];
  const endYear = years[1] || String(parseInt(startYear) + 1);
  if (["January", "February", "March"].includes(monthName)) return endYear;
  return startYear;
};

export const normalizeMonthKey = (monthStr: string | null | undefined): string => {
  const today = new Date();
  const fallback = `${MONTH_NAME_LIST[today.getMonth()]} ${today.getFullYear()}`;
  if (!monthStr || typeof monthStr !== "string") return fallback;
  const parts = monthStr.trim().split(/\s+/);
  if (parts.length < 2) return fallback;
  const monthName = parts[0];
  const year = parseInt(parts[parts.length - 1], 10);
  if (MONTH_NAME_LIST.indexOf(monthName) === -1 || !Number.isFinite(year)) return fallback;
  return `${monthName} ${year}`;
};

export const safeNumber = (val: unknown): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const getDaysInMonthStatic = (monthStr: string) => {
  const parts = monthStr.split(" ");
  const monthIndex = MONTH_NAME_LIST.indexOf(parts[0]);
  const year = parseInt(parts[1]) || 2026;
  if (monthIndex === -1) return 30;
  return new Date(year, monthIndex + 1, 0).getDate();
};

export interface ParsedDateOfBirth {
  year: number;
  month: number;
  day: number;
}

const MONTH_ALIASES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const monthIndexFromName = (name: string): number => {
  const key = name.toLowerCase().slice(0, 3);
  const idx = MONTH_ALIASES.indexOf(key);
  return idx >= 0 ? idx + 1 : 0;
};

const parseExcelSerialDate = (serial: number): ParsedDateOfBirth | null => {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

/** Parse employee DOB without timezone shifts (ISO, DD/MM/YYYY, Excel serial, month-name text). */
export const parseDateOfBirth = (dobStr: string | undefined | null): ParsedDateOfBirth | null => {
  if (!dobStr) return null;
  const str = String(dobStr).trim();
  if (!str) return null;

  const excelSerialMatch = str.match(/^(\d{4,5})(?:\.\d+)?$/);
  if (excelSerialMatch) {
    return parseExcelSerialDate(parseFloat(str));
  }

  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    return {
      year: parseInt(dmyMatch[3], 10),
      month: parseInt(dmyMatch[2], 10),
      day: parseInt(dmyMatch[1], 10),
    };
  }

  const namedWithYear = str.match(/^(\d{1,2})[-\s./]*([A-Za-z]+)[-\s./,]*(\d{4})$/);
  if (namedWithYear) {
    const month = monthIndexFromName(namedWithYear[2]);
    if (month > 0) {
      return {
        year: parseInt(namedWithYear[3], 10),
        month,
        day: parseInt(namedWithYear[1], 10),
      };
    }
  }

  const monthFirstWithYear = str.match(/^([A-Za-z]+)[-\s./]*(\d{1,2})[-\s./,]*(\d{4})$/);
  if (monthFirstWithYear) {
    const month = monthIndexFromName(monthFirstWithYear[1]);
    if (month > 0) {
      return {
        year: parseInt(monthFirstWithYear[3], 10),
        month,
        day: parseInt(monthFirstWithYear[2], 10),
      };
    }
  }

  const lower = str.toLowerCase();
  for (let i = 0; i < MONTH_ALIASES.length; i++) {
    if (lower.includes(MONTH_ALIASES[i])) {
      const dayMatch = lower.match(/\b(\d{1,2})\b/);
      const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
      return {
        year: yearMatch ? parseInt(yearMatch[0], 10) : 1990,
        month: i + 1,
        day: dayMatch ? parseInt(dayMatch[1], 10) : 1,
      };
    }
  }

  return null;
};

/** Show the stored DOB exactly as in the employee list (same field as EmployeeTable). */
export const formatEmployeeBirthDate = (dobStr: string | undefined | null): string => {
  const raw = String(dobStr ?? "").trim();
  return raw || "—";
};

export const getCurrentMonthName = (date: Date = new Date()) =>
  MONTH_NAME_LIST[date.getMonth()];

export const getTodayBirthdayLabel = (date: Date = new Date()) =>
  `${MONTH_NAME_LIST[date.getMonth()]} ${date.getDate()}`;

export const getOrdinalDay = (n: number) => {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};

/** Human-readable relative time, e.g. "just now", "2 min ago", "1 hr ago". */
export const formatRelativeTimeAgo = (value: string | Date): string => {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "—";

  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/** Human-readable duration from minutes, e.g. "45 min", "1 hr 20 min". */
export const formatDurationMinutes = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
};

/** App-wide locale and timezone for calendars and displayed dates. */
export const APP_DATE_LOCALE = "en-IN";
export const APP_TIMEZONE = "Asia/Kolkata";

/** Shared Tailwind classes for native date/time pickers across HRMS. */
export const DATE_INPUT_CLASS =
  "px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 " +
  "focus:outline-none focus:border-[#ff791a] focus:ring-2 focus:ring-[#ff791a]/20 transition cursor-pointer";

/** YYYY-MM-DD for HTML date inputs and API filters. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's date in Asia/Kolkata as YYYY-MM-DD. */
export function todayIsoDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
  }).format(date);
}

/**
 * Parse flexible date strings (ISO, DD-MM-YYYY, DD/MM/YYYY, optional time, prefixes like "Filed -").
 * Uses day-first (Indian) order for numeric dates.
 */
export function parseFlexibleDateMs(value: string): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // DD-MM-YYYY (GeM / tender dates) before Date.parse — JS treats 01-07-2026 as Jan 7 (MM-DD).
  const dmyMatch = raw.match(
    /(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    const year = Number(dmyMatch[3]);
    const hasTime = Boolean(dmyMatch[4]);
    const hour = dmyMatch[4] ? Number(dmyMatch[4]) : 12;
    const minute = dmyMatch[5] ? Number(dmyMatch[5]) : 0;
    const second = dmyMatch[6] ? Number(dmyMatch[6]) : 0;
    const ts = new Date(
      year,
      month,
      day,
      hasTime ? hour : 0,
      hasTime ? minute : 0,
      hasTime ? second : 0,
    ).getTime();
    if (!Number.isNaN(ts)) return ts;
  }

  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) return iso;

  return null;
}

export function isoDateStartMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export function isoDateEndMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function matchesIsoDateRange(
  valueMs: number | null,
  fromIso: string,
  toIso: string,
): boolean {
  if (!fromIso && !toIso) return true;
  if (valueMs === null) return false;

  const fromBound = fromIso ? isoDateStartMs(fromIso) : null;
  const toBound = toIso ? isoDateEndMs(toIso) : null;

  if (fromBound !== null && toBound !== null) {
    const lo = Math.min(fromBound, toBound);
    const hi = Math.max(fromBound, toBound);
    return valueMs >= lo && valueMs <= hi;
  }
  if (fromBound !== null) return valueMs >= fromBound;
  if (toBound !== null) return valueMs <= toBound;
  return true;
}

/** DD-MM-YYYY — matches tender Excel / filed-date columns. */
export function formatDmyDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/** DD-MM-YYYY HH:mm:ss — tender end-date storage format. */
export function formatDmyDateTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${formatDmyDate(date)} ${hours}:${minutes}:${seconds}`;
}

export function formatFiledDateStamp(date = new Date()): string {
  return `Filed - ${formatDmyDate(date)}`;
}

/** Human-readable app date (en-IN). Pass ISO yyyy-mm-dd, epoch ms, Date, or flexible text. */
export function formatAppDate(
  value: string | Date | number,
  options?: { withTime?: boolean },
): string {
  const withTime = options?.withTime ?? false;
  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = new Date(value);
  } else {
    const raw = String(value).trim();
    if (!raw) return "—";
    const ms = parseFlexibleDateMs(raw);
    date = ms !== null ? new Date(ms) : null;
    if (!date || Number.isNaN(date.getTime())) return raw;
  }

  if (!date || Number.isNaN(date.getTime())) return "—";

  const hasTime =
    withTime ||
    (typeof value === "string" && /\d{1,2}:\d{2}/.test(value));

  return new Intl.DateTimeFormat(APP_DATE_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(hasTime
      ? { hour: "2-digit", minute: "2-digit", hour12: true }
      : {}),
  }).format(date);
}

/** Label for yyyy-mm-dd picker values in filter chips and summaries. */
export function formatIsoDateLabel(iso: string): string {
  if (!iso) return "";
  return formatAppDate(`${iso}T12:00:00`);
}

export function formatIsoDateRangeLabel(fromIso: string, toIso: string): string {
  if (fromIso && toIso) {
    return `${formatIsoDateLabel(fromIso)} – ${formatIsoDateLabel(toIso)}`;
  }
  if (fromIso) return `From ${formatIsoDateLabel(fromIso)}`;
  if (toIso) return `Until ${formatIsoDateLabel(toIso)}`;
  return "";
}

/** Display tender filed-date text with consistent formatting. */
export function formatTenderFiledDate(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const ms = parseFlexibleDateMs(raw);
  if (ms === null) return raw;
  const formatted = formatAppDate(ms);
  return /^filed\s*-/i.test(raw) ? `Filed - ${formatted}` : formatted;
}

/** Parse yyyy-mm-dd + optional HH:mm into tender end-date storage string. */
export function composeTenderEndDate(isoDate: string, time?: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh = 0, mm = 0] = (time || "").split(":").map((n) => Number(n) || 0);
  return formatDmyDateTime(new Date(y, m - 1, d, hh, mm, 0));
}

export function parseTenderEndDateToPicker(value: string): { date: string; time: string } {
  const ms = parseFlexibleDateMs(value);
  if (ms === null) return { date: "", time: "" };
  const date = new Date(ms);
  const time = value.includes(":")
    ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    : "";
  return { date: toIsoDate(date), time };
}

/** Parse tender end-date storage string into datetime-local input value (yyyy-mm-ddTHH:mm). */
export function parseTenderEndDateToDateTimeLocal(value: string): string {
  const { date, time } = parseTenderEndDateToPicker(value);
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

/** Compose tender end-date storage string from datetime-local input value. */
export function composeTenderEndDateFromDateTimeLocal(value: string): string {
  if (!value) return "";
  const [date, time = ""] = value.split("T");
  return composeTenderEndDate(date, time.slice(0, 5));
}

export function parseTenderFiledDateToPicker(value: string): string {
  const ms = parseFlexibleDateMs(value);
  return ms === null ? "" : toIsoDate(new Date(ms));
}
