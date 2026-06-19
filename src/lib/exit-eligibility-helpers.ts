import { MONTH_NAME_LIST } from "./date-helpers";

export type ExitEligibleEmployee = {
  employeeId: string;
  employeeCode: string;
  nameAsPerAadhar: string;
  location: string;
  role: string;
  lastPresentDate: string | null;
};

/** Last N calendar months ending at referenceMonth (inclusive). */
export function getLastNMonthKeys(referenceMonth: string, count: number): string[] {
  const parts = referenceMonth.trim().split(/\s+/);
  if (parts.length < 2 || count < 1) return [];

  const monthIndex = MONTH_NAME_LIST.indexOf(parts[0]);
  let year = parseInt(parts[parts.length - 1], 10);
  if (monthIndex === -1 || !Number.isFinite(year)) return [];

  let m = monthIndex;
  let y = year;
  const keys: string[] = [];

  for (let i = 0; i < count; i++) {
    keys.unshift(`${MONTH_NAME_LIST[m]} ${y}`);
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }

  return keys;
}

export function monthKeySortValue(monthKey: string): number {
  const parts = monthKey.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  const monthIndex = MONTH_NAME_LIST.indexOf(parts[0]);
  const year = parseInt(parts[parts.length - 1], 10);
  if (monthIndex === -1 || !Number.isFinite(year)) return 0;
  return year * 12 + monthIndex;
}

export function pickLatestMonthKey(monthKeys: string[]): string {
  if (monthKeys.length === 0) return "";
  return monthKeys.reduce((latest, key) =>
    monthKeySortValue(key) > monthKeySortValue(latest) ? key : latest,
  );
}

export function formatLastPresentDate(isoDate: string | null | undefined): string {
  if (!isoDate?.trim()) return "Never marked present";
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return isoDate;
  return new Date(parsed).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
