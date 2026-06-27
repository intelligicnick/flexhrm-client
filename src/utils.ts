/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { Employee, EXCEL_ROW_HEADERS } from "./types";
import { getDaysInMonthStatic } from "./lib/date-helpers";
import { countWorkingDaysInMonth } from "./lib/attendance-helpers";
import {
  getWorkingDaysCount,
  inferSalaryWageMode,
  type SalaryWageMode,
} from "./lib/salary-calc";
import { validateNonNegativeNumberField } from "./lib/number-validation";

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

function normalizeHeaderCell(cell: unknown): string {
  if (cell === undefined || cell === null) return "";
  return String(cell).trim();
}

function normalizeHeaderKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/employees/g, "employee");
}

// Helper to find the index of a header in a tiered, normalized manner
export function findHeaderIndex(headerRow: string[], targetHeader: string): number {
  const normTarget = normalizeHeaderKey(targetHeader);
  if (!normTarget) return -1;
  const targetTrimmed = targetHeader.toLowerCase().trim();

  // Tier 1: Exact lowercase trim match
  let idx = headerRow.findIndex((h) => {
    const cell = normalizeHeaderCell(h);
    return cell !== "" && cell.toLowerCase() === targetTrimmed;
  });
  if (idx !== -1) return idx;

  // Tier 2: Exact normalized alphanumeric match
  idx = headerRow.findIndex((h) => {
    const normH = normalizeHeaderKey(normalizeHeaderCell(h));
    return normH !== "" && normH === normTarget;
  });
  if (idx !== -1) return idx;

  // Tier 3: Loose match via explicit aliases dictionary
  const targetAliases = HEADER_ALIASES[normTarget] || [normTarget];
  idx = headerRow.findIndex((h) => {
    const normH = normalizeHeaderKey(normalizeHeaderCell(h));
    if (!normH) return false;
    return targetAliases.includes(normH) || targetAliases.some(alias => alias !== "" && (normH.includes(alias) || alias.includes(normH)));
  });
  if (idx !== -1) return idx;

  // Tier 4: Loose checks with sub-replacement
  const looseTarget = normTarget.replace(/number/g, "no").replace(/no/g, "");
  idx = headerRow.findIndex((h) => {
    const normH = normalizeHeaderKey(normalizeHeaderCell(h));
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
        const val = values[idx];
        return val !== undefined && val !== null ? String(val).trim() : "";
      }
      return "";
    };

    parsedEmployees.push(buildImportedEmployeeFromRow(getVal, i, headerRowIndex));
  }

  return parsedEmployees;
}
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
  "PF/ESIC Compliance **": "complianceEnabled",
  "Professional Tax (PT) **": "ptEnabled",
  "PF Calculation Mode": "pfCalculationMode",
  "Salary Wage Mode": "salaryWageMode",
  "EXIT/LEAVING DATE": "exitDate",
  "REASON FOR EXIT": "exitReason",
  "Advance": "advance",
  "Penalty": "penalty",
  "Uniform": "uniform",
  "Food Perk": "foodPerk",
  "Accommodation Perk": "accommodationPerk",
  "Conveyance Perk": "conveyancePerk",
};

function parseImportYesNo(val: string): boolean | undefined {
  const normalized = val.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "yes" || normalized === "true" || normalized === "1") return true;
  if (normalized === "no" || normalized === "false" || normalized === "0") return false;
  return undefined;
}

function parseImportPfCalculationMode(val: string): Employee["pfCalculationMode"] | undefined {
  const normalized = val.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "gross" || normalized.includes("full")) return "gross";
  if (normalized === "ceiling_15000" || normalized.includes("15000") || normalized.includes("ceiling")) {
    return "ceiling_15000";
  }
  return undefined;
}

function parseImportSalaryWageMode(val: string): Employee["salaryWageMode"] | undefined {
  const normalized = val.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "daily" || normalized.includes("daily")) return "daily";
  if (normalized === "monthly" || normalized.includes("monthly")) return "monthly";
  return undefined;
}

function buildImportedEmployeeFromRow(
  getVal: (header: string) => string,
  rowIndex: number,
  headerRowIndex: number,
): Partial<Employee> {
  const dailyWageVal = parseFloat(getVal("Daily Wage")) || 0;
  const workingDaysCycle = getVal("Working Days Cycle") || "26 Days (Sun Off)";

  let grossVal = parseFloat(getVal("Gross Salary***")) || 0;
  if (grossVal === 0 && dailyWageVal > 0) {
    const daysMatch = workingDaysCycle.match(/(\d+)\s*Days?/i);
    const daysCount = daysMatch ? parseInt(daysMatch[1], 10) : 26;
    grossVal = Math.round(dailyWageVal * daysCount);
  }

  let finalDailyWage = dailyWageVal;
  if (finalDailyWage === 0 && grossVal > 0) {
    const daysMatch = workingDaysCycle.match(/(\d+)\s*Days?/i);
    const daysCount = daysMatch ? parseInt(daysMatch[1], 10) : 26;
    finalDailyWage = parseFloat((grossVal / daysCount).toFixed(2));
  }

  const basicVal = parseFloat(getVal("Basic Salary***")) || 0;
  const rawCode = getVal("Employees Code **").trim();
  const generatedCode = rawCode || `EMP-${100 + rowIndex}-${Math.floor(1000 + Math.random() * 9000)}`;
  const complianceEnabled = parseImportYesNo(getVal("PF/ESIC Compliance **"));
  const ptEnabled = parseImportYesNo(getVal("Professional Tax (PT) **"));
  const pfCalculationMode = parseImportPfCalculationMode(getVal("PF Calculation Mode"));
  const salaryWageMode = parseImportSalaryWageMode(getVal("Salary Wage Mode"));
  const exitDate = getVal("EXIT/LEAVING DATE");
  const exitReason = getVal("REASON FOR EXIT");
  const advance = parseFloat(getVal("Advance")) || 0;
  const penalty = parseFloat(getVal("Penalty")) || 0;
  const uniform = parseFloat(getVal("Uniform")) || 0;
  const foodPerk = parseFloat(getVal("Food Perk")) || 0;
  const accommodationPerk = parseFloat(getVal("Accommodation Perk")) || 0;
  const conveyancePerk = parseFloat(getVal("Conveyance Perk")) || 0;

  return {
    srNo: parseInt(getVal("SR NO"), 10) || rowIndex - headerRowIndex,
    employeeCode: generatedCode,
    location: getVal("Location"),
    nameAsPerAadhar: getVal("EMPLOYEE NAME AS PER AADHAR ***"),
    grossSalary: grossVal,
    basicSalary: basicVal || Math.round(grossVal * 0.5),
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
    complianceEnabled,
    ptEnabled,
    pfCalculationMode,
    salaryWageMode,
    exitDate: exitDate || undefined,
    exitReason: exitReason || undefined,
    advance: advance || undefined,
    penalty: penalty || undefined,
    uniform: uniform || undefined,
    foodPerk: foodPerk || undefined,
    accommodationPerk: accommodationPerk || undefined,
    conveyancePerk: conveyancePerk || undefined,
  };
}

export function getEmployeeHeaderValue(emp: Employee, header: string, index: number): string | number {
  if (header === "SR NO") return index + 1;
  const key = EMPLOYEE_HEADER_KEY_MAP[header];
  if (!key) return "";
  if (key === "complianceEnabled") {
    return emp.complianceEnabled === false ? "No" : "Yes";
  }
  if (key === "ptEnabled") {
    if (emp.ptEnabled !== undefined) return emp.ptEnabled === false ? "No" : "Yes";
    return emp.complianceEnabled === false ? "No" : "Yes";
  }
  const val = emp[key];
  if (val === undefined || val === null || val === "") {
    if (key === "workingDaysType") return "26 Days (Sun Off)";
    if (key === "pfCalculationMode") return "ceiling_15000";
    if (key === "salaryWageMode") return "monthly";
    return "";
  }
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return val as string | number;
}

/** True when employee skill matches any selected filter label (normalized). */
export function employeeMatchesSkillFilters(emp: Employee, filters: string[]): boolean {
  if (!filters.length) return true;
  const empSkill = normalizeSkillCategory(emp.skillCategory).toLowerCase();
  return filters.some((f) => empSkill === f.toLowerCase());
}

/**
 * Prorate monthly salary by present days using the employee's working-days cycle
 * (e.g. 26 / 22 / 30), not calendar days in the month.
 * Example: ₹10,000 gross, 26-day cycle, 10 presents → (10000 / 26) * 10.
 */
export function prorateSalaryByAttendance(
  rawAmount: number,
  workingDaysInCycle: number,
  presents: number,
  empMonthAttendance: Record<string | number, string>
): number {
  if (workingDaysInCycle <= 0) return rawAmount;
  if (presents <= 0) return 0;
  const hasRecordedAttendance = Object.values(empMonthAttendance).some(
    (v) => v !== undefined && v !== null && String(v).trim() !== ""
  );
  if (!hasRecordedAttendance) return rawAmount;
  return Math.round((rawAmount / workingDaysInCycle) * presents);
}

export function resolveEmployeeDailyWage(
  emp: Pick<Employee, "dailyWage" | "grossSalary" | "workingDaysType">,
): number {
  const stored = Number(emp.dailyWage);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const gross = Number(emp.grossSalary);
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  const days = getWorkingDaysCount(emp.workingDaysType);
  return days > 0 ? parseFloat((gross / days).toFixed(2)) : 0;
}

export function resolveSalaryWageMode(
  emp: Pick<Employee, "salaryWageMode" | "grossSalary" | "dailyWage" | "workingDaysType"> &
    Partial<Pick<Employee, "basicSalary">>,
): SalaryWageMode {
  return inferSalaryWageMode(emp);
}

function hasRecordedAttendance(empMonthAttendance: Record<string | number, string>): boolean {
  return Object.values(empMonthAttendance).some(
    (v) => v !== undefined && v !== null && String(v).trim() !== "",
  );
}

/**
 * Prorate gross and basic by attendance using the employee's wage mode.
 * Monthly: (monthly amount / calendar days in month) * present days.
 * Daily: present days * daily wage (basic keeps the gross/basic ratio).
 */
export function computeProratedGrossAndBasic(
  emp: Pick<Employee, "grossSalary" | "basicSalary" | "dailyWage" | "workingDaysType" | "salaryWageMode">,
  presents: number,
  empMonthAttendance: Record<string | number, string>,
  month: string,
): { gross: number; basic: number } {
  const rawGross = Number(emp.grossSalary) || 0;
  const rawBasic = Number(emp.basicSalary) || 0;

  if (presents <= 0) {
    return hasRecordedAttendance(empMonthAttendance) ? { gross: 0, basic: 0 } : { gross: rawGross, basic: rawBasic };
  }

  if (!hasRecordedAttendance(empMonthAttendance)) {
    return { gross: rawGross, basic: rawBasic };
  }

  const wageMode = resolveSalaryWageMode(emp);

  if (wageMode === "daily") {
    const dailyWage = resolveEmployeeDailyWage(emp);
    const gross = Math.round(dailyWage * presents);
    const basic =
      rawGross > 0 ? Math.round(gross * (rawBasic / rawGross)) : Math.round(gross * 0.5);
    return { gross, basic };
  }

  const calendarDays = getDaysInMonthStatic(month);
  if (calendarDays <= 0) {
    return { gross: rawGross, basic: rawBasic };
  }

  return {
    gross: Math.round((rawGross / calendarDays) * presents),
    basic: Math.round((rawBasic / calendarDays) * presents),
  };
}

/** Full-month salary before attendance proration. Daily: daily wage × working days in month; monthly: stored gross. */
export function resolveFullMonthSalary(
  emp: Pick<Employee, "grossSalary" | "dailyWage" | "workingDaysType" | "salaryWageMode"> &
    Partial<Pick<Employee, "basicSalary">>,
  month: string,
): number {
  if (resolveSalaryWageMode(emp) === "daily") {
    const dailyWage = resolveEmployeeDailyWage(emp);
    const workingDays = countWorkingDaysInMonth(emp.workingDaysType, month);
    return Math.round(dailyWage * workingDays);
  }
  return Number(emp.grossSalary) || 0;
}

/** ESIC applies only when compliant and the employee ESIC flag is explicitly Yes. */
export function isEmployeeEsicCovered(
  gross: number,
  _esicEligibilityLimit: number,
  isCompliant: boolean,
  esicFlag?: string
): boolean {
  if (!isCompliant) return false;
  return gross > 0 && (esicFlag || "").toLowerCase() === "yes";
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

/** @deprecated Legacy location PT amount storage; slab-based PT no longer uses per-location amounts. */
export const DEFAULT_LOCATION_PT_AMOUNT = 200;

export function readLocationPtAmountsFromStorage(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem("hrms_location_pt_amount");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/** @deprecated Slab-based PT no longer uses per-location fixed amounts. */
export function parseLocationPtInput(
  raw: string,
  fallback = DEFAULT_LOCATION_PT_AMOUNT
): number {
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

/** @deprecated Slab-based PT no longer uses per-location fixed amounts. */
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

export function isFebruaryPayrollMonth(month?: string): boolean {
  if (!month?.trim()) return false;
  return month.trim().toLowerCase().startsWith("february");
}

export function isFemaleGender(gender?: string): boolean {
  const normalized = (gender || "").trim().toLowerCase();
  return normalized === "female" || normalized === "f";
}

/** Gender-based professional tax slab amount for a monthly gross (before compliance gating). */
export function calculateProfessionalTaxSlabAmount(
  monthlyGross: number,
  gender?: string,
  month?: string
): number {
  const gross = Number(monthlyGross);
  if (!Number.isFinite(gross) || gross <= 0) return 0;

  const isFebruary = isFebruaryPayrollMonth(month);

  if (isFemaleGender(gender)) {
    if (gross <= 25000) return 0;
    return isFebruary ? 300 : 200;
  }

  if (gross <= 7500) return 0;
  if (gross <= 10000) return 175;
  return isFebruary ? 300 : 200;
}

/** Professional tax for the month when PT is enabled at employee and location level. */
export function calculateProfessionalTax(
  monthlyGross: number,
  options: {
    isPtEnabled?: boolean;
    gender?: string;
    month?: string;
  } = {}
): number {
  const { isPtEnabled = false, gender, month } = options;
  if (!isPtEnabled) return 0;
  return calculateProfessionalTaxSlabAmount(monthlyGross, gender, month);
}

export function isEmployeePtEnabled(employee: {
  complianceEnabled?: boolean;
  ptEnabled?: boolean;
}): boolean {
  if (employee.ptEnabled !== undefined) return employee.ptEnabled !== false;
  return employee.complianceEnabled !== false;
}

export function resolveLocationCompliance(
  location: string | undefined,
  locationComplianceMap: Record<string, boolean>
): boolean {
  if (!location?.trim()) return false;
  const locLower = location.trim().toLowerCase();
  const matchedKey = Object.keys(locationComplianceMap).find((k) => k.toLowerCase() === locLower);
  return matchedKey !== undefined ? !!locationComplianceMap[matchedKey] : false;
}

export function resolveLocationPtEnabled(
  location: string | undefined,
  locationPtMap: Record<string, boolean>
): boolean {
  if (!location?.trim()) return false;
  const locLower = location.trim().toLowerCase();
  const matchedKey = Object.keys(locationPtMap).find((k) => k.toLowerCase() === locLower);
  return matchedKey !== undefined ? !!locationPtMap[matchedKey] : false;
}

/** PF/ESIC applies when enabled on the employee record or at the office location. */
export function isPfEsicCompliant(
  employee: { location?: string; complianceEnabled?: boolean },
  locationComplianceMap: Record<string, boolean>
): boolean {
  const isLocCompliant = resolveLocationCompliance(employee.location, locationComplianceMap);
  const isEmpCompliant = employee.complianceEnabled !== false;
  return isLocCompliant || isEmpCompliant;
}

/** PT applies when enabled on the employee record or at the office location (state-specific). */
export function isProfessionalTaxApplicable(
  employee: { location?: string; complianceEnabled?: boolean; ptEnabled?: boolean },
  locationPtMap: Record<string, boolean>
): boolean {
  const isLocPt = resolveLocationPtEnabled(employee.location, locationPtMap);
  const isEmpPt = isEmployeePtEnabled(employee);
  return isLocPt || isEmpPt;
}

export const PROFESSIONAL_TAX_SLAB_SUMMARY = {
  male: [
    { range: "Up to ₹7,500 / month", amount: "Nil" },
    { range: "₹7,501 to ₹10,000 / month", amount: "₹175 / month" },
    { range: "Above ₹10,000 / month", amount: "₹200 / month (₹300 in February)" },
  ],
  female: [
    { range: "Up to ₹25,000 / month", amount: "Nil" },
    { range: "Above ₹25,000 / month", amount: "₹200 / month (₹300 in February)" },
  ],
} as const;

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

  const salaryFields = [
    { key: "grossSalary" as const, label: "Gross salary" },
    { key: "basicSalary" as const, label: "Basic salary" },
    { key: "dailyWage" as const, label: "Daily wage" },
    { key: "advance" as const, label: "Advance" },
    { key: "penalty" as const, label: "Penalty" },
    { key: "uniform" as const, label: "Uniform" },
    { key: "foodPerk" as const, label: "Food perk" },
    { key: "accommodationPerk" as const, label: "Accommodation perk" },
    { key: "conveyancePerk" as const, label: "Conveyance perk" },
  ];

  for (const { key, label } of salaryFields) {
    if (emp[key] !== undefined && emp[key] !== null && String(emp[key]) !== "") {
      const err = validateNonNegativeNumberField(emp[key], label);
      if (err) errors[key] = err;
    }
  }

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

    parsedEmployees.push(buildImportedEmployeeFromRow(getVal, i, headerRowIndex));
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

import { getDefaultBulkPayDebitAccountNo } from "./lib/bulk-pay-bank-accounts";

export function getAxisDebitAccountNo(): string | null {
  return getDefaultBulkPayDebitAccountNo();
}

function formatAxisActivationDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${mm}-${dd}-${yyyy}`;
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

export interface BulkPaySalarySheetInput {
  month: string;
  location: string;
  columns: string[];
  employeeRows: (string | number)[][];
}

export interface BulkPayPartnerSheetInput {
  month: string;
  district: string;
  block: string;
  partnerRows: (string | number)[][];
}

function writeXlsWorkbook(
  sheets: { name: string; rows: (string | number)[][] }[],
): Uint8Array {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  });
  const raw = XLSX.write(wb, { bookType: "biff8", type: "array" });
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
}

export function buildAxisBulkPayRows(
  items: AxisBulkPayRowInput[],
  options: AxisBulkPayOptions,
): { rows: (string | number)[][]; exported: number; totalAmount: number } {
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

  return { rows, exported, totalAmount };
}

export function buildSalaryCalculationsSheetRows(
  salarySheet: BulkPaySalarySheetInput,
): (string | number)[][] {
  const recordCount = salarySheet.employeeRows.length;
  return [
    [`Dynamic Custom Payroll Calculations Sheet — ${salarySheet.month}`],
    [`Worksite / Branch Location: ${salarySheet.location || "All Locations"}`],
    [
      `Generated on: ${new Date().toLocaleString()} | Filtered records: ${recordCount}`,
    ],
    [],
    [...salarySheet.columns],
    ...salarySheet.employeeRows,
  ];
}

export function buildPartnerPaymentsSheetRows(
  partnerSheet: BulkPayPartnerSheetInput,
  headers: readonly string[],
): (string | number)[][] {
  const recordCount = partnerSheet.partnerRows.length;
  const districtLabel = partnerSheet.district || "All Districts";
  const blockLabel = partnerSheet.block || "All Blocks";
  return [
    [`Monthly Partner Payments — ${partnerSheet.month}`],
    [`District: ${districtLabel} | Block: ${blockLabel}`],
    [
      `Generated on: ${new Date().toLocaleString()} | Filtered records: ${recordCount}`,
    ],
    [],
    [...headers],
    ...partnerSheet.partnerRows,
  ];
}

export function buildAxisBulkPayXlsBuffer(
  items: AxisBulkPayRowInput[],
  options: AxisBulkPayOptions,
): { buffer: Uint8Array; exported: number; totalAmount: number } {
  const { rows, exported, totalAmount } = buildAxisBulkPayRows(items, options);
  const buffer = writeXlsWorkbook([{ name: "BulkPay", rows }]);
  return { buffer, exported, totalAmount };
}

/** Axis bank upload sheet plus full salary calculation rows/columns for archive preview. */
export function buildBulkPayArchiveXlsBuffer(
  items: AxisBulkPayRowInput[],
  options: AxisBulkPayOptions,
  salarySheet: BulkPaySalarySheetInput,
): { buffer: Uint8Array; exported: number; totalAmount: number } {
  const { rows: bulkPayRows, exported, totalAmount } = buildAxisBulkPayRows(items, options);
  const salaryRows = buildSalaryCalculationsSheetRows(salarySheet);
  const buffer = writeXlsWorkbook([
    { name: "BulkPay", rows: bulkPayRows },
    { name: "Salary Calculations", rows: salaryRows },
  ]);
  return { buffer, exported, totalAmount };
}

/** Axis bank upload sheet plus full partner payment rows for school work archive preview. */
export function buildSchoolBulkPayArchiveXlsBuffer(
  items: AxisBulkPayRowInput[],
  options: AxisBulkPayOptions,
  partnerSheet: BulkPayPartnerSheetInput,
  partnerHeaders: readonly string[],
): { buffer: Uint8Array; exported: number; totalAmount: number } {
  const { rows: bulkPayRows, exported, totalAmount } = buildAxisBulkPayRows(items, options);
  const partnerRows = buildPartnerPaymentsSheetRows(partnerSheet, partnerHeaders);
  const buffer = writeXlsWorkbook([
    { name: "BulkPay", rows: bulkPayRows },
    { name: "Partner Payments", rows: partnerRows },
  ]);
  return { buffer, exported, totalAmount };
}

function uint8ToBase64(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  const chunkSize = 0x1000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j += 1) {
      binary += String.fromCharCode(chunk[j]);
    }
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

/** axis_bulkpay_school_{Month}_{YYYY-MM-DD}.xls */
export function buildSchoolAxisBulkPayFilename(
  monthKey: string,
  exportDate: Date = new Date(),
): string {
  const slug = monthKey.trim().replace(/\s+/g, "_");
  const dateStr = exportDate.toISOString().split("T")[0];
  return `axis_bulkpay_school_${slug}_${dateStr}.xls`;
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
  downloadCount?: number;
}

function xlsCellToDisplayString(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w != null && String(cell.w).trim() !== "") return String(cell.w);
  if (cell.v == null) return "";
  if (cell.t === "d" && cell.v instanceof Date) {
    const dd = String(cell.v.getDate()).padStart(2, "0");
    const mm = String(cell.v.getMonth() + 1).padStart(2, "0");
    const yyyy = cell.v.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  return String(cell.v);
}

function parseWorksheetRows(worksheet: XLSX.WorkSheet): string[][] {
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -1;
  let maxC = -1;

  for (const addr of Object.keys(worksheet)) {
    if (addr[0] === "!") continue;
    const { r, c } = XLSX.utils.decode_cell(addr);
    minR = Math.min(minR, r);
    minC = Math.min(minC, c);
    maxR = Math.max(maxR, r);
    maxC = Math.max(maxC, c);
  }

  if (maxR < 0) return [];

  const rows: string[][] = [];
  for (let r = minR; r <= maxR; r++) {
    const row: string[] = [];
    for (let c = minC; c <= maxC; c++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
      row.push(xlsCellToDisplayString(cell));
    }
    rows.push(row);
  }
  return rows;
}

export interface BulkPayXlsWorkbookPreview {
  sheetNames: string[];
  sheets: Record<string, string[][]>;
  defaultSheet: string;
}

export function parseBulkPayXlsWorkbook(buffer: ArrayBuffer): BulkPayXlsWorkbookPreview {
  const workbook = XLSX.read(new Uint8Array(buffer), {
    type: "array",
    cellDates: true,
    cellText: true,
  });
  const sheetNames = workbook.SheetNames.filter(Boolean);
  const sheets: Record<string, string[][]> = {};
  sheetNames.forEach((name) => {
    sheets[name] = parseWorksheetRows(workbook.Sheets[name]);
  });
  const defaultSheet =
    sheetNames.find((name) => name === "Salary Calculations") ||
    sheetNames.find((name) => name === "Partner Payments") ||
    sheetNames.find((name) => name === "BulkPay") ||
    sheetNames[0] ||
    "";
  return { sheetNames, sheets, defaultSheet };
}

/** Read every populated cell in the preferred sheet so preview shows the full row/column range. */
export function parseBulkPayXlsPreview(buffer: ArrayBuffer): string[][] {
  const { sheets, defaultSheet } = parseBulkPayXlsWorkbook(buffer);
  if (!defaultSheet) return [];
  return sheets[defaultSheet] || [];
}

export function getBulkPayPreviewHeaderRowCount(sheetName: string): number {
  if (sheetName === "Salary Calculations" || sheetName === "Partner Payments") return 5;
  return 1;
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
  if (!data?.record?.id) {
    throw new Error("Archive API succeeded but did not return a saved bulk pay record.");
  }
  return data.record as SavedBulkPayRecord;
}

export async function saveSchoolAxisBulkPayArchive(
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
  const res = await fetch("/api/school-bulk-pay-exports", {
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
        "School bulk pay archive API not found. Rebuild and restart the backend (npm run build && npm run start in backend/)."
      );
    }
    const validationMsg = Array.isArray(err.message) ? err.message.join(", ") : err.message;
    throw new Error(validationMsg || err.error || "Failed to archive school bulk pay file on server.");
  }
  const data = await res.json();
  if (!data?.record?.id) {
    throw new Error("Archive API succeeded but did not return a saved school bulk pay record.");
  }
  return data.record as SavedBulkPayRecord;
}

export function downloadAxisBulkPayXls(
  items: AxisBulkPayRowInput[],
  options: AxisBulkPayOptions,
  filename: string,
  salarySheet?: BulkPaySalarySheetInput,
): { exported: number; totalAmount: number; fileBase64: string } {
  const { rows, exported, totalAmount } = buildAxisBulkPayRows(items, options);
  if (exported === 0) {
    return { exported: 0, totalAmount: 0, fileBase64: "" };
  }

  const downloadBuffer = writeXlsWorkbook([{ name: "BulkPay", rows }]);
  const archiveBuffer = salarySheet
    ? buildBulkPayArchiveXlsBuffer(items, options, salarySheet).buffer
    : downloadBuffer;

  const blob = new Blob([downloadBuffer], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { exported, totalAmount, fileBase64: uint8ToBase64(archiveBuffer) };
}

export function downloadSchoolAxisBulkPayXls(
  items: AxisBulkPayRowInput[],
  options: AxisBulkPayOptions,
  filename: string,
  partnerSheet: BulkPayPartnerSheetInput,
  partnerHeaders: readonly string[],
): { exported: number; totalAmount: number; fileBase64: string } {
  const { rows, exported, totalAmount } = buildAxisBulkPayRows(items, options);
  if (exported === 0) {
    return { exported: 0, totalAmount: 0, fileBase64: "" };
  }

  const downloadBuffer = writeXlsWorkbook([{ name: "BulkPay", rows }]);
  const archiveBuffer = buildSchoolBulkPayArchiveXlsBuffer(
    items,
    options,
    partnerSheet,
    partnerHeaders,
  ).buffer;

  const blob = new Blob([downloadBuffer], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { exported, totalAmount, fileBase64: uint8ToBase64(archiveBuffer) };
}

import { resolveEmployeePhotoUrl } from "./lib/media-url";

export function getEmployeePhotoUrl(
  employeeId: string,
  photo?: string,
  photoUrl?: string,
): string | null {
  return resolveEmployeePhotoUrl(employeeId, photo, photoUrl);
}

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

