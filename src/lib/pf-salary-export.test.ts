import { describe, expect, it } from "vitest";
import {
  buildPfSalaryEmployeeRow,
  buildPfSalaryFilename,
  buildPfSalaryWorkbookBuffer,
  formatPfSalMonthLabel,
  resolveEmployeeEsicNoForExport,
  resolveEmployeeUanForExport,
  sanitizePfSalarySheetName,
  type PfSalaryExportContext,
} from "./pf-salary-export";
import type { Employee } from "../types";

describe("formatPfSalMonthLabel", () => {
  it("formats month key like the PF SAL template", () => {
    expect(formatPfSalMonthLabel("June 2026")).toBe("Month of JUNE-26");
  });
});

describe("sanitizePfSalarySheetName", () => {
  it("removes invalid Excel sheet characters", () => {
    expect(sanitizePfSalarySheetName("Bangalore/HQ")).toBe("Bangalore HQ");
  });
});

describe("buildPfSalaryEmployeeRow", () => {
  it("matches PF SAL template calculations for a sample employee", () => {
    const emp = {
      id: "1",
      srNo: 1,
      employeeCode: "E001",
      location: "Bangalore",
      nameAsPerAadhar: "Mallikarjuna",
      nameAsPerAadharColumn: "Mallikarjuna",
      grossSalary: 18194,
      basicSalary: 9097,
      gender: "Male",
      uan: "",
      previousEsicNo: "",
      pfCalculationMode: "ceiling_15000",
      workingDaysType: "22 Days (Sat/Sun Off)",
      esic: "Yes",
      complianceEnabled: true,
      pfJoiningDate: "2020-01-01",
      monthlyLedger: {},
    } as Employee;

    const attendanceDb = {
      "June 2026": {
        "1": {
          ...Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i + 1, "P"])),
          22: "A",
        },
      },
    };

    const row = buildPfSalaryEmployeeRow(emp, 1, {
      month: "June 2026",
      esicEligibilityLimit: 21000,
      attendanceDb,
      locationCompliance: { Bangalore: true },
      locationPtEnabled: {},
    });

    expect(resolveEmployeeUanForExport(emp)).toBe("");
    expect(resolveEmployeeEsicNoForExport(emp)).toBe("");

    expect(row[5]).toBe(18194);
    expect(row[6]).toBe(22);
    expect(row[7]).toBe(21);
    expect(row[12]).toBe(17367);
    expect(row[17]).toBe(15000);
    expect(row[19]).toBe(1800);
    expect(row[29]).toBe(1950);
  });

  it("pulls UAN and ESIC number from employee master fields", () => {
    const emp = {
      id: "2",
      uan: "100234567890",
      previousEsicNo: "12345678901234567",
    } as Employee;

    expect(resolveEmployeeUanForExport(emp)).toBe("100234567890");
    expect(resolveEmployeeEsicNoForExport(emp)).toBe("12345678901234567");
  });
});
