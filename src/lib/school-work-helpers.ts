import { SchoolWork, SCHOOL_EXCEL_ROW_HEADERS } from "../types";
import { findHeaderIndex } from "../utils";

export const SCHOOL_HEADER_ALIASES: Record<string, string[]> = {
  srno: ["srno", "sno", "slno", "serialno"],
  schoolname: ["schoolname", "school", "nameofschool"],
  udise: ["udise", "udisecode", "udiseno"],
  headmastername: ["headmastername", "headmaster", "hmname"],
  headmasternumber: ["headmasternumber", "headmastermobile", "headmasterphone", "hmnumber", "hmphone"],
  sweepername: ["sweepername", "sweeper"],
  accountholdername: ["accountholdername", "accountholder", "bankaccountholder"],
  accountnumber: ["accountnumber", "accountno", "bankaccountno", "bankaccount"],
  ifsccode: ["ifsccode", "ifsc"],
  nooftoilets: ["nooftoilets", "noof toiletes", "noof toilletes", "toilets", "toiletes"],
  rates: ["rates", "rate"],
  explanationforrate: ["explanationforrate", "explainationforrate", "rateexplanation", "explaination for rate"],
  block: ["block"],
  district: ["district"],
  materialcost: ["materialcost", "material"],
  remarks: ["remarks", "remark", "notes"],
};

function normalizeSchoolHeader(header: string | undefined | null): string {
  if (header === undefined || header === null) return "";
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findSchoolHeaderIndex(headerRow: string[], targetHeader: string): number {
  const direct = findHeaderIndex(headerRow, targetHeader);
  if (direct !== -1) return direct;

  const normTarget = normalizeSchoolHeader(targetHeader);
  const aliases = SCHOOL_HEADER_ALIASES[normTarget] || [normTarget];
  return headerRow.findIndex((h) => {
    const normH = normalizeSchoolHeader(h);
    if (!normH) return false;
    return aliases.includes(normH) || aliases.some((a) => normH.includes(a) || a.includes(normH));
  });
}

export function locateSchoolHeaderRow(rows: unknown[][]): {
  headerRowIndex: number;
  idxMap: Record<string, number>;
} {
  let highestMatchCount = -1;
  let bestRowIndex = 0;
  let bestIdxMap: Record<string, number> = {};
  const scanLimit = Math.min(rows.length, 15);

  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    const stringCells = row.map((cell) =>
      cell !== undefined && cell !== null ? String(cell).trim() : "",
    );
    if (stringCells.every((s) => s === "")) continue;

    const tempIdxMap: Record<string, number> = {};
    let matchCount = 0;
    SCHOOL_EXCEL_ROW_HEADERS.forEach((header) => {
      const idx = findSchoolHeaderIndex(stringCells, header);
      tempIdxMap[header] = idx;
      if (idx !== -1) matchCount++;
    });

    if (matchCount > highestMatchCount) {
      highestMatchCount = matchCount;
      bestRowIndex = r;
      bestIdxMap = tempIdxMap;
    }
  }

  if (highestMatchCount < 2) {
    const defaultIdxMap: Record<string, number> = {};
    const stringCells = (rows[0] || []).map((cell) =>
      cell !== undefined && cell !== null ? String(cell).trim() : "",
    );
    SCHOOL_EXCEL_ROW_HEADERS.forEach((header) => {
      defaultIdxMap[header] = findSchoolHeaderIndex(stringCells, header);
    });
    return { headerRowIndex: 0, idxMap: defaultIdxMap };
  }

  return { headerRowIndex: bestRowIndex, idxMap: bestIdxMap };
}

export function analyzeSchoolHeaders(rows: unknown[][]): {
  matched: string[];
  unmatched: string[];
  headerRowIndex: number;
  actualHeaderNames: string[];
} {
  if (rows.length === 0) {
    return {
      matched: [],
      unmatched: [...SCHOOL_EXCEL_ROW_HEADERS],
      headerRowIndex: -1,
      actualHeaderNames: [],
    };
  }
  const { headerRowIndex, idxMap } = locateSchoolHeaderRow(rows);
  const matched: string[] = [];
  const unmatched: string[] = [];
  SCHOOL_EXCEL_ROW_HEADERS.forEach((header) => {
    if (idxMap[header] !== undefined && idxMap[header] !== -1) matched.push(header);
    else unmatched.push(header);
  });
  const rawHeaderRow = rows[headerRowIndex] || [];
  const actualHeaderNames = rawHeaderRow
    .map((cell) => (cell !== undefined && cell !== null ? String(cell).trim() : ""))
    .filter((s) => s !== "");
  return { matched, unmatched, headerRowIndex, actualHeaderNames };
}

export function parseSchoolSheetRows(sheetRows: unknown[][]): Partial<SchoolWork>[] {
  if (sheetRows.length === 0) return [];
  const { headerRowIndex, idxMap } = locateSchoolHeaderRow(sheetRows);
  const parsed: Partial<SchoolWork>[] = [];

  for (let i = headerRowIndex + 1; i < sheetRows.length; i++) {
    const values = sheetRows[i];
    if (!values || values.length === 0 || values.every((v) => v === undefined || v === null || String(v).trim() === "")) {
      continue;
    }

    const getVal = (header: string) => {
      const idx = idxMap[header];
      if (idx !== undefined && idx >= 0 && idx < values.length) {
        const val = values[idx];
        return val !== undefined && val !== null ? String(val).trim() : "";
      }
      return "";
    };

    const udise = getVal("UDISE");
    const schoolName = getVal("School Name");
    if (!udise && !schoolName) continue;

    parsed.push({
      udise: udise || `SCH-IMPORT-${i}`,
      schoolName,
      headmasterName: getVal("Headmaster Name"),
      headmasterNumber: getVal("Headmaster Number"),
      sweeperName: getVal("Sweeper Name"),
      accountHolderName: getVal("Account Holder Name"),
      accountNumber: getVal("Account Number"),
      ifscCode: getVal("IFSC Code"),
      noOfToilets: Number(getVal("No of Toilets")) || 0,
      rates: Number(getVal("Rates")) || 0,
      rateExplanation: getVal("Explanation for Rate"),
      block: getVal("Block"),
      district: getVal("District"),
      materialCost: Number(getVal("Material Cost")) || 0,
      remarks: getVal("Remarks"),
      srNo: Number(getVal("SR NO")) || 0,
    });
  }

  return parsed;
}

export function validateSchoolWork(_emp: Partial<SchoolWork>): Record<string, string> {
  return {};
}

export function getSchoolHeaderValue(
  school: SchoolWork,
  header: string,
  index = 0,
): string | number {
  switch (header) {
    case "SR NO":
      return school.srNo || index + 1;
    case "School Name":
      return school.schoolName || "";
    case "UDISE":
      return school.udise || "";
    case "Headmaster Name":
      return school.headmasterName || "";
    case "Headmaster Number":
      return school.headmasterNumber || "";
    case "Sweeper Name":
      return school.sweeperName || "";
    case "Account Holder Name":
      return school.accountHolderName || "";
    case "Account Number":
      return school.accountNumber || "";
    case "IFSC Code":
      return school.ifscCode || "";
    case "No of Toilets":
      return school.noOfToilets ?? 0;
    case "Rates":
      return school.rates ?? 0;
    case "Explanation for Rate":
      return school.rateExplanation || "";
    case "Block":
      return school.block || "";
    case "District":
      return school.district || "";
    case "Material Cost":
      return school.materialCost ?? 0;
    case "Remarks":
      return school.remarks || "";
    default:
      return "";
  }
}

export function splitAmountEqually(total: number, count: number): number[] {
  if (count <= 0) return [];
  const roundedTotal = Math.round(total);
  const base = Math.floor(roundedTotal / count);
  const remainder = roundedTotal - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function getSchoolMonthlyMaterial(school: SchoolWork, monthKey?: string): number {
  if (monthKey && school.monthlyExpenseLedger?.[monthKey]) {
    return Number(school.monthlyExpenseLedger[monthKey].material) || 0;
  }
  return Number(school.materialCost) || 0;
}

export function getSchoolMonthlyMiscellaneous(school: SchoolWork, monthKey?: string): number {
  if (monthKey && school.monthlyExpenseLedger?.[monthKey]) {
    return Number(school.monthlyExpenseLedger[monthKey].miscellaneous) || 0;
  }
  return 0;
}

export function computeSchoolLabourCost(school: SchoolWork): number {
  return (Number(school.rates) || 0) * (Number(school.noOfToilets) || 0);
}

export function computeSchoolTotalPayable(school: SchoolWork, monthKey?: string): number {
  return (
    computeSchoolLabourCost(school) +
    getSchoolMonthlyMaterial(school, monthKey) +
    getSchoolMonthlyMiscellaneous(school, monthKey)
  );
}
