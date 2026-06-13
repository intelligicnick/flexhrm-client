import { describe, it, expect } from "vitest";
import {
  prorateSalaryByAttendance,
  calculatePfAmounts,
  isEmployeeEsicCovered,
  calculateProfessionalTax,
  PF_STATUTORY_CEILING,
} from "../utils";

describe("prorateSalaryByAttendance", () => {
  it("returns full salary when no attendance recorded", () => {
    expect(prorateSalaryByAttendance(30000, 30, 0, {})).toBe(30000);
  });

  it("prorates by present days when attendance exists", () => {
    const attendance: Record<number, string> = {};
    for (let d = 1; d <= 30; d++) {
      attendance[d] = d <= 20 ? "P" : "A";
    }
    expect(prorateSalaryByAttendance(30000, 30, 20, attendance)).toBe(20000);
  });

  it("returns raw amount when daysInMonth is zero", () => {
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
  it("covers employee at or below eligibility limit", () => {
    expect(isEmployeeEsicCovered(21000, 21000, true)).toBe(true);
  });

  it("does not cover above limit unless flag is Yes", () => {
    expect(isEmployeeEsicCovered(25000, 21000, true)).toBe(false);
    expect(isEmployeeEsicCovered(25000, 21000, true, "Yes")).toBe(true);
  });

  it("returns false when not compliant", () => {
    expect(isEmployeeEsicCovered(15000, 21000, false)).toBe(false);
  });
});

describe("calculateProfessionalTax", () => {
  it("returns location PT when compliant", () => {
    expect(
      calculateProfessionalTax(20000, { isCompliant: true, locationPtAmount: 200 })
    ).toBe(200);
  });

  it("returns zero when not compliant", () => {
    expect(
      calculateProfessionalTax(20000, { isCompliant: false, locationPtAmount: 200 })
    ).toBe(0);
  });
});
