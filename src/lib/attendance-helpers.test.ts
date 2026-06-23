import { describe, it, expect } from "vitest";
import { Employee } from "../types";
import {
  isWeeklyOffDay,
  getEffectiveAttendanceStatus,
  getSalaryProrationDays,
  getBulkAttendanceDisabledDays,
  filterSelectableBulkDays,
  countMonthAttendance,
  countWorkingDaysInMonth,
  resolveBulkAttendanceStatus,
} from "./attendance-helpers";

const baseEmployee = (overrides: Partial<Employee> = {}): Employee =>
  ({
    id: "emp-1",
    employeeCode: "E001",
    nameAsPerAadhar: "Test Employee",
    workingDaysType: "26 Days (Sun Off)",
    ...overrides,
  }) as Employee;

describe("isWeeklyOffDay", () => {
  it("marks Sunday as weekly off for 26-day cycle", () => {
    // June 2026: 7th is Sunday
    expect(isWeeklyOffDay("26 Days (Sun Off)", "June 2026", 7)).toBe(true);
    expect(isWeeklyOffDay("26 Days (Sun Off)", "June 2026", 8)).toBe(false);
  });

  it("marks Saturday and Sunday as weekly off for 22-day cycle", () => {
    // June 2026: 6th is Saturday, 7th is Sunday
    expect(isWeeklyOffDay("22 Days (Sat/Sun Off)", "June 2026", 6)).toBe(true);
    expect(isWeeklyOffDay("22 Days (Sat/Sun Off)", "June 2026", 7)).toBe(true);
    expect(isWeeklyOffDay("22 Days (Sat/Sun Off)", "June 2026", 8)).toBe(false);
  });

  it("has no weekly off for 30/31-day cycle", () => {
    expect(isWeeklyOffDay("30/31 Days (No Off)", "June 2026", 7)).toBe(false);
    expect(isWeeklyOffDay("30/31 Days (No Off)", "June 2026", 6)).toBe(false);
  });
});

describe("getEffectiveAttendanceStatus", () => {
  it("returns WO on weekly off when no status stored", () => {
    expect(
      getEffectiveAttendanceStatus("26 Days (Sun Off)", "June 2026", 7, ""),
    ).toBe("WO");
  });

  it("returns present when explicitly marked on a weekly off day", () => {
    expect(
      getEffectiveAttendanceStatus("26 Days (Sun Off)", "June 2026", 7, "P"),
    ).toBe("P");
  });

  it("returns absent when explicitly marked on a weekly off day", () => {
    expect(
      getEffectiveAttendanceStatus("26 Days (Sun Off)", "June 2026", 7, "A"),
    ).toBe("A");
  });
});

describe("countWorkingDaysInMonth", () => {
  it("counts non-Sunday days for 26-day cycle in June 2026", () => {
    // June 2026 has 30 days and 4 Sundays (7, 14, 21, 28)
    expect(countWorkingDaysInMonth("26 Days (Sun Off)", "June 2026")).toBe(26);
  });

  it("counts non-weekend days for 22-day cycle in June 2026", () => {
    // June 2026 has 4 Saturdays and 4 Sundays
    expect(countWorkingDaysInMonth("22 Days (Sat/Sun Off)", "June 2026")).toBe(22);
  });

  it("counts all calendar days for 30/31-day cycle", () => {
    expect(countWorkingDaysInMonth("30/31 Days (No Off)", "January 2026")).toBe(31);
    expect(countWorkingDaysInMonth("30/31 Days (No Off)", "February 2026")).toBe(28);
  });
});

describe("resolveBulkAttendanceStatus", () => {
  it("returns WO on weekly off days", () => {
    expect(
      resolveBulkAttendanceStatus("26 Days (Sun Off)", "June 2026", 7, "P"),
    ).toBe("WO");
  });

  it("returns working-day status on non-off days", () => {
    expect(
      resolveBulkAttendanceStatus("26 Days (Sun Off)", "June 2026", 8, "P"),
    ).toBe("P");
    expect(
      resolveBulkAttendanceStatus("26 Days (Sun Off)", "June 2026", 8, "A"),
    ).toBe("A");
  });
});

describe("getSalaryProrationDays", () => {
  it("maps working-days cycle to salary denominator", () => {
    expect(getSalaryProrationDays("26 Days (Sun Off)")).toBe(26);
    expect(getSalaryProrationDays("22 Days (Sat/Sun Off)")).toBe(22);
    expect(getSalaryProrationDays("30/31 Days (No Off)")).toBe(30);
  });
});

describe("getBulkAttendanceDisabledDays", () => {
  it("does not disable weekly off days in the date picker", () => {
    const meta = getBulkAttendanceDisabledDays(
      [baseEmployee()],
      "June 2026",
      30,
    );

    expect(meta.disabledDays.has(7)).toBe(false);
    expect(meta.disabledDays.has(8)).toBe(false);
  });

  it("allows all days when mixing 30/31 and 26-day employees", () => {
    const meta = getBulkAttendanceDisabledDays(
      [
        baseEmployee({ id: "emp-1", workingDaysType: "26 Days (Sun Off)" }),
        baseEmployee({ id: "emp-2", workingDaysType: "30/31 Days (No Off)" }),
      ],
      "June 2026",
      30,
    );

    expect(meta.disabledDays.has(6)).toBe(false);
    expect(meta.disabledDays.has(7)).toBe(false);
  });

  it("filters only exited days from presets", () => {
    const meta = getBulkAttendanceDisabledDays(
      [baseEmployee()],
      "June 2026",
      10,
    );

    expect(
      filterSelectableBulkDays([1, 2, 3, 7, 8], meta.disabledDays),
    ).toEqual([1, 2, 3, 7, 8]);
  });

  it("does not count unmarked weekly off days as present or absent", () => {
    const { presents, absents } = countMonthAttendance(
      { 8: "A", 9: "P" },
      10,
      () => false,
      { workingDaysType: "26 Days (Sun Off)", monthStr: "June 2026" },
    );

    expect(presents).toBe(1);
    expect(absents).toBe(1);
  });

  it("counts present when a weekly off day is explicitly marked", () => {
    const { presents, absents } = countMonthAttendance(
      { 7: "P", 8: "A", 9: "P" },
      10,
      () => false,
      { workingDaysType: "26 Days (Sun Off)", monthStr: "June 2026" },
    );

    expect(presents).toBe(2);
    expect(absents).toBe(1);
  });
});
