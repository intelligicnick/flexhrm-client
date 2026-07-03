import { describe, expect, it } from "vitest";
import {
  matchAttendanceRowToEmployee,
  normalizeAttendanceStatusToken,
  parseAttendanceSheetText,
} from "./attendance-pdf-parser";
import type { Employee } from "../types";

const sampleEmployees: Employee[] = [
  {
    id: "emp-1",
    srNo: 1,
    employeeCode: "EMP001",
    location: "Mumbai HQ",
    nameAsPerAadhar: "Rahul Sharma",
    nameAsPerAadharColumn: "Rahul Sharma",
    grossSalary: 20000,
    basicSalary: 10000,
    esic: "No",
    uan: "",
    aadharNo: "",
    panNo: "",
    nameAsPerPan: "",
    bankAccountNo: "",
    ifscCode: "",
    nameAsPerBank: "Rahul Sharma",
    fatherName: "",
    husbandName: "",
    pfJoiningDate: "",
    dateOfBirth: "",
    gender: "Male",
    maritalStatus: "Single",
    aadharLinkMobNo: "",
    previousUanNo: "",
    previousEsicNo: "",
    presentAddress: "",
    permanentAddress: "",
    nomineeName: "",
    nomineeDob: "",
    nomineeRelation: "",
    familyMember1Name: "",
    familyMember1Dob: "",
    familyMember1Relation: "",
    familyMember2Name: "",
    familyMember2Dob: "",
    familyMember2Relation: "",
    familyMember3Name: "",
    familyMember3Dob: "",
    familyMember3Relation: "",
  },
];

describe("normalizeAttendanceStatusToken", () => {
  it("normalizes common attendance codes", () => {
    expect(normalizeAttendanceStatusToken("p")).toBe("P");
    expect(normalizeAttendanceStatusToken("Absent")).toBe("A");
    expect(normalizeAttendanceStatusToken("WO")).toBe("WO");
    expect(normalizeAttendanceStatusToken("—")).toBeNull();
  });
});

describe("parseAttendanceSheetText", () => {
  it("parses typed flexhrm-style attendance rows and detects month", () => {
    const text = `
      FLEXHRM ENTERPRISE ATTENDANCE REGISTRY - April 2026
      Worksite Location Designation: Mumbai HQ
      SR Emp Code Name Location 1 2 3 4 5
      1 EMP001 Rahul Sharma Mumbai P A P P P 3 1
    `;

    const sheet = parseAttendanceSheetText(text, {
      source: "typed-text",
      employees: sampleEmployees,
    });

    expect(sheet.monthKey).toBe("April 2026");
    expect(sheet.rows.length).toBeGreaterThanOrEqual(1);
    expect(sheet.rows[0].employeeCode).toBe("EMP001");
    expect(sheet.rows[0].dayMarks[1]).toBe("P");
    expect(sheet.rows[0].dayMarks[2]).toBe("A");
    expect(sheet.rows[0].matchedEmployeeId).toBe("emp-1");
  });

  it("parses structured reference grid rows", () => {
    const text = `
      MONTH_KEY: June 2026
      GRID_FORMAT: REFERENCE_MUSTER_ROLL
      GRID_ROW|1|Rahul Sharma|CODE:EMP001|TOTAL:3|1:P 2:A 3:P 4:P
    `;

    const sheet = parseAttendanceSheetText(text, {
      source: "ocr",
      employees: sampleEmployees,
    });

    expect(sheet.monthKey).toBe("June 2026");
    expect(sheet.rows).toHaveLength(1);
    expect(sheet.rows[0].name).toBe("Rahul Sharma");
    expect(sheet.rows[0].employeeCode).toBe("EMP001");
    expect(sheet.rows[0].dayMarks[1]).toBe("P");
    expect(sheet.rows[0].dayMarks[2]).toBe("A");
    expect(sheet.rows[0].matchedEmployeeId).toBe("emp-1");
  });
});

describe("matchAttendanceRowToEmployee", () => {
  it("matches by employee code first", () => {
    const match = matchAttendanceRowToEmployee(
      { employeeCode: "EMP001", name: "Unknown", location: "" },
      sampleEmployees,
    );
    expect(match.employeeId).toBe("emp-1");
    expect(match.confidence).toBe("high");
  });

  it("handles OCR-like name noise", () => {
    const match = matchAttendanceRowToEmployee(
      { employeeCode: "", name: "RAHUL SHARMAA", location: "" },
      sampleEmployees,
    );
    expect(match.employeeId).toBe("emp-1");
    expect(["high", "medium"]).toContain(match.confidence);
  });
});
