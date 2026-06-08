/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { Employee, EXCEL_ROW_HEADERS } from "./types";

// State-machine CSV Line Parser supporting quotes, double-quotes escaping, and customized delimiters (comma, semicolon, tab)
export function parseCSVLine(line: string, delimiter: string = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'; // Unescape double double-quotes
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((val) => {
    let s = val.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.substring(1, s.length - 1);
    }
    return s.replace(/""/g, '"');
  });
}

// Map normalized headers to set of recognizable normalized aliases for ultimate robustness
const HEADER_ALIASES: Record<string, string[]> = {
  "srno": ["srno", "sno", "slno", "serialno", "serialnumber"],
  "employeecode": ["employeecode", "empcode", "code", "id", "employeeid", "empid", "employeescode"],
  "location": ["location", "worksite", "branch", "city", "site"],
  "employeenameasperaadhar": ["employeenameasperaadhar", "nameasperaadhar", "nameaadhar", "aadharname", "employeeaadharname", "name", "employeename"],
  "grosssalary": ["grosssalary", "gross", "grosssal", "totalgross"],
  "basicsalary": ["basicsalary", "basicsal", "basic"],
  "esic": ["esic", "esiccovered", "esicstatus", "esiceligibility"],
  "workingdayscycle": ["workingdayscycle", "workingdays", "workingday", "daysmonth", "dayscycle", "cycle"],
  "uan": ["uan", "uanno", "pfuan", "pfuanno"],
  "aadharno": ["aadharno", "aadhar", "aadharcard", "aadharid", "aadharcardno"],
  "nameasperaadhar": ["nameasperaadhar", "nameaadhar", "aadharname", "employeenameasperaadhar"],
  "panno": ["panno", "pan", "pancard", "pancardno"],
  "nameasperpan": ["nameasperpan", "namepan", "panname"],
  "bankaccountno": ["bankaccountno", "accountno", "bankacc", "bankaccno", "accno", "accountnumber"],
  "ifsccode": ["ifsccode", "ifsc"],
  "employeenameasperbank": ["employeenameasperbank", "nameasperbank", "bankname", "nameinbank", "employeeaccountname"],
  "father": ["father", "fathername", "fathersname", "fathers"],
  "husbandname": ["husbandname", "husband", "husbandsname", "husbands"],
  "pfjoiningdate": ["pfjoiningdate", "joiningdate", "dateofjoining", "doj"],
  "dateofbirth": ["dateofbirth", "dob", "birthdate"],
  "gender": ["gender", "sex"],
  "maritalstatus": ["maritalstatus", "marital", "status"],
  "aadharlinkmobno": ["aadharlinkmobno", "aadharlinkmob", "aadharlinkmobile", "mobileno", "mobile", "phoneno", "phone", "aadharmobile"],
  "previousuanno": ["previousuanno", "preuanno", "prevuan", "previousuan"],
  "previousesicno": ["previousesicno", "preesicno", "prevesic", "previousesic"],
  "presentaddress": ["presentaddress", "address", "address1", "localaddress"],
  "permanentaddress": ["permanentaddress", "address2", "permanentaddress", "homeaddress"],
  "nomineenameesic": ["nomineenameesic", "nomineename", "nominee"],
  "nomineedob": ["nomineedob", "nominebirthdate", "nomineedateofbirth"],
  "nomineerelation": ["nomineerelation", "nomineerelationship", "relation"],
  "skillcategory": ["skillcategory", "skill", "skilllevel", "category"],
  "jobrole": ["jobrole", "role", "designation", "position"],
  "dailywage": ["dailywage", "rate", "dailyrate", "wage"],
  "employeemobile": ["employeemobile", "personalmobile", "empmobile", "contactno"],
  "nomineemobile": ["nomineemobile", "nomineephone", "nomineemob"],
  "familymembermobile1": ["familymembermobile1", "familymember1mobile", "dependent1mobile", "dependent1phone"],
  "familymembermobile2": ["familymembermobile2", "familymember2mobile", "dependent2mobile", "dependent2phone"],
  "familymembermobile3": ["familymembermobile3", "familymember3mobile", "dependent3mobile", "dependent3phone"],
};

// Helper to find the index of a header in a tiered, normalized manner
export function findHeaderIndex(headerRow: string[], targetHeader: string): number {
  const normTarget = targetHeader.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/employees/g, "employee");
  if (!normTarget) return -1;
  
  // Tier 1: Exact lowercase trim match
  let idx = headerRow.findIndex(
    (h) => h.trim() !== "" && h.toLowerCase().trim() === targetHeader.toLowerCase().trim()
  );
  if (idx !== -1) return idx;

  // Tier 2: Exact normalized alphanumeric match
  idx = headerRow.findIndex((h) => {
    const normH = h.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/employees/g, "employee");
    return normH !== "" && normH === normTarget;
  });
  if (idx !== -1) return idx;

  // Tier 3: Loose match via explicit aliases dictionary
  const targetAliases = HEADER_ALIASES[normTarget] || [normTarget];
  idx = headerRow.findIndex((h) => {
    const normH = h.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/employees/g, "employee");
    if (!normH) return false;
    return targetAliases.includes(normH) || targetAliases.some(alias => alias !== "" && (normH.includes(alias) || alias.includes(normH)));
  });
  if (idx !== -1) return idx;

  // Tier 4: Loose checks with sub-replacement
  const looseTarget = normTarget.replace(/number/g, "no").replace(/no/g, "");
  idx = headerRow.findIndex((h) => {
    const normH = h.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/employees/g, "employee");
    const looseH = normH.replace(/number/g, "no").replace(/no/g, "");
    if (!looseH || !looseTarget) return false;
    return looseH === looseTarget || looseH.includes(looseTarget) || looseTarget.includes(looseH);
  });
  if (idx !== -1) return idx;

  return -1;
}

// Scans rows in any grid of cells to find the row that matches the highest number of expected headers, allowing title blurbs on top
export function locateHeaderRow(rows: any[][]): { headerRowIndex: number; idxMap: Record<string, number> } {
  let highestMatchCount = -1;
  let bestRowIndex = 0;
  let bestIdxMap: Record<string, number> = {};

  // We scan first 15 rows to find the best header row candidate
  const scanLimit = Math.min(rows.length, 15);
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    
    // Convert all cells in this row to string
    const stringCells = row.map(cell => cell !== undefined && cell !== null ? String(cell).trim() : "");
    if (stringCells.every(s => s === "")) continue;

    // Check how many expected headers we can find in this row
    const tempIdxMap: Record<string, number> = {};
    let matchCount = 0;

    EXCEL_ROW_HEADERS.forEach((header) => {
      const idx = findHeaderIndex(stringCells, header);
      tempIdxMap[header] = idx;
      if (idx !== -1) {
        matchCount++;
      }
    });

    if (matchCount > highestMatchCount) {
      highestMatchCount = matchCount;
      bestRowIndex = r;
      bestIdxMap = tempIdxMap;
    }
  }

  // Fallback defaults to row 0 if no clear headers found (with less than 2 matches)
  if (highestMatchCount < 2) {
    const defaultIdxMap: Record<string, number> = {};
    const stringCells = (rows[0] || []).map(cell => cell !== undefined && cell !== null ? String(cell).trim() : "");
    EXCEL_ROW_HEADERS.forEach((header) => {
      defaultIdxMap[header] = findHeaderIndex(stringCells, header);
    });
    return { headerRowIndex: 0, idxMap: defaultIdxMap };
  }

  return { headerRowIndex: bestRowIndex, idxMap: bestIdxMap };
}

// Full CSV Parse function supporting dynamic delimiter detection and flexible header matching
export function parseCSV(text: string): Partial<Employee>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  // Auto-detect delimiter (comma, semicolon, or tab)
  const firstLine = lines[0];
  let delimiter = ",";
  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (char === ",") commaCount++;
      else if (char === ";") semiCount++;
      else if (char === "\t") tabCount++;
    }
  }

  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ";";
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = "\t";
  }

  // Parse all lines into cell arrays
  const parsedLines = lines.map((line) => parseCSVLine(line, delimiter));

  // Locate the header row dynamically (bypass empty/title blocks on top)
  const { headerRowIndex, idxMap } = locateHeaderRow(parsedLines);

  const parsedEmployees: Partial<Employee>[] = [];

  for (let i = headerRowIndex + 1; i < parsedLines.length; i++) {
    const values = parsedLines[i];
    if (values.length === 0 || values.every((v) => v === "")) continue;

    // Helper to extract value by header name safely
    const getVal = (header: string) => {
      const idx = idxMap[header];
      if (idx !== undefined && idx >= 0 && idx < values.length) {
        return values[idx];
      }
      return "";
    };

    const dailyWageVal = parseFloat(getVal("Daily Wage")) || 0;
    const workingDaysCycle = getVal("Working Days Cycle") || "26 Days (Sun Off)";
    
    // Auto-calculate gross if not given and daily wage is provided
    let grossVal = parseFloat(getVal("Gross Salary***")) || 0;
    if (grossVal === 0 && dailyWageVal > 0) {
      const daysMatch = workingDaysCycle.match(/(\d+)\s*Days?/i);
      const daysCount = daysMatch ? parseInt(daysMatch[1]) : 26;
      grossVal = Math.round(dailyWageVal * daysCount);
    }
    
    // Auto-calculate daily wage if gross is given and daily wage is not provided
    let finalDailyWage = dailyWageVal;
    if (finalDailyWage === 0 && grossVal > 0) {
      const daysMatch = workingDaysCycle.match(/(\d+)\s*Days?/i);
      const daysCount = daysMatch ? parseInt(daysMatch[1]) : 26;
      finalDailyWage = parseFloat((grossVal / daysCount).toFixed(2));
    }

    const basicVal = parseFloat(getVal("Basic Salary***")) || 0;

    const rawCode = getVal("Employees Code **").trim();
    const generatedCode = rawCode || `EMP-${100 + i}-${Math.floor(1000 + Math.random() * 9000)}`;

    const emp: Partial<Employee> = {
      srNo: parseInt(getVal("SR NO")) || i - headerRowIndex,
      employeeCode: generatedCode,
      location: getVal("Location"),
      nameAsPerAadhar: getVal("EMPLOYEE NAME AS PER AADHAR ***"),
      grossSalary: grossVal,
      basicSalary: basicVal || Math.round(grossVal * 0.5), // Fallback to 50% of gross
      esic: getVal("ESIC") || (grossVal <= 21000 && grossVal > 0 ? "Yes" : "No"),
      workingDaysType: workingDaysCycle,
      uan: getVal("UAN"),
      aadharNo: getVal("AADHAR NO **"),
      nameAsPerAadharColumn: getVal("NAME AS PER AADHAR **"),
      panNo: getVal("PAN NO"),
      nameAsPerPan: getVal("NAME AS PER PAN"),
      bankAccountNo: getVal("BANK ACCOUNT NO **"),
      ifscCode: getVal("IFSC CODE **"),
      nameAsPerBank: getVal("EMPLOYEE NAME AS PER BANK **"),
      fatherName: getVal("FATHER **"),
      husbandName: getVal("HUSBAND NAME **"),
      pfJoiningDate: getVal("PF JOINING DATE"),
      dateOfBirth: getVal("DATE OF BIRTH"),
      gender: getVal("GENDER **"),
      maritalStatus: getVal("MARITAL STATUS **"),
      aadharLinkMobNo: getVal("AADHAR LINK MOB.NO. **"),
      previousUanNo: getVal("PREVIOUS UAN NO"),
      previousEsicNo: getVal("PREVIOUS ESIC NO***"),
      presentAddress: getVal("Present Address**"),
      permanentAddress: getVal("Permanent Address**"),
      nomineeName: getVal("Nominee Name (ESIC)"),
      nomineeDob: getVal("Nominee DOB"),
      nomineeRelation: getVal("Nominee Relation"),
      familyMember1Name: getVal("Family Member Name (1)"),
      familyMember1Dob: getVal("Family Member DOB (1)"),
      familyMember1Relation: getVal("Family Member Relation (1)"),
      familyMember2Name: getVal("Family Member Name (2)"),
      familyMember2Dob: getVal("Family Member DOB (2)"),
      familyMember2Relation: getVal("Family Member Relation (2)"),
      familyMember3Name: getVal("Family Member Name (3)"),
      familyMember3Dob: getVal("Family Member DOB (3)"),
      familyMember3Relation: getVal("Family Member Relation (3)"),
      skillCategory: normalizeSkillCategory(getVal("Skill Category")) || undefined,
      role: getVal("Job Role") || undefined,
      dailyWage: finalDailyWage || undefined,
      employeeMobile: getVal("Employee Mobile") || undefined,
      nomineeMobile: getVal("Nominee Mobile") || undefined,
      familyMember1Mobile: getVal("Family Member Mobile (1)") || undefined,
      familyMember2Mobile: getVal("Family Member Mobile (2)") || undefined,
      familyMember3Mobile: getVal("Family Member Mobile (3)") || undefined,
    };

    parsedEmployees.push(emp);
  }

  return parsedEmployees;
}

// Convert a field to a valid CSV cell value (quotes if commas or quotes exist)
export function quoteCSVValue(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Maps spreadsheet headers to Employee fields (ESIC export / import round-trip). */
export const EMPLOYEE_HEADER_KEY_MAP: Record<string, keyof Employee> = {
  "SR NO": "srNo",
  "Employees Code **": "employeeCode",
  "Location": "location",
  "EMPLOYEE NAME AS PER AADHAR ***": "nameAsPerAadhar",
  "Gross Salary***": "grossSalary",
  "Basic Salary***": "basicSalary",
  "ESIC": "esic",
  "Working Days Cycle": "workingDaysType",
  "UAN": "uan",
  "AADHAR NO **": "aadharNo",
  "NAME AS PER AADHAR **": "nameAsPerAadharColumn",
  "PAN NO": "panNo",
  "NAME AS PER PAN": "nameAsPerPan",
  "BANK ACCOUNT NO **": "bankAccountNo",
  "IFSC CODE **": "ifscCode",
  "EMPLOYEE NAME AS PER BANK **": "nameAsPerBank",
  "FATHER **": "fatherName",
  "HUSBAND NAME **": "husbandName",
  "PF JOINING DATE": "pfJoiningDate",
  "DATE OF BIRTH": "dateOfBirth",
  "GENDER **": "gender",
  "MARITAL STATUS **": "maritalStatus",
  "AADHAR LINK MOB.NO. **": "aadharLinkMobNo",
  "PREVIOUS UAN NO": "previousUanNo",
  "PREVIOUS ESIC NO***": "previousEsicNo",
  "Present Address**": "presentAddress",
  "Permanent Address**": "permanentAddress",
  "Nominee Name (ESIC)": "nomineeName",
  "Nominee DOB": "nomineeDob",
  "Nominee Relation": "nomineeRelation",
  "Family Member Name (1)": "familyMember1Name",
  "Family Member DOB (1)": "familyMember1Dob",
  "Family Member Relation (1)": "familyMember1Relation",
  "Family Member Name (2)": "familyMember2Name",
  "Family Member DOB (2)": "familyMember2Dob",
  "Family Member Relation (2)": "familyMember2Relation",
  "Family Member Name (3)": "familyMember3Name",
  "Family Member DOB (3)": "familyMember3Dob",
  "Family Member Relation (3)": "familyMember3Relation",
  "Skill Category": "skillCategory",
  "Job Role": "role",
  "Daily Wage": "dailyWage",
  "Employee Mobile": "employeeMobile",
  "Nominee Mobile": "nomineeMobile",
  "Family Member Mobile (1)": "familyMember1Mobile",
  "Family Member Mobile (2)": "familyMember2Mobile",
  "Family Member Mobile (3)": "familyMember3Mobile",
};

export function getEmployeeHeaderValue(emp: Employee, header: string, index: number): string | number {
  if (header === "SR NO") return index + 1;
  const key = EMPLOYEE_HEADER_KEY_MAP[header];
  if (!key) return "";
  const val = emp[key];
  if (val === undefined || val === null || val === "") {
    if (key === "workingDaysType") return "26 Days (Sun Off)";
    return "";
  }
  return val as string | number;
}

/** True when employee skill matches any selected filter label (normalized). */
export function employeeMatchesSkillFilters(emp: Employee, filters: string[]): boolean {
  if (!filters.length) return true;
  const empSkill = normalizeSkillCategory(emp.skillCategory).toLowerCase();
  return filters.some((f) => empSkill === f.toLowerCase());
}

/** Prorate monthly salary only when at least one attendance day is recorded for the month. */
export function prorateSalaryByAttendance(
  rawAmount: number,
  daysInMonth: number,
  presents: number,
  empMonthAttendance: Record<string | number, string>
): number {
  if (daysInMonth <= 0) return rawAmount;
  const hasRecordedAttendance = Object.values(empMonthAttendance).some(
    (v) => v !== undefined && v !== null && String(v).trim() !== ""
  );
  if (!hasRecordedAttendance) return rawAmount;
  return Math.round((rawAmount / daysInMonth) * presents);
}

/** ESIC applies when compliant and (gross ≤ ceiling OR employee ESIC flag is Yes). */
export function isEmployeeEsicCovered(
  gross: number,
  esicEligibilityLimit: number,
  isCompliant: boolean,
  esicFlag?: string
): boolean {
  if (!isCompliant) return false;
  return (
    gross > 0 &&
    (gross <= esicEligibilityLimit || (esicFlag || "").toLowerCase() === "yes")
  );
}

// Generate the CSV file download string matching EXCEL_ROW_HEADERS order exactly
export function generateCSV(employees: Employee[]): string {
  const fileLines: string[] = [];
  fileLines.push(EXCEL_ROW_HEADERS.join(","));
  employees.forEach((emp, index) => {
    const row = EXCEL_ROW_HEADERS.map((header) =>
      quoteCSVValue(getEmployeeHeaderValue(emp, header, index))
    );
    fileLines.push(row.join(","));
  });
  return fileLines.join("\n");
}

export const SKILL_CATEGORIES = ["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"] as const;

/** Maps legacy/import variants (e.g. UNSKILLED, HIGH SKILLED) to canonical dropdown labels. */
export function normalizeSkillCategory(value: string | undefined | null): string {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";

  const compact = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (compact === "highlyskilled" || compact === "highskilled") return "Highly Skilled";
  if (compact === "semiskilled") return "Semi Skilled";
  if (compact === "unskilled") return "Unskilled";
  if (compact === "skilled") return "Skilled";

  const caseMatch = SKILL_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (caseMatch) return caseMatch;

  return trimmed;
}

export type PfCalculationMode = "gross" | "ceiling_15000";

export const PF_STATUTORY_CEILING = 15000;
export const EMPLOYEE_PF_RATE = 0.12;
export const EMPLOYER_PF_RATE = 0.13;

export function resolvePfCalculationMode(mode?: string | null): PfCalculationMode {
  return mode === "gross" ? "gross" : "ceiling_15000";
}

function toNonNegativeNumber(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Monthly PF wage from actual gross (already prorated for the pay month when applicable). */
export function calculatePfWage(monthlyGross: number, mode?: string | null): number {
  const gross = toNonNegativeNumber(monthlyGross);
  if (resolvePfCalculationMode(mode) === "gross") {
    return gross;
  }
  return gross >= PF_STATUTORY_CEILING ? PF_STATUTORY_CEILING : gross;
}

export interface PfAmounts {
  pfWage: number;
  employeePf: number;
  employerPf: number;
}

export function calculatePfAmounts(
  monthlyGross: number,
  options: {
    mode?: string | null;
    isCompliant?: boolean;
    employeePfRate?: number;
    employerPfRate?: number;
  } = {}
): PfAmounts {
  const {
    mode,
    isCompliant = true,
    employeePfRate = EMPLOYEE_PF_RATE,
    employerPfRate = EMPLOYER_PF_RATE,
  } = options;

  if (!isCompliant) {
    return { pfWage: 0, employeePf: 0, employerPf: 0 };
  }

  const pfWage = calculatePfWage(monthlyGross, mode);
  return {
    pfWage,
    employeePf: Math.round(pfWage * employeePfRate),
    employerPf: Math.round(pfWage * employerPfRate),
  };
}

export const DEFAULT_LOCATION_PT_AMOUNT = 200;
export const DEFAULT_PT_GROSS_THRESHOLD = 10000;

export function readLocationPtAmountsFromStorage(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem("hrms_location_pt_amount");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function parseLocationPtInput(
  raw: string,
  fallback = DEFAULT_LOCATION_PT_AMOUNT
): number {
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

export function resolveLocationPtAmount(
  location: string | undefined,
  locationPtMap: Record<string, number>,
  defaultAmount = DEFAULT_LOCATION_PT_AMOUNT
): number {
  if (!location?.trim()) return defaultAmount;
  const locLower = location.trim().toLowerCase();
  const matchedKey = Object.keys(locationPtMap).find((k) => k.toLowerCase() === locLower);
  if (matchedKey !== undefined) {
    const amount = Number(locationPtMap[matchedKey]);
    return Number.isFinite(amount) && amount >= 0 ? amount : defaultAmount;
  }
  return defaultAmount;
}

/** Professional tax for the month using location-specific PT amount when gross exceeds threshold. */
export function calculateProfessionalTax(
  monthlyGross: number,
  options: {
    isCompliant?: boolean;
    locationPtAmount?: number;
    grossThreshold?: number;
  } = {}
): number {
  const {
    isCompliant = true,
    locationPtAmount = DEFAULT_LOCATION_PT_AMOUNT,
    grossThreshold = DEFAULT_PT_GROSS_THRESHOLD,
  } = options;

  if (!isCompliant) return 0;
  const gross = Number(monthlyGross);
  if (!Number.isFinite(gross) || gross <= grossThreshold) return 0;
  const amount = Number(locationPtAmount);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

// Calculation for standard Indian salary onboarding
export function calculateSalaryDetails(
  gross: number,
  basicPercentOfGross = 50,
  esicEligibilityLimit = 21000
): { basic: number; esic: string } {
  const pct = Math.min(100, Math.max(0, basicPercentOfGross)) / 100;
  const basic = Math.round(gross * pct);
  const esic = gross > 0 && gross <= esicEligibilityLimit ? "Yes" : "No";
  return { basic, esic };
}

// Validation of fields based on the mandatory indicators (**) and (***)
// Modifed to make all fields completely optional to support flexible CSV importing & manual onboarding
export function validateEmployee(emp: Partial<Employee>): Record<string, string> {
  const errors: Record<string, string> = {};
  // Under the user's instructions, no fields are strictly validated as mandatory here.
  return errors;
}

// Full sheet parsing supporting SheetJS arrays of arrays
export function parseSheetRows(sheetRows: any[][]): Partial<Employee>[] {
  if (sheetRows.length === 0) return [];
  
  // Locate the header row dynamically (bypass empty/title blocks on top)
  const { headerRowIndex, idxMap } = locateHeaderRow(sheetRows);

  const parsedEmployees: Partial<Employee>[] = [];

  for (let i = headerRowIndex + 1; i < sheetRows.length; i++) {
    const values = sheetRows[i];
    if (!values || values.length === 0 || values.every((v) => v === undefined || v === null || String(v).trim() === "")) continue;

    // Helper to extract value by header name safely
    const getVal = (header: string) => {
      const idx = idxMap[header];
      if (idx !== undefined && idx >= 0 && idx < values.length) {
        const val = values[idx];
        return val !== undefined && val !== null ? String(val).trim() : "";
      }
      return "";
    };

    const dailyWageVal = parseFloat(getVal("Daily Wage")) || 0;
    const workingDaysCycle = getVal("Working Days Cycle") || "26 Days (Sun Off)";
    
    // Auto-calculate gross if not given and daily wage is provided
    let grossVal = parseFloat(getVal("Gross Salary***")) || 0;
    if (grossVal === 0 && dailyWageVal > 0) {
      const daysMatch = workingDaysCycle.match(/(\d+)\s*Days?/i);
      const daysCount = daysMatch ? parseInt(daysMatch[1]) : 26;
      grossVal = Math.round(dailyWageVal * daysCount);
    }
    
    // Auto-calculate daily wage if gross is given and daily wage is not provided
    let finalDailyWage = dailyWageVal;
    if (finalDailyWage === 0 && grossVal > 0) {
      const daysMatch = workingDaysCycle.match(/(\d+)\s*Days?/i);
      const daysCount = daysMatch ? parseInt(daysMatch[1]) : 26;
      finalDailyWage = parseFloat((grossVal / daysCount).toFixed(2));
    }

    const basicVal = parseFloat(getVal("Basic Salary***")) || 0;

    const rawCode = getVal("Employees Code **").trim();
    const generatedCode = rawCode || `EMP-${100 + i}-${Math.floor(1000 + Math.random() * 9000)}`;

    const emp: Partial<Employee> = {
      srNo: parseInt(getVal("SR NO")) || i - headerRowIndex,
      employeeCode: generatedCode,
      location: getVal("Location"),
      nameAsPerAadhar: getVal("EMPLOYEE NAME AS PER AADHAR ***"),
      grossSalary: grossVal,
      basicSalary: basicVal || Math.round(grossVal * 0.5), // Fallback to 50% of gross
      esic: getVal("ESIC") || (grossVal <= 21000 && grossVal > 0 ? "Yes" : "No"),
      workingDaysType: workingDaysCycle,
      uan: getVal("UAN"),
      aadharNo: getVal("AADHAR NO **"),
      nameAsPerAadharColumn: getVal("NAME AS PER AADHAR **"),
      panNo: getVal("PAN NO"),
      nameAsPerPan: getVal("NAME AS PER PAN"),
      bankAccountNo: getVal("BANK ACCOUNT NO **"),
      ifscCode: getVal("IFSC CODE **"),
      nameAsPerBank: getVal("EMPLOYEE NAME AS PER BANK **"),
      fatherName: getVal("FATHER **"),
      husbandName: getVal("HUSBAND NAME **"),
      pfJoiningDate: getVal("PF JOINING DATE"),
      dateOfBirth: getVal("DATE OF BIRTH"),
      gender: getVal("GENDER **"),
      maritalStatus: getVal("MARITAL STATUS **"),
      aadharLinkMobNo: getVal("AADHAR LINK MOB.NO. **"),
      previousUanNo: getVal("PREVIOUS UAN NO"),
      previousEsicNo: getVal("PREVIOUS ESIC NO***"),
      presentAddress: getVal("Present Address**"),
      permanentAddress: getVal("Permanent Address**"),
      nomineeName: getVal("Nominee Name (ESIC)"),
      nomineeDob: getVal("Nominee DOB"),
      nomineeRelation: getVal("Nominee Relation"),
      familyMember1Name: getVal("Family Member Name (1)"),
      familyMember1Dob: getVal("Family Member DOB (1)"),
      familyMember1Relation: getVal("Family Member Relation (1)"),
      familyMember2Name: getVal("Family Member Name (2)"),
      familyMember2Dob: getVal("Family Member DOB (2)"),
      familyMember2Relation: getVal("Family Member Relation (2)"),
      familyMember3Name: getVal("Family Member Name (3)"),
      familyMember3Dob: getVal("Family Member DOB (3)"),
      familyMember3Relation: getVal("Family Member Relation (3)"),
      skillCategory: normalizeSkillCategory(getVal("Skill Category")) || undefined,
      role: getVal("Job Role") || undefined,
      dailyWage: finalDailyWage || undefined,
      employeeMobile: getVal("Employee Mobile") || undefined,
      nomineeMobile: getVal("Nominee Mobile") || undefined,
      familyMember1Mobile: getVal("Family Member Mobile (1)") || undefined,
      familyMember2Mobile: getVal("Family Member Mobile (2)") || undefined,
      familyMember3Mobile: getVal("Family Member Mobile (3)") || undefined,
    };

    parsedEmployees.push(emp);
  }

  return parsedEmployees;
}

// Analyzes standard list of columns against the matched header row
export function analyzeHeaders(rows: any[][]): { matched: string[]; unmatched: string[]; headerRowIndex: number; actualHeaderNames: string[] } {
  if (rows.length === 0) {
    return { matched: [], unmatched: EXCEL_ROW_HEADERS, headerRowIndex: -1, actualHeaderNames: [] };
  }
  const { headerRowIndex, idxMap } = locateHeaderRow(rows);
  const matched: string[] = [];
  const unmatched: string[] = [];
  
  EXCEL_ROW_HEADERS.forEach((header) => {
    if (idxMap[header] !== undefined && idxMap[header] !== -1) {
      matched.push(header);
    } else {
      unmatched.push(header);
    }
  });

  const rawHeaderRow = rows[headerRowIndex] || [];
  const actualHeaderNames = rawHeaderRow.map(cell => cell !== undefined && cell !== null ? String(cell).trim() : "").filter(s => s !== "");

  return { matched, unmatched, headerRowIndex, actualHeaderNames };
}

/** Axis Bank Bulk Pay upload columns (Excel 97–2003 / .xls). */
export const AXIS_BULKPAY_HEADERS = [
  "Payment Method Name",
  "Payment Amount (Request)",
  "Activation Date",
  "Beneficiary Name (Request)",
  "Account No",
  "Email",
  "Email Body",
  "Debit Account No",
  "CRN No",
  "RECEIVER IFSC Code",
  "RECEIVER Account Type",
  "Remarks",
  "Phone No",
] as const;

export interface AxisBulkPayRowInput {
  paymentAmount: number;
  beneficiaryName: string;
  accountNo: string;
  ifscCode: string;
  phoneNo?: string;
  remarks?: string;
}

export interface AxisBulkPayOptions {
  debitAccountNo: string;
  paymentMethod?: string;
  receiverAccountType?: string;
  activationDate?: Date;
}

const AXIS_DEBIT_ACCOUNT_KEY = "hrms_axis_debit_account";

export function getAxisDebitAccountNo(): string | null {
  const saved = localStorage.getItem(AXIS_DEBIT_ACCOUNT_KEY);
  if (saved?.trim()) return saved.trim();

  const entered = window.prompt(
    "Enter your Axis Bank Debit Account Number for bulk pay export:"
  );
  if (!entered?.trim()) return null;

  const value = entered.trim();
  localStorage.setItem(AXIS_DEBIT_ACCOUNT_KEY, value);
  return value;
}

function formatAxisActivationDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function formatAxisCrn(date: Date, index: number): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const serial = String(index + 1).padStart(2, "0");
  return `${dd}${mm}${yyyy}${serial}`;
}

function formatAxisPaymentAmount(amount: number): string {
  return Math.max(0, amount).toFixed(2);
}

/** Prefix leading-zero account numbers with apostrophe for Axis upload. */
export function formatAxisBankAccountNo(accountNo: string): string {
  const trimmed = (accountNo || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("0") && !trimmed.startsWith("'")) return `'${trimmed}`;
  return trimmed;
}

export function buildAxisBulkPayXlsBuffer(
  items: AxisBulkPayRowInput[],
  options: AxisBulkPayOptions,
): { buffer: Uint8Array; exported: number; totalAmount: number } {
  const today = options.activationDate || new Date();
  const paymentMethod = options.paymentMethod || "N";
  const accountType = options.receiverAccountType || "10";
  const rows: (string | number)[][] = [[...AXIS_BULKPAY_HEADERS]];

  let exported = 0;
  let totalAmount = 0;
  items.forEach((item, index) => {
    if (!item.accountNo?.trim() || !item.beneficiaryName?.trim() || item.paymentAmount <= 0) {
      return;
    }
    totalAmount += item.paymentAmount;
    rows.push([
      paymentMethod,
      formatAxisPaymentAmount(item.paymentAmount),
      formatAxisActivationDate(today),
      item.beneficiaryName.trim(),
      formatAxisBankAccountNo(item.accountNo),
      "",
      "",
      options.debitAccountNo,
      formatAxisCrn(today, index),
      (item.ifscCode || "").trim().toUpperCase(),
      accountType,
      item.remarks || "",
      (item.phoneNo || "").trim(),
    ]);
    exported++;
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BulkPay");
  const buffer = XLSX.write(wb, { bookType: "biff8", type: "array" }) as Uint8Array;
  return { buffer, exported, totalAmount };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** axis_bulkpay_{Month}_{Year}_{YYYY-MM-DD}.xls — matches Axis bank export naming. */
export function buildAxisBulkPayFilename(
  monthKey: string,
  exportDate: Date = new Date(),
): string {
  const slug = monthKey.trim().replace(/\s+/g, "_");
  const dateStr = exportDate.toISOString().split("T")[0];
  return `axis_bulkpay_${slug}_${dateStr}.xls`;
}

export function parseMonthYear(monthKey: string): { month: string; year: string } {
  const parts = monthKey.trim().split(/\s+/);
  if (parts.length >= 2) {
    return {
      month: parts.slice(0, -1).join(" "),
      year: parts[parts.length - 1],
    };
  }
  return { month: monthKey, year: String(new Date().getFullYear()) };
}

export interface SavedBulkPayRecord {
  id: string;
  createdAt: string;
  username: string;
  month: string;
  year: string;
  filename: string;
  recordCount: number;
  totalAmount: number;
  employeeIds: string[];
}

export async function saveAxisBulkPayArchive(
  payload: {
    filename: string;
    month: string;
    year: string;
    recordCount: number;
    totalAmount: number;
    employeeIds: string[];
    fileBase64: string;
  },
): Promise<SavedBulkPayRecord> {
  const res = await fetch("/api/bulk-pay-exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 502 || res.status === 503) {
      throw new Error(
        "Backend API is not running. Start the NestJS server in the backend folder (npm run start) and try again."
      );
    }
    if (res.status === 404) {
      throw new Error(
        "Bulk pay archive API not found. Rebuild and restart the backend (npm run build && npm run start in backend/)."
      );
    }
    const validationMsg = Array.isArray(err.message) ? err.message.join(", ") : err.message;
    throw new Error(validationMsg || err.error || "Failed to archive bulk pay file on server.");
  }
  const data = await res.json();
  return data.record as SavedBulkPayRecord;
}

export function downloadAxisBulkPayXls(
  items: AxisBulkPayRowInput[],
  options: AxisBulkPayOptions,
  filename: string
): { exported: number; totalAmount: number; fileBase64: string } {
  const { buffer, exported, totalAmount } = buildAxisBulkPayXlsBuffer(items, options);
  if (exported === 0) {
    return { exported: 0, totalAmount: 0, fileBase64: "" };
  }

  const blob = new Blob([buffer], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { exported, totalAmount, fileBase64: uint8ToBase64(buffer) };
}
