import { describe, it, expect } from "vitest";
import {
  applySalaryFieldChange,
  deriveSalaryFromAnchor,
  getWorkingDaysCount,
  toSalaryFieldValues,
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

describe("applySalaryFieldChange", () => {
  it("sets gross as anchor on first gross entry and derives daily/basic", () => {
    const { values, anchor } = applySalaryFieldChange(
      base(),
      null,
      "grossSalary",
      "26000",
      50,
      21000,
    );
    expect(anchor).toBe("gross");
    expect(values.grossSalary).toBe(26000);
    expect(values.dailyWage).toBe(1000);
    expect(values.basicSalary).toBe(13000);
  });

  it("keeps gross anchor when working days change", () => {
    let anchor: "gross" | "daily" | "basic" | null = null;
    let values = base();

    ({ values, anchor } = applySalaryFieldChange(
      values,
      anchor,
      "grossSalary",
      "26000",
      50,
      21000,
    ));
    ({ values, anchor } = applySalaryFieldChange(
      values,
      anchor,
      "workingDaysType",
      "22 Days (Sat/Sun Off)",
      50,
      21000,
    ));

    expect(anchor).toBe("gross");
    expect(values.grossSalary).toBe(26000);
    expect(values.dailyWage).toBeCloseTo(1181.82, 2);
    expect(values.basicSalary).toBe(13000);
  });

  it("keeps daily anchor when working days change", () => {
    let anchor: "gross" | "daily" | "basic" | null = null;
    let values = base();

    ({ values, anchor } = applySalaryFieldChange(
      values,
      anchor,
      "dailyWage",
      "1000",
      50,
      21000,
    ));
    ({ values, anchor } = applySalaryFieldChange(
      values,
      anchor,
      "workingDaysType",
      "22 Days (Sat/Sun Off)",
      50,
      21000,
    ));

    expect(anchor).toBe("daily");
    expect(values.dailyWage).toBe(1000);
    expect(values.grossSalary).toBe(22000);
    expect(values.basicSalary).toBe(11000);
  });

  it("does not overwrite anchor when a non-anchor field is edited", () => {
    let anchor: "gross" | "daily" | "basic" | null = null;
    let values = base();

    ({ values, anchor } = applySalaryFieldChange(
      values,
      anchor,
      "grossSalary",
      "26000",
      50,
      21000,
    ));
    ({ values, anchor } = applySalaryFieldChange(
      values,
      anchor,
      "basicSalary",
      "12000",
      50,
      21000,
    ));

    expect(anchor).toBe("gross");
    expect(values.grossSalary).toBe(26000);
    expect(values.dailyWage).toBe(1000);
    expect(values.basicSalary).toBe(12000);
  });
});
