import type ExcelJS from "exceljs";
import { Employee } from "../types";
import { getMonthLedger } from "./ledger-helpers";
import { getSalaryColumnValue } from "./salary-columns";
import {
  calculateProfessionalTax,
  EMPLOYEE_PF_RATE,
  EMPLOYER_PF_RATE,
  isEmployeeEsicCovered,
  isPfEsicCompliant,
  isProfessionalTaxApplicable,
  PF_STATUTORY_CEILING,
  resolveFullMonthSalary,
} from "../utils";
import { getMonthlySalaryProrationDays } from "./salary-calc";

export const PF_SALARY_HEADER_ROW = [
  "Sr No.",
  "Employees Name",
  "Gender",
  "UAN",
  "ESIC No",
  "GROSS",
  "Total No. of days",
  "NO OF DAYS PRESENT",
  "Basic + DA",
  "HRA",
  "CCA",
  "Total",
  "Basic + DA",
  "HRA",
  "CCA",
  "INCENTIVES",
  "Total",
  "PF Wages",
  "ESIC Wages",
  "PF",
  "PT",
  "ESIC",
  "Advance",
  "Loan",
  "MLWF",
  "TDS",
  "Total Dedu",
  "Net Salary",
  "",
  "PF ER",
  "ESIC ER",
] as const;

/** Column widths copied from PF SAL FORMAT.xlsx (Excel units). */
const PF_SALARY_COLUMN_WIDTHS = [
  6.57, 31.71, 9.71, 6.57, 9.86, 9, 9.14, 11.29, 13, 6.71, 6.71, 8.43, 9, 6.71, 6.71,
  9.14, 8.43, 9.14, 9.14, 6.71, 6.71, 8.43, 8.43, 6.71, 6.71, 6.71, 9.14, 9.14, 3.57, 6.71, 8.43,
];

/** Column indices (0-based) that receive numeric totals in the footer row. */
const PF_SALARY_SUM_COLUMN_INDICES = [
  5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30,
];

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: "FFFF0000" },
  name: "Calibri",
};

export interface PfSalaryExportContext {
  month: string;
  esicEligibilityLimit: number;
  attendanceDb?: Record<string, Record<string, Record<number, string>>>;
  locationCompliance: Record<string, boolean>;
  locationPtEnabled: Record<string, boolean>;
}

export function formatPfSalMonthLabel(monthKey: string): string {
  const parts = monthKey.trim().split(/\s+/);
  if (parts.length >= 2) {
    const monthName = parts.slice(0, -1).join(" ").toUpperCase();
    const year = parts[parts.length - 1];
    const shortYear = year.length >= 2 ? year.slice(-2) : year;
    return `Month of ${monthName}-${shortYear}`;
  }
  return `Month of ${monthKey.toUpperCase()}`;
}

export function sanitizePfSalarySheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, " ").trim() || "All Locations";
  return cleaned.slice(0, 31);
}

/** UAN from the employee master (Employees tab → EPF Universal Account No). */
export function resolveEmployeeUanForExport(emp: Employee): string {
  return String(emp.uan || "").trim();
}

/** ESIC insurance number from the employee master (Employees tab → Previous ESIC No). */
export function resolveEmployeeEsicNoForExport(emp: Employee): string {
  return String(emp.previousEsicNo || "").trim();
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculatePfSalStatutoryAmounts(fullGross: number, isCompliant: boolean) {
  if (!isCompliant) {
    return { pfWage: 0, employeePf: 0, employerPf: 0 };
  }
  const pfWage = Math.min(Math.round(fullGross), PF_STATUTORY_CEILING);
  return {
    pfWage,
    employeePf: Math.round(pfWage * EMPLOYEE_PF_RATE),
    employerPf: Math.round(pfWage * EMPLOYER_PF_RATE),
  };
}

function applyThinBorder(cell: ExcelJS.Cell): void {
  cell.border = THIN_BORDER;
}

function applyPfSalaryColumnWidths(ws: ExcelJS.Worksheet): void {
  PF_SALARY_COLUMN_WIDTHS.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });
}

export function buildPfSalaryEmployeeRow(
  emp: Employee,
  srNo: number,
  ctx: PfSalaryExportContext,
): (string | number)[] {
  const { month, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled } = ctx;

  const fullGross = resolveFullMonthSalary(emp, month);
  const proratedGross = Number(
    getSalaryColumnValue(
      emp,
      "Gross Salary (Monthly)",
      month,
      esicEligibilityLimit,
      attendanceDb,
      locationCompliance,
      locationPtEnabled,
    ),
  ) || 0;
  const presentDays = Number(
    getSalaryColumnValue(
      emp,
      "Present Days",
      month,
      esicEligibilityLimit,
      attendanceDb,
      locationCompliance,
      locationPtEnabled,
    ),
  ) || 0;
  const totalDays = getMonthlySalaryProrationDays(emp.workingDaysType, month);

  const isCompliant = isPfEsicCompliant(emp, locationCompliance);
  const isPtEnabled = isProfessionalTaxApplicable(emp, locationPtEnabled);
  const isEsicCovered = isEmployeeEsicCovered(
    proratedGross,
    esicEligibilityLimit,
    isCompliant,
    emp.esic,
  );

  const { pfWage, employeePf, employerPf } = calculatePfSalStatutoryAmounts(
    fullGross,
    isCompliant,
  );
  const employeeEsic = isEsicCovered ? roundMoney(proratedGross * 0.0075) : 0;
  const employerEsic = isEsicCovered ? roundMoney(proratedGross * 0.0325) : 0;
  const pt = isPtEnabled
    ? Number(
        calculateProfessionalTax(proratedGross, {
          isPtEnabled: true,
          gender: emp.gender,
          month,
        }),
      ) || 0
    : 0;

  const ledger = getMonthLedger(emp, month);
  const advance = Number(ledger.advance) || 0;
  const loan = (Number(ledger.penalty) || 0) + (Number(ledger.uniform) || 0);

  const earningTotal = roundMoney(proratedGross);
  const totalDeductions = roundMoney(employeePf + pt + employeeEsic + advance + loan);
  const netSalary = roundMoney(earningTotal - totalDeductions);

  return [
    srNo,
    emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "",
    emp.gender || "",
    resolveEmployeeUanForExport(emp),
    resolveEmployeeEsicNoForExport(emp),
    roundMoney(fullGross),
    totalDays,
    presentDays,
    roundMoney(fullGross),
    0,
    0,
    roundMoney(fullGross),
    roundMoney(proratedGross),
    0,
    0,
    0,
    earningTotal,
    isCompliant ? Math.round(pfWage) : 0,
    isEsicCovered ? roundMoney(proratedGross) : 0,
    isCompliant ? Math.round(employeePf) : 0,
    pt,
    employeeEsic,
    advance,
    loan,
    0,
    0,
    totalDeductions,
    netSalary,
    "",
    isCompliant ? Math.round(employerPf) : 0,
    employerEsic,
  ];
}

function buildPfSalaryTotalsRow(rows: (string | number)[][]): (string | number)[] {
  const totals: (string | number)[] = Array.from({ length: PF_SALARY_HEADER_ROW.length }, () => "");
  for (const colIdx of PF_SALARY_SUM_COLUMN_INDICES) {
    let sum = 0;
    for (const row of rows) {
      const value = row[colIdx];
      if (typeof value === "number" && Number.isFinite(value)) {
        sum += value;
      }
    }
    totals[colIdx] = roundMoney(sum);
  }
  return totals;
}

function stylePfSalarySectionHeader(
  ws: ExcelJS.Worksheet,
  range: string,
  label: string,
): void {
  ws.mergeCells(range);
  const cell = ws.getCell(range.split(":")[0]);
  cell.value = label;
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFC000" },
  };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.font = { bold: true, size: 14, name: "Calibri" };
  applyThinBorder(cell);
}

function applyPfSalarySheetLayout(
  ws: ExcelJS.Worksheet,
  ctx: PfSalaryExportContext,
  siteName: string,
): void {
  const monthLabel = formatPfSalMonthLabel(ctx.month);

  ws.mergeCells("I1:K1");
  ws.getCell("A1").value = siteName;
  ws.getCell("I1").value = monthLabel;
  ws.getCell("A2").value = "Salary calculation for the month of";

  ws.getCell("G3").value = "As per monthly days (Sunday)";
  stylePfSalarySectionHeader(ws, "I3:L3", "Rate");
  stylePfSalarySectionHeader(ws, "M3:Q3", "Earning");
  stylePfSalarySectionHeader(ws, "T3:Z3", "Deduction");

  const headerRow = ws.getRow(4);
  headerRow.values = [...PF_SALARY_HEADER_ROW];
  headerRow.height = 56.25;
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber > PF_SALARY_HEADER_ROW.length) return;
    cell.font = { bold: true, name: "Calibri", size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    if (colNumber <= 28 || colNumber >= 30) {
      applyThinBorder(cell);
    }
  });

  ws.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFF00" },
  };
  ws.getCell("A1").font = TITLE_FONT;

  ws.getCell("A2").font = TITLE_FONT;

  ws.getCell("I1").font = { bold: true, size: 14, name: "Calibri" };
  ws.getCell("I1").alignment = { horizontal: "center", vertical: "middle" };

  ws.getCell("G3").font = { size: 14, name: "Calibri" };

  applyPfSalaryColumnWidths(ws);
}

function stylePfSalaryDataRow(ws: ExcelJS.Worksheet, rowIndex: number): void {
  const row = ws.getRow(rowIndex);
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber > PF_SALARY_HEADER_ROW.length) return;
    if (colNumber <= 28 || colNumber >= 30) {
      applyThinBorder(cell);
    }
    cell.font = { name: "Calibri", size: 11 };
    if (colNumber >= 6) {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
    if (typeof cell.value === "number") {
      cell.numFmt = colNumber === 22 ? "0.00" : "0";
    }
  });
}

export function addPfSalaryDataToWorksheet(
  ws: ExcelJS.Worksheet,
  employees: Employee[],
  ctx: PfSalaryExportContext,
  startRow = 5,
): number {
  const dataRows: (string | number)[][] = employees.map((emp, index) =>
    buildPfSalaryEmployeeRow(emp, index + 1, ctx),
  );

  dataRows.forEach((row, index) => {
    const rowIndex = startRow + index;
    ws.getRow(rowIndex).values = [...row];
    stylePfSalaryDataRow(ws, rowIndex);
  });

  const totalsRow = buildPfSalaryTotalsRow(dataRows);
  const totalsRowIndex = startRow + dataRows.length;
  ws.getRow(totalsRowIndex).values = [...totalsRow];
  stylePfSalaryDataRow(ws, totalsRowIndex);
  ws.getRow(totalsRowIndex).font = { bold: true, name: "Calibri", size: 11 };

  return totalsRowIndex;
}

export async function buildPfSalaryWorkbookBuffer(
  ExcelJS: typeof import("exceljs").default,
  employees: Employee[],
  ctx: PfSalaryExportContext,
): Promise<{ buffer: ArrayBuffer; recordCount: number; sheetCount: number }> {
  const workbook = new ExcelJS.Workbook();
  const grouped = new Map<string, Employee[]>();

  employees.forEach((emp) => {
    const location = emp.location?.trim() || "All Locations";
    const list = grouped.get(location) ?? [];
    list.push(emp);
    grouped.set(location, list);
  });

  if (grouped.size === 0) {
    grouped.set("All Locations", []);
  }

  let recordCount = 0;
  for (const [location, locationEmployees] of grouped) {
    const ws = workbook.addWorksheet(sanitizePfSalarySheetName(location));
    applyPfSalarySheetLayout(ws, ctx, location);
    addPfSalaryDataToWorksheet(ws, locationEmployees, ctx);
    recordCount += locationEmployees.length;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, recordCount, sheetCount: grouped.size };
}

export function buildPfSalaryFilename(monthKey: string): string {
  const slug = monthKey.trim().replace(/\s+/g, "_");
  return `pf_salary_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`;
}
