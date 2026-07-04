import { describe, it, expect } from "vitest";
import {
  prorateSalaryByAttendance,
  computeProratedGrossAndBasic,
  resolveFullMonthSalary,
  calculatePfAmounts,
  isEmployeeEsicCovered,
  calculateProfessionalTax,
  calculateProfessionalTaxSlabAmount,
  isPfEsicCompliant,
  isProfessionalTaxApplicable,
  resolveLocationCompliance,
  resolveLocationPtEnabled,
  PF_STATUTORY_CEILING,
} from "../utils";

describe("prorateSalaryByAttendance", () => {
  it("returns zero when present days are zero", () => {
    expect(prorateSalaryByAttendance(30000, 26, 0, {})).toBe(0);
    const allAbsent: Record<number, string> = {};
    for (let d = 1; d <= 26; d++) allAbsent[d] = "A";
    expect(prorateSalaryByAttendance(30000, 26, 0, allAbsent)).toBe(0);
  });

  it("returns full salary when no attendance recorded but presents are positive", () => {
    expect(prorateSalaryByAttendance(30000, 26, 10, {})).toBe(30000);
  });

  it("prorates by present days using working-days cycle (26-day example)", () => {
    const attendance: Record<number, string> = {};
    for (let d = 1; d <= 30; d++) {
      attendance[d] = d <= 10 ? "P" : "A";
    }
    expect(prorateSalaryByAttendance(10000, 26, 10, attendance)).toBe(3846);
  });

  it("prorates by present days when attendance exists (30-day cycle)", () => {
    const attendance: Record<number, string> = {};
    for (let d = 1; d <= 30; d++) {
      attendance[d] = d <= 20 ? "P" : "A";
    }
    expect(prorateSalaryByAttendance(30000, 30, 20, attendance)).toBe(20000);
  });

  it("returns raw amount when workingDaysInCycle is zero", () => {
    expect(prorateSalaryByAttendance(15000, 0, 10, { 1: "P" })).toBe(15000);
  });
});

describe("computeProratedGrossAndBasic", () => {
  const attendance25: Record<number, string> = {};
  for (let d = 1; d <= 31; d++) {
    attendance25[d] = d <= 25 ? "P" : "A";
  }

  it("prorates monthly wage by 26-day working cycle", () => {
    const emp = {
      grossSalary: 16392,
      basicSalary: 8196,
      dailyWage: 630.46,
      workingDaysType: "26 Days (Sun Off)",
      salaryWageMode: "monthly" as const,
    };
    const attendance26: Record<number, string> = {};
    for (let d = 1; d <= 30; d++) {
      attendance26[d] = d <= 26 ? "P" : "A";
    }
    expect(
      computeProratedGrossAndBasic(emp, 26, attendance26, "June 2026").gross,
    ).toBe(16392);
    expect(
      computeProratedGrossAndBasic(emp, 10, attendance26, "June 2026").gross,
    ).toBe(Math.round((16392 / 26) * 10));
  });

  it("prorates monthly wage by 22-day working cycle", () => {
    const emp = {
      grossSalary: 22000,
      basicSalary: 11000,
      dailyWage: 0,
      workingDaysType: "22 Days (Sat/Sun Off)",
      salaryWageMode: "monthly" as const,
    };
    expect(
      computeProratedGrossAndBasic(emp, 22, attendance25, "January 2026").gross,
    ).toBe(22000);
    expect(
      computeProratedGrossAndBasic(emp, 11, attendance25, "January 2026").gross,
    ).toBe(Math.round((22000 / 22) * 11));
  });

  it("prorates monthly wage by calendar days for 30/31 cycle", () => {
    const emp = {
      grossSalary: 15000,
      basicSalary: 7500,
      dailyWage: 0,
      workingDaysType: "30/31 Days (No Off)",
      salaryWageMode: "monthly" as const,
    };
    expect(
      computeProratedGrossAndBasic(emp, 25, attendance25, "January 2026").gross,
    ).toBe(Math.round((15000 / 31) * 25));
    expect(
      computeProratedGrossAndBasic(emp, 25, attendance25, "April 2026").gross,
    ).toBe(Math.round((15000 / 30) * 25));
    expect(
      computeProratedGrossAndBasic(emp, 25, attendance25, "February 2026").gross,
    ).toBe(Math.round((15000 / 28) * 25));
  });

  it("computes daily wage payroll as present days times daily wage", () => {
    const emp = {
      grossSalary: 26000,
      basicSalary: 13000,
      dailyWage: 1000,
      workingDaysType: "26 Days (Sun Off)",
      salaryWageMode: "daily" as const,
    };
    const result = computeProratedGrossAndBasic(emp, 25, attendance25, "January 2026");
    expect(result.gross).toBe(25000);
    expect(result.basic).toBe(12500);
  });
});

describe("resolveFullMonthSalary", () => {
  it("uses working days in month times daily wage for daily wage employees", () => {
    const emp = {
      grossSalary: 15000,
      dailyWage: 500,
      workingDaysType: "30/31 Days (No Off)",
      salaryWageMode: "daily" as const,
    };
    expect(resolveFullMonthSalary(emp, "January 2026")).toBe(15500);
    expect(resolveFullMonthSalary(emp, "April 2026")).toBe(15000);
    expect(resolveFullMonthSalary(emp, "February 2026")).toBe(14000);
  });

  it("uses salary-cycle working days for 26-day daily wage employees", () => {
    const emp = {
      grossSalary: 13000,
      dailyWage: 500,
      workingDaysType: "26 Days (Sun Off)",
      salaryWageMode: "daily" as const,
    };
    expect(resolveFullMonthSalary(emp, "June 2026")).toBe(13000);
    expect(resolveFullMonthSalary(emp, "January 2026")).toBe(13500);
  });

  it("uses stored gross for monthly wage employees", () => {
    const emp = {
      grossSalary: 15000,
      dailyWage: 500,
      workingDaysType: "30/31 Days (No Off)",
      salaryWageMode: "monthly" as const,
    };
    expect(resolveFullMonthSalary(emp, "January 2026")).toBe(15000);
  });
});

describe("calculatePfAmounts", () => {
  it("applies 12%/13% on gross when mode is gross", () => {
    const { employeePf, employerPf, pfWage } = calculatePfAmounts(20000, {
      mode: "gross",
      isCompliant: true,
    });
    expect(pfWage).toBe(20000);
    expect(employeePf).toBe(2400);
    expect(employerPf).toBe(2600);
  });

  it("caps PF wage at statutory ceiling when basic is at or above ceiling", () => {
    const { pfWage, employeePf } = calculatePfAmounts(25000, {
      mode: "ceiling_15000",
      monthlyBasic: 16000,
      isCompliant: true,
    });
    expect(pfWage).toBe(PF_STATUTORY_CEILING);
    expect(employeePf).toBe(1800);
  });

  it("uses basic for ceiling mode when basic is below ceiling", () => {
    const { pfWage, employeePf } = calculatePfAmounts(25000, {
      mode: "ceiling_15000",
      monthlyBasic: 12000,
      isCompliant: true,
    });
    expect(pfWage).toBe(12000);
    expect(employeePf).toBe(1440);
  });

  it("falls back to gross for ceiling mode when basic is not provided", () => {
    const { pfWage, employeePf } = calculatePfAmounts(25000, {
      mode: "ceiling_15000",
      isCompliant: true,
    });
    expect(pfWage).toBe(PF_STATUTORY_CEILING);
    expect(employeePf).toBe(1800);
  });

  it("returns zero when not compliant", () => {
    const result = calculatePfAmounts(20000, { isCompliant: false });
    expect(result).toEqual({ pfWage: 0, employeePf: 0, employerPf: 0 });
  });
});

describe("isEmployeeEsicCovered", () => {
  it("covers employee when ESIC flag is Yes", () => {
    expect(isEmployeeEsicCovered(21000, 21000, true, "Yes")).toBe(true);
    expect(isEmployeeEsicCovered(25000, 21000, true, "Yes")).toBe(true);
  });

  it("covers employee when ESIC is explicitly applied above the limit", () => {
    expect(isEmployeeEsicCovered(25000, 21000, true, "Apply Above 21000")).toBe(true);
  });

  it("does not cover when ESIC flag is No, even below eligibility limit", () => {
    expect(isEmployeeEsicCovered(21000, 21000, true, "No")).toBe(false);
    expect(isEmployeeEsicCovered(15000, 21000, true, "No")).toBe(false);
    expect(isEmployeeEsicCovered(21000, 21000, true)).toBe(false);
  });

  it("does not cover above-limit salary when ESIC remains No", () => {
    expect(isEmployeeEsicCovered(22000, 21000, true, "No")).toBe(false);
  });

  it("does not cover exempt employees even below the eligibility limit", () => {
    expect(isEmployeeEsicCovered(18000, 21000, true, "Exempt")).toBe(false);
  });

  it("returns false when not compliant", () => {
    expect(isEmployeeEsicCovered(15000, 21000, false, "Yes")).toBe(false);
  });
});

describe("calculateProfessionalTaxSlabAmount", () => {
  it("applies male slabs", () => {
    expect(calculateProfessionalTaxSlabAmount(7000, "Male")).toBe(0);
    expect(calculateProfessionalTaxSlabAmount(7500, "Male")).toBe(0);
    expect(calculateProfessionalTaxSlabAmount(8000, "Male")).toBe(175);
    expect(calculateProfessionalTaxSlabAmount(10000, "Male")).toBe(175);
    expect(calculateProfessionalTaxSlabAmount(15000, "Male")).toBe(200);
    expect(calculateProfessionalTaxSlabAmount(15000, "Male", "February 2026")).toBe(300);
  });

  it("applies female slabs", () => {
    expect(calculateProfessionalTaxSlabAmount(20000, "Female")).toBe(0);
    expect(calculateProfessionalTaxSlabAmount(25000, "Female")).toBe(0);
    expect(calculateProfessionalTaxSlabAmount(26000, "Female")).toBe(200);
    expect(calculateProfessionalTaxSlabAmount(26000, "Female", "February 2026")).toBe(300);
  });
});

describe("calculateProfessionalTax", () => {
  it("returns slab PT when PT is enabled", () => {
    expect(
      calculateProfessionalTax(20000, { isPtEnabled: true, gender: "Male" })
    ).toBe(200);
    expect(
      calculateProfessionalTax(26000, { isPtEnabled: true, gender: "Female" })
    ).toBe(200);
  });

  it("returns zero when PT is not enabled", () => {
    expect(
      calculateProfessionalTax(20000, { isPtEnabled: false, gender: "Male" })
    ).toBe(0);
  });
});

describe("statutory enablement helpers", () => {
  const locationCompliance = { Mumbai: true, Delhi: false };
  const locationPt = { Mumbai: true, Delhi: false };

  it("enables PF/ESIC when location or employee flag is on", () => {
    expect(
      isPfEsicCompliant({ location: "Delhi", complianceEnabled: false }, locationCompliance)
    ).toBe(false);
    expect(
      isPfEsicCompliant({ location: "Delhi", complianceEnabled: true }, locationCompliance)
    ).toBe(true);
    expect(
      isPfEsicCompliant({ location: "Mumbai", complianceEnabled: false }, locationCompliance)
    ).toBe(true);
  });

  it("enables PT when location or employee flag is on", () => {
    expect(
      isProfessionalTaxApplicable({ location: "Delhi", ptEnabled: false }, locationPt)
    ).toBe(false);
    expect(
      isProfessionalTaxApplicable({ location: "Delhi", ptEnabled: true }, locationPt)
    ).toBe(true);
    expect(
      isProfessionalTaxApplicable({ location: "Mumbai", ptEnabled: false }, locationPt)
    ).toBe(true);
  });

  it("matches locations case-insensitively", () => {
    expect(resolveLocationCompliance("mumbai", locationCompliance)).toBe(true);
    expect(resolveLocationPtEnabled("mumbai", locationPt)).toBe(true);
  });
});
