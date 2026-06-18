import { Employee } from "../types";
import { MONTH_NAME_LIST } from "./date-helpers";
import { isEmployeeExitedOnDayStatic } from "./employee-helpers";
import { getWorkingDaysCount } from "./salary-calc";

/** Day of week for a calendar day in "Month YYYY" (0 = Sunday). */
export function getDayOfWeekForMonthDay(monthStr: string, dayNum: number): number {
  const parts = monthStr.split(" ");
  const monthIndex = MONTH_NAME_LIST.indexOf(parts[0]);
  const year = parseInt(parts[1], 10) || new Date().getFullYear();
  if (monthIndex === -1) return 0;
  return new Date(year, monthIndex, dayNum).getDay();
}

/** Whether a calendar day is a weekly off for the employee's working-days cycle. */
export function isWeeklyOffDay(
  workingDaysType: string | undefined,
  monthStr: string,
  dayNum: number,
): boolean {
  const cycle = workingDaysType || "26 Days (Sun Off)";
  const dow = getDayOfWeekForMonthDay(monthStr, dayNum);

  if (cycle.includes("22") || /sat/i.test(cycle)) {
    return dow === 0 || dow === 6;
  }
  if (cycle.includes("30") || cycle.includes("31") || /no off/i.test(cycle)) {
    return false;
  }
  return dow === 0;
}

export function getEffectiveAttendanceStatus(
  workingDaysType: string | undefined,
  monthStr: string,
  dayNum: number,
  storedStatus: string,
): string {
  if (isWeeklyOffDay(workingDaysType, monthStr, dayNum)) {
    return "WO";
  }
  return storedStatus;
}

export function countMonthAttendance(
  empData: Record<string | number, string>,
  daysInMonth: number,
  isExitedOnDay: (day: number) => boolean,
  context?: { workingDaysType?: string; monthStr?: string },
): { presents: number; absents: number } {
  let presents = 0;
  let absents = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    if (isExitedOnDay(d)) continue;
    const storedStatus = empData[d] || "";
    const status =
      context?.monthStr !== undefined
        ? getEffectiveAttendanceStatus(context.workingDaysType, context.monthStr, d, storedStatus)
        : storedStatus;
    if (status === "WO") continue;
    if (status === "P") presents++;
    else if (status === "A") absents++;
  }

  return { presents, absents };
}

export type AttendanceRecordFilter = "all" | "absent" | "present";

export function employeeMatchesAttendanceRecordFilter(
  presents: number,
  absents: number,
  filter: AttendanceRecordFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "absent") return absents > 0;
  if (filter === "present") return presents > 0 && absents === 0;
  return true;
}

/** Working-days denominator for salary proration from the employee's cycle. */
export function getSalaryProrationDays(workingDaysType: string | undefined): number {
  return getWorkingDaysCount(workingDaysType);
}

export type BulkAttendanceDayMeta = {
  disabledDays: Set<number>;
};

/** Days that cannot be bulk-selected (only when every selected employee has exited). */
export function getBulkAttendanceDisabledDays(
  selectedEmployees: Employee[],
  monthStr: string,
  daysInMonth: number,
): BulkAttendanceDayMeta {
  const disabledDays = new Set<number>();

  if (selectedEmployees.length === 0) {
    return { disabledDays };
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const allExited = selectedEmployees.every((employee) =>
      isEmployeeExitedOnDayStatic(employee, monthStr, day),
    );
    if (allExited) disabledDays.add(day);
  }

  return { disabledDays };
}

export function filterSelectableBulkDays(
  days: number[],
  disabledDays: Set<number>,
): number[] {
  return days.filter((day) => !disabledDays.has(day));
}

export function isBulkAttendanceDayDisabled(
  dayNum: number,
  disabledDays: Set<number>,
): boolean {
  return disabledDays.has(dayNum);
}
