import { describe, it, expect } from "vitest";
import {
  prorateSalaryByAttendance,
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
  it("returns full salary when no attendance recorded", () => {
    expect(prorateSalaryByAttendance(30000, 26, 0, {})).toBe(30000);
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

  it("caps PF wage at statutory ceiling", () => {
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

  it("does not cover when ESIC flag is No, even below eligibility limit", () => {
    expect(isEmployeeEsicCovered(21000, 21000, true, "No")).toBe(false);
    expect(isEmployeeEsicCovered(15000, 21000, true, "No")).toBe(false);
    expect(isEmployeeEsicCovered(21000, 21000, true)).toBe(false);
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
