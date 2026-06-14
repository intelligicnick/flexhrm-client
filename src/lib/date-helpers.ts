export const MONTH_NAME_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
