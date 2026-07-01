import { describe, it, expect } from "vitest";
import {
  applySalaryFieldChange,
  deriveSalaryFromAnchor,
  getMonthlySalaryProrationDays,
  getWorkingDaysCount,
  toSalaryFieldValues,
  applyWageModeSwitch,
  inferSalaryWageMode,
} from "./salary-calc";

const base = () =>
  toSalaryFieldValues({
    grossSalary: 0,
    dailyWage: 0,
    basicSalary: 0,
    workingDaysType: "26 Days (Sun Off)",
    esic: "No",
  });

describe("getWorkingDaysCount", () => {
  it("parses day counts from cycle labels", () => {
    expect(getWorkingDaysCount("22 Days (Sat/Sun Off)")).toBe(22);
    expect(getWorkingDaysCount("26 Days (Sun Off)")).toBe(26);
    expect(getWorkingDaysCount("30/31 Days (No Off)")).toBe(30);
  });
});

describe("getMonthlySalaryProrationDays", () => {
  it("uses fixed cycle days for 22/26 and calendar days for 30/31", () => {
    expect(getMonthlySalaryProrationDays("26 Days (Sun Off)", "June 2026")).toBe(26);
    expect(getMonthlySalaryProrationDays("22 Days (Sat/Sun Off)", "June 2026")).toBe(22);
    expect(getMonthlySalaryProrationDays("30/31 Days (No Off)", "April 2026")).toBe(30);
    expect(getMonthlySalaryProrationDays("30/31 Days (No Off)", "May 2026")).toBe(31);
  });
});

describe("deriveSalaryFromAnchor", () => {
  it("derives daily and basic from gross", () => {
    const result = deriveSalaryFromAnchor("gross", 26000, "26 Days (Sun Off)", 50, 21000);
    expect(result.grossSalary).toBe(26000);
    expect(result.dailyWage).toBe(1000);
    expect(result.basicSalary).toBe(13000);
    expect(result.esic).toBe("No");
  });

  it("derives gross and basic from daily", () => {
    const result = deriveSalaryFromAnchor("daily", 1000, "26 Days (Sun Off)", 50, 21000);
    expect(result.grossSalary).toBe(26000);
    expect(result.dailyWage).toBe(1000);
    expect(result.basicSalary).toBe(13000);
  });
});

describe("inferSalaryWageMode", () => {
  it("uses stored wage mode when present", () => {
    expect(inferSalaryWageMode({ salaryWageMode: "daily" })).toBe("daily");
    expect(inferSalaryWageMode({ salaryWageMode: "monthly" })).toBe("monthly");
  });
});

describe("applySalaryFieldChange", () => {
  it("derives daily and basic when monthly gross is entered", () => {
    const { values, wageMode } = applySalaryFieldChange(
      base(),
      "monthly",
      "grossSalary",
      "26000",
      50,
      21000,
    );
    expect(wageMode).toBe("monthly");
    expect(values.grossSalary).toBe(26000);
    expect(values.dailyWage).toBe(1000);
    expect(values.basicSalary).toBe(13000);
  });

  it("derives gross and basic when daily wage is entered in daily mode", () => {
    const { values, wageMode } = applySalaryFieldChange(
      base(),
      "daily",
      "dailyWage",
      "1000",
      50,
      21000,
    );
    expect(wageMode).toBe("daily");
    expect(values.dailyWage).toBe(1000);
    expect(values.grossSalary).toBe(26000);
    expect(values.basicSalary).toBe(13000);
  });

  it("keeps monthly anchor when working days change", () => {
    let values = base();

    ({ values } = applySalaryFieldChange(
      values,
      "monthly",
      "grossSalary",
      "26000",
      50,
      21000,
    ));
    ({ values } = applySalaryFieldChange(
      values,
      "monthly",
      "workingDaysType",
      "22 Days (Sat/Sun Off)",
      50,
      21000,
    ));

    expect(values.grossSalary).toBe(26000);
    expect(values.dailyWage).toBeCloseTo(1181.82, 2);
    expect(values.basicSalary).toBe(13000);
  });

  it("keeps daily anchor when working days change", () => {
    let values = base();

    ({ values } = applySalaryFieldChange(
      values,
      "daily",
      "dailyWage",
      "1000",
      50,
      21000,
    ));
    ({ values } = applySalaryFieldChange(
      values,
      "daily",
      "workingDaysType",
      "22 Days (Sat/Sun Off)",
      50,
      21000,
    ));

    expect(values.dailyWage).toBe(1000);
    expect(values.grossSalary).toBe(22000);
    expect(values.basicSalary).toBe(11000);
  });

  it("does not overwrite monthly gross when basic is edited", () => {
    let values = base();

    ({ values } = applySalaryFieldChange(
      values,
      "monthly",
      "grossSalary",
      "26000",
      50,
      21000,
    ));
    ({ values } = applySalaryFieldChange(
      values,
      "monthly",
      "basicSalary",
      "12000",
      50,
      21000,
    ));

    expect(values.grossSalary).toBe(26000);
    expect(values.dailyWage).toBe(1000);
    expect(values.basicSalary).toBe(12000);
  });

  it("preserves manual ESIC selection when salary fields are recalculated", () => {
    let values = toSalaryFieldValues({
      ...base(),
      grossSalary: 15000,
      basicSalary: 7500,
      esic: "No",
    });

    ({ values } = applySalaryFieldChange(
      values,
      "monthly",
      "workingDaysType",
      "22 Days (Sat/Sun Off)",
      50,
      21000,
    ));

    expect(values.esic).toBe("No");
  });
});

describe("applyWageModeSwitch", () => {
  it("recalculates from daily wage when switching to daily mode", () => {
    const current = toSalaryFieldValues({
      grossSalary: 26000,
      dailyWage: 1000,
      basicSalary: 13000,
      workingDaysType: "26 Days (Sun Off)",
      esic: "No",
    });
    const values = applyWageModeSwitch(current, "daily", 50, 21000);
    expect(values.dailyWage).toBe(1000);
    expect(values.grossSalary).toBe(26000);
    expect(values.basicSalary).toBe(13000);
  });
});
