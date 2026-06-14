import { SchoolSupervisor, SchoolWork, SCHOOL_EXCEL_ROW_HEADERS, SchoolPartner } from "../types";

export function normalizeBlockName(block: string): string {
  return block.trim().toLowerCase();
}

export function supervisorCoversBlock(supervisor: SchoolSupervisor, block: string): boolean {
  const normalized = normalizeBlockName(block);
  if (!normalized) return false;
  return (supervisor.assignedBlocks || []).some((b) => normalizeBlockName(b) === normalized);
}

export function getSupervisorsForBlock(supervisors: SchoolSupervisor[], block: string): SchoolSupervisor[] {
  return supervisors.filter((supervisor) => supervisorCoversBlock(supervisor, block));
}

export function getSchoolsForSupervisor(supervisor: SchoolSupervisor, schools: SchoolWork[]): SchoolWork[] {
  return schools.filter((school) => supervisorCoversBlock(supervisor, school.block || ""));
}

export function countSchoolsWithoutSupervisorCoverage(
  schools: SchoolWork[],
  supervisors: SchoolSupervisor[],
): number {
  return schools.filter((school) => getSupervisorsForBlock(supervisors, school.block || "").length === 0).length;
}
import { MONTH_NAME_LIST } from "./date-helpers";
import { findHeaderIndex } from "../utils";

export type ExpenseRecordType = "Material" | "Trek" | "Miscellaneous";

export interface ExpenseRecordRow {
  date: string;
  type: ExpenseRecordType;
  block: string;
  district: string;
  remarks: string;
  amount: number;
  monthKey: string;
}

export type FormExpenseRecordType = "material" | "trek" | "miscellaneous";

export function expenseRecordTypeToForm(type: ExpenseRecordType): FormExpenseRecordType {
  if (type === "Material") return "material";
  if (type === "Trek") return "trek";
  return "miscellaneous";
}

function monthKeySortValue(monthKey: string): number {
  const parts = monthKey.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  const monthIndex = MONTH_NAME_LIST.indexOf(parts[0]);
  const year = parseInt(parts[parts.length - 1], 10);
  if (monthIndex === -1 || !Number.isFinite(year)) return 0;
  return year * 12 + monthIndex;
}

/** Flatten school monthly expense ledgers into block-level expense rows. */
export function buildAllExpenseRecords(schools: SchoolWork[]): ExpenseRecordRow[] {
  const aggregated = new Map<string, ExpenseRecordRow>();

  for (const school of schools) {
    const block = school.block?.trim() || "—";
    const district = school.district?.trim() || "";
    const ledger = school.monthlyExpenseLedger || {};

    for (const [monthKey, entry] of Object.entries(ledger)) {
      const expenseTypes: Array<{
        type: ExpenseRecordType;
        amount: number;
        remark: string;
        date: string;
      }> = [
        {
          type: "Material",
          amount: Number(entry.material) || 0,
          remark: entry.materialRemark?.trim() || "",
          date: entry.materialDate?.trim() || "",
        },
        {
          type: "Trek",
          amount: Number(entry.trek) || 0,
          remark: entry.trekRemark?.trim() || "",
          date: entry.trekDate?.trim() || "",
        },
        {
          type: "Miscellaneous",
          amount: Number(entry.miscellaneous) || 0,
          remark: entry.miscellaneousRemark?.trim() || "",
          date: entry.miscellaneousDate?.trim() || "",
        },
      ];

      for (const { type, amount, remark, date } of expenseTypes) {
        if (amount <= 0 && !remark) continue;

        const key = `${monthKey}|${block}|${type}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.amount += amount;
          if (!existing.remarks && remark) existing.remarks = remark;
          if (!existing.date && date) existing.date = date;
          if (!existing.district && district) existing.district = district;
        } else {
          aggregated.set(key, {
            date,
            type,
            block,
            district,
            remarks: remark,
            amount,
            monthKey,
          });
        }
      }
    }
  }

  return Array.from(aggregated.values()).sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    const monthDiff = monthKeySortValue(b.monthKey) - monthKeySortValue(a.monthKey);
    if (monthDiff !== 0) return monthDiff;
    const blockDiff = a.block.localeCompare(b.block);
    if (blockDiff !== 0) return blockDiff;
    return a.type.localeCompare(b.type);
  });
}

export function formatExpenseDate(dateStr: string): string {
  if (!dateStr) return "—";
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const SCHOOL_HEADER_ALIASES: Record<string, string[]> = {
  srno: ["srno", "sno", "slno", "serialno"],
  schoolname: ["schoolname", "school", "nameofschool"],
  schoolcategory: ["schoolcategory", "category", "schooltype"],
  udise: ["udise", "udisecode", "udiseno"],
  headmastername: ["headmastername", "headmaster", "hmname"],
  headmasternumber: ["headmasternumber", "headmastermobile", "headmasterphone", "hmnumber", "hmphone"],
  sweepername: ["sweepername", "sweeper", "cleaningpartner", "cleaningpartnername"],
  cleaningpartner: ["cleaningpartner", "cleaningpartnername", "sweepername", "sweeper"],
  accountholdername: ["accountholdername", "accountholder", "bankaccountholder", "nameremarks"],
  accountnumber: ["accountnumber", "accountno", "bankaccountno", "bankaccount"],
  ifsccode: ["ifsccode", "ifsc"],
  paymentmethod: ["paymentmethod", "paymethod", "paymentmode"],
  nooftoilets: ["nooftoilets", "noof toiletes", "noof toilletes", "toilets", "toiletes"],
  govtunitrate: ["govtunitrate", "unitrate", "perunitcost", "govtrate"],
  partnermonthlypay: ["partnermonthlypay", "partnerpay", "payby", "monthlypay"],
  rates: ["rates", "rate"],
  explanationforrate: ["explanationforrate", "explainationforrate", "rateexplanation", "explaination for rate"],
  block: ["block", "blockname"],
  district: ["district"],
  materialcost: ["materialcost", "material"],
  remarks: ["remarks", "remark", "notes"],
};

export function isSecondarySchoolCategory(category: string): boolean {
  const norm = String(category || "").toLowerCase();
  return (
    norm.includes("high school") ||
    norm.includes("highschool") ||
    norm === "uhs" ||
    norm === "umv" ||
    norm.includes("uchh madhyamik") ||
    norm.includes("upgraded h") ||
    norm.includes("utkramit h") ||
    norm.includes("janta high")
  );
}

export function defaultRatesForCategory(category: string): {
  govtUnitRate: number;
  partnerMonthlyPay: number;
} {
  if (isSecondarySchoolCategory(category)) {
    return { govtUnitRate: 100, partnerMonthlyPay: 4500 };
  }
  return { govtUnitRate: 50, partnerMonthlyPay: 3750 };
}

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

    const schoolCategory = getVal("School Category");
    const defaults = defaultRatesForCategory(schoolCategory);
    const partnerMonthlyPay =
      Number(getVal("Partner Monthly Pay")) || defaults.partnerMonthlyPay;
    const govtUnitRate =
      Number(getVal("Govt Unit Rate")) || defaults.govtUnitRate;

    parsed.push({
      udise,
      schoolName,
      schoolCategory,
      headmasterName: getVal("Headmaster Name"),
      headmasterNumber: getVal("Headmaster Number"),
      sweeperName: getVal("Cleaning Partner") || getVal("Sweeper Name"),
      accountHolderName: getVal("Account Holder Name"),
      accountNumber: getVal("Account Number"),
      ifscCode: getVal("IFSC Code"),
      paymentMethod: getVal("Payment Method"),
      noOfToilets: Number(getVal("No of Toilets")) || 0,
      govtUnitRate,
      partnerMonthlyPay,
      rates: Number(getVal("Rates")) || partnerMonthlyPay,
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

export function validateSchoolWork(row: Partial<SchoolWork>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!row.schoolName?.trim()) {
    errors.schoolName = "School name is required.";
  }

  const udise = row.udise?.trim() || "";
  if (!udise) {
    errors.udise = "UDISE code is required.";
  }

  if (!row.block?.trim()) {
    errors.block = "Block is required.";
  }

  const toilets = Number(row.noOfToilets);
  if (!Number.isFinite(toilets) || toilets < 0) {
    errors.noOfToilets = "Number of toilets must be 0 or greater.";
  }

  const monthlyPay = Number(row.partnerMonthlyPay);
  if (row.partnerMonthlyPay !== undefined && (!Number.isFinite(monthlyPay) || monthlyPay < 0)) {
    errors.partnerMonthlyPay = "Partner monthly pay must be 0 or greater.";
  }

  const govtRate = Number(row.govtUnitRate);
  if (row.govtUnitRate !== undefined && (!Number.isFinite(govtRate) || govtRate < 0)) {
    errors.govtUnitRate = "Govt unit rate must be 0 or greater.";
  }

  const accountNumber = row.accountNumber?.trim() || "";
  const ifscCode = row.ifscCode?.trim() || "";
  if (accountNumber && !ifscCode) {
    errors.ifscCode = "IFSC code is required when account number is provided.";
  }

  return errors;
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
    case "School Category":
      return school.schoolCategory || "";
    case "Headmaster Name":
      return school.headmasterName || "";
    case "Headmaster Number":
      return school.headmasterNumber || "";
    case "Cleaning Partner":
    case "Sweeper Name":
      return school.sweeperName || "";
    case "Account Holder Name":
      return school.accountHolderName || "";
    case "Account Number":
      return school.accountNumber || "";
    case "IFSC Code":
      return school.ifscCode || "";
    case "Payment Method":
      return school.paymentMethod || "";
    case "No of Toilets":
      return school.noOfToilets ?? 0;
    case "Govt Unit Rate":
      return school.govtUnitRate ?? 0;
    case "Partner Monthly Pay":
      return school.partnerMonthlyPay ?? 0;
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

export function getSchoolMonthlyTrek(school: SchoolWork, monthKey?: string): number {
  if (monthKey && school.monthlyExpenseLedger?.[monthKey]) {
    return Number(school.monthlyExpenseLedger[monthKey].trek) || 0;
  }
  return 0;
}

export function getSchoolMonthlyMiscellaneous(school: SchoolWork, monthKey?: string): number {
  if (monthKey && school.monthlyExpenseLedger?.[monthKey]) {
    return Number(school.monthlyExpenseLedger[monthKey].miscellaneous) || 0;
  }
  return 0;
}

export function computePerToiletPay(
  school: Pick<SchoolWork, "partnerMonthlyPay" | "rates" | "noOfToilets" | "schoolCategory">,
): number {
  const monthlyPay = computePartnerMonthlyPay(school as SchoolWork);
  const toilets = Number(school.noOfToilets) || 0;
  if (toilets > 0 && monthlyPay > 0) {
    return Math.round(monthlyPay / toilets);
  }
  const rates = Number(school.rates) || 0;
  if (rates > 0 && rates <= 100) return rates;
  return 0;
}

export function computePartnerMonthlyPay(school: SchoolWork): number {
  if (Number(school.partnerMonthlyPay) > 0) return Number(school.partnerMonthlyPay);
  return defaultRatesForCategory(school.schoolCategory || "").partnerMonthlyPay;
}

export function computeGovtUnitRate(school: SchoolWork): number {
  if (Number(school.govtUnitRate) > 0) return Number(school.govtUnitRate);
  return defaultRatesForCategory(school.schoolCategory || "").govtUnitRate;
}

export const STANDARD_MONTH_DAYS = 24;

export function getSchoolCleaningDays(
  school: SchoolWork,
  monthKey?: string,
  defaultDays = STANDARD_MONTH_DAYS,
): number {
  if (monthKey && school.monthlyWorkdaysLedger?.[monthKey]) {
    const days = Number(school.monthlyWorkdaysLedger[monthKey].cleaningDays);
    if (Number.isFinite(days) && days >= 1) return Math.min(31, Math.round(days));
  }
  return defaultDays;
}

export function getSchoolBillingToilets(
  school: SchoolWork,
  monthKey?: string,
): number {
  if (monthKey && school.monthlyWorkdaysLedger?.[monthKey]?.billingToilets != null) {
    const toilets = Number(school.monthlyWorkdaysLedger[monthKey].billingToilets);
    if (Number.isFinite(toilets) && toilets >= 0) return Math.round(toilets);
  }
  return Number(school.noOfToilets) || 0;
}

export function computePartnerPayByDays(
  school: SchoolWork,
  daysWorked: number,
  standardDays = STANDARD_MONTH_DAYS,
): number {
  const monthlyPay = computePartnerMonthlyPay(school);
  if (standardDays <= 0) return monthlyPay;
  return Math.round((monthlyPay * daysWorked) / standardDays);
}

export function computeGovtBillAmount(school: SchoolWork, cleaningDays = STANDARD_MONTH_DAYS): number {
  const toilets = Number(school.noOfToilets) || 0;
  const unitRate = computeGovtUnitRate(school);
  return toilets * cleaningDays * unitRate;
}

export function computeSchoolLabourCost(school: SchoolWork): number {
  const partnerPay = computePartnerMonthlyPay(school);
  if (partnerPay > 0) return partnerPay;
  return (Number(school.rates) || 0) * (Number(school.noOfToilets) || 0);
}

export function computeSchoolTotalPayable(school: SchoolWork, monthKey?: string): number {
  return (
    computeSchoolLabourCost(school) +
    getSchoolMonthlyMaterial(school, monthKey) +
    getSchoolMonthlyTrek(school, monthKey) +
    getSchoolMonthlyMiscellaneous(school, monthKey)
  );
}

export function computeSchoolProfitSummary(
  schools: SchoolWork[],
  monthKey?: string,
  cleaningDays = 24,
): {
  govtRevenue: number;
  partnerCost: number;
  material: number;
  trek: number;
  miscellaneous: number;
  netMargin: number;
} {
  const govtRevenue = schools.reduce(
    (sum, s) => sum + computeGovtBillAmount(s, cleaningDays),
    0,
  );
  const partnerCost = schools.reduce((sum, s) => sum + computeSchoolLabourCost(s), 0);
  const material = schools.reduce(
    (sum, s) => sum + getSchoolMonthlyMaterial(s, monthKey),
    0,
  );
  const trek = schools.reduce((sum, s) => sum + getSchoolMonthlyTrek(s, monthKey), 0);
  const miscellaneous = schools.reduce(
    (sum, s) => sum + getSchoolMonthlyMiscellaneous(s, monthKey),
    0,
  );
  return {
    govtRevenue,
    partnerCost,
    material,
    trek,
    miscellaneous,
    netMargin: govtRevenue - partnerCost - material - trek - miscellaneous,
  };
}

export function filterSchoolsByBillingCategory(
  schools: SchoolWork[],
  category: "elementary" | "secondary" | "all",
): SchoolWork[] {
  if (category === "all") return schools;
  return schools.filter((s) => {
    const secondary = isSecondarySchoolCategory(s.schoolCategory || "");
    return category === "secondary" ? secondary : !secondary;
  });
}

export function filterLineItemsByBillingCategory<
  T extends { schoolCategory: string },
>(items: T[], category: "elementary" | "secondary" | "all"): T[] {
  if (category === "all") return items;
  return items.filter((item) => {
    const secondary = isSecondarySchoolCategory(item.schoolCategory || "");
    return category === "secondary" ? secondary : !secondary;
  });
}

export const GOVT_BILL_HEADERS = [
  "SL NO",
  "Block Name",
  "UDISE Code",
  "School Name",
  "School Category",
  "NO. OF TOILET (AS PER BILL)",
  "NO. OF DAYS (TOTAL)",
  "TOTAL TOILET CLEANING",
  "PER UNIT COST",
  "TOTAL AMOUNT",
  "REMARKS",
];

export function buildGovtBillRowsFromLineItems(
  items: {
    udise: string;
    schoolName: string;
    schoolCategory: string;
    toilets: number;
    govtUnitRate: number;
    cleaningDays: number;
    totalCleanings: number;
    govtAmount: number;
    remarks: string;
  }[],
  block: string,
): (string | number)[][] {
  return items.map((item, index) => [
    index + 1,
    block,
    item.udise || "",
    item.schoolName || "",
    item.schoolCategory || "",
    item.toilets,
    item.cleaningDays,
    item.totalCleanings,
    item.govtUnitRate,
    item.govtAmount,
    item.remarks || "",
  ]);
}

export function buildGovtBillRows(
  schools: SchoolWork[],
  cleaningDaysOrMap: number | Record<string, number> = STANDARD_MONTH_DAYS,
  monthKey?: string,
  toiletsOrMap?: number | Record<string, number>,
): (string | number)[][] {
  return schools.map((school, index) => {
    const toilets =
      typeof toiletsOrMap === "number"
        ? toiletsOrMap
        : toiletsOrMap?.[school.id] ??
          getSchoolBillingToilets(school, monthKey);
    const unitRate = computeGovtUnitRate(school);
    const cleaningDays =
      typeof cleaningDaysOrMap === "number"
        ? cleaningDaysOrMap
        : cleaningDaysOrMap[school.id] ??
          getSchoolCleaningDays(school, monthKey, STANDARD_MONTH_DAYS);
    const totalCleanings = toilets * cleaningDays;
    const totalAmount = totalCleanings * unitRate;
    return [
      school.srNo || index + 1,
      school.block || "",
      school.udise || "",
      school.schoolName || "",
      school.schoolCategory || "",
      toilets,
      cleaningDays,
      totalCleanings,
      unitRate,
      totalAmount,
      school.remarks || "",
    ];
  });
}

export function buildPartnerPaymentRows(
  schools: SchoolWork[],
  monthMultiplier = 1,
  monthKey?: string,
  defaultDays = STANDARD_MONTH_DAYS,
): (string | number)[][] {
  return schools.map((school, index) => {
    const daysWorked = getSchoolCleaningDays(school, monthKey, defaultDays);
    const payable =
      monthMultiplier === 1
        ? computePartnerPayByDays(school, daysWorked, defaultDays)
        : computePartnerMonthlyPay(school) * monthMultiplier;
    return [
      school.srNo || index + 1,
      school.schoolName || "",
      school.schoolCategory || "",
      school.sweeperName || "",
      school.accountHolderName || school.sweeperName || "",
      school.accountNumber || "",
      school.ifscCode || "",
      Number(school.noOfToilets) || 0,
      daysWorked,
      computePerToiletPay(school),
      payable,
      school.remarks || "",
    ];
  });
}

export function getPartnerPerToiletPay(partner: Pick<SchoolPartner, "perToiletPay" | "monthlyPay" | "noOfToilets">): number {
  if (Number(partner.perToiletPay) > 0) return Number(partner.perToiletPay);
  const toilets = Number(partner.noOfToilets) || 0;
  const monthlyPay = Number(partner.monthlyPay) || 0;
  if (toilets > 0 && monthlyPay > 0) return Math.round(monthlyPay / toilets);
  return 0;
}

export type PartnerPayStatus = "Unpaid" | "Paid" | "Hold";

export const PARTNER_PAY_STATUS_OPTIONS: PartnerPayStatus[] = ["Unpaid", "Paid", "Hold"];

export function getPartnerPayStatus(
  partner: Pick<SchoolPartner, "monthlyPayLedger">,
  monthKey?: string,
): PartnerPayStatus {
  if (!monthKey) return "Unpaid";
  return partner.monthlyPayLedger?.[monthKey]?.paymentStatus || "Unpaid";
}

export function partnerPayStatusClass(status: PartnerPayStatus): string {
  if (status === "Paid") {
    return "bg-emerald-50 border-emerald-200 text-emerald-700";
  }
  if (status === "Hold") {
    return "bg-amber-50 border-amber-200 text-amber-700";
  }
  return "bg-slate-100 border-slate-200 text-slate-600";
}

export type PartnerPayNumericField = "toilets" | "days" | "monthlyPay" | "perToiletPay";
export type PartnerPayTextField =
  | "schoolName"
  | "schoolCategory"
  | "partnerName"
  | "accountHolderName"
  | "accountNumber"
  | "ifscCode";
export type PartnerPayEditableField = PartnerPayNumericField | PartnerPayTextField;

export interface PartnerPayValues {
  toilets: number;
  days: number;
  monthlyPay: number;
  perToiletPay: number;
}

export function getPartnerPayBaseValues(
  partner: Pick<SchoolPartner, "monthlyPay" | "perToiletPay"> & { noOfToilets?: number },
  school?: SchoolWork,
  monthKey?: string,
  defaultDays = STANDARD_MONTH_DAYS,
): PartnerPayValues {
  const toilets =
    school && monthKey
      ? getSchoolBillingToilets(school, monthKey)
      : Number(partner.noOfToilets) || 0;
  const days = school ? getSchoolCleaningDays(school, monthKey, defaultDays) : defaultDays;
  const monthlyPay = Number(partner.monthlyPay) || 0;
  const perToiletPay = getPartnerPerToiletPay({ ...partner, noOfToilets: toilets, monthlyPay });
  return { toilets, days, monthlyPay, perToiletPay };
}

export function applyPartnerPayFieldChange(
  current: PartnerPayValues,
  field: PartnerPayEditableField,
  rawValue: number,
): PartnerPayValues {
  const value = Math.max(0, Math.round(Number(rawValue) || 0));
  const next = { ...current };

  if (field === "toilets") {
    next.toilets = value;
    if (value > 0 && current.perToiletPay > 0) {
      next.monthlyPay = current.perToiletPay * value;
    } else if (value > 0 && current.monthlyPay > 0) {
      next.perToiletPay = Math.round(current.monthlyPay / value);
    }
    return next;
  }

  if (field === "days") {
    next.days = Math.min(31, Math.max(1, value || STANDARD_MONTH_DAYS));
    return next;
  }

  if (field === "perToiletPay") {
    next.perToiletPay = value;
    next.monthlyPay = value * (current.toilets || 0);
    return next;
  }

  next.monthlyPay = value;
  next.perToiletPay =
    current.toilets > 0 && value > 0 ? Math.round(value / current.toilets) : current.perToiletPay;
  return next;
}

export function computePartnerPayableAmount(
  values: PartnerPayValues,
  monthMultiplier = 1,
  defaultDays = STANDARD_MONTH_DAYS,
): number {
  if (monthMultiplier !== 1) {
    return values.monthlyPay * monthMultiplier;
  }
  if (defaultDays <= 0) return values.monthlyPay;
  return Math.round((values.monthlyPay * values.days) / defaultDays);
}

export function buildPartnerPaymentRowsFromPartners(
  partners: {
    id?: string;
    schoolWorkId?: string;
    schoolName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    partnerName: string;
    monthlyPay: number;
    perToiletPay: number;
    noOfToilets?: number;
    remarks?: string;
    monthlyPayLedger?: SchoolPartner["monthlyPayLedger"];
  }[],
  monthMultiplier = 1,
  schoolsById?: Record<string, SchoolWork>,
  monthKey?: string,
  defaultDays = STANDARD_MONTH_DAYS,
  valueOverrides?: Record<string, Partial<PartnerPayValues>>,
  statusOverrides?: Record<string, PartnerPayStatus>,
): (string | number)[][] {
  return partners.map((partner, index) => {
    const school = partner.schoolWorkId
      ? schoolsById?.[partner.schoolWorkId]
      : undefined;
    const base = getPartnerPayBaseValues(partner, school, monthKey, defaultDays);
    const overrideKey = partner.id || partner.schoolWorkId || "";
    const values = { ...base, ...(valueOverrides?.[overrideKey] || {}) };
    const payable = computePartnerPayableAmount(values, monthMultiplier, defaultDays);
    const paymentStatus =
      statusOverrides?.[overrideKey] || getPartnerPayStatus(partner, monthKey);
    return [
      school?.srNo || index + 1,
      partner.schoolName || "",
      school?.schoolCategory || "",
      partner.partnerName || "",
      partner.accountHolderName || "",
      partner.accountNumber || "",
      partner.ifscCode || "",
      values.toilets,
      values.days,
      values.perToiletPay,
      values.monthlyPay,
      payable,
      paymentStatus,
      partner.remarks || "",
    ];
  });
}

export const PARTNER_PAYMENT_HEADERS = [
  "Sr No",
  "School Name",
  "School Category",
  "Partner Name",
  "Account Holder Name",
  "Account Number",
  "IFSC",
  "No of Toilets",
  "No of Days",
  "Pay per Toilet",
  "Monthly Pay",
  "Total Pay",
  "Status",
  "Remark",
];

export const PARTNER_PAY_COL_SCHOOL_NAME = 1;
export const PARTNER_PAY_COL_SCHOOL_CATEGORY = 2;
export const PARTNER_PAY_COL_PARTNER_NAME = 3;
export const PARTNER_PAY_COL_ACCOUNT_HOLDER = 4;
export const PARTNER_PAY_COL_ACCOUNT_NUMBER = 5;
export const PARTNER_PAY_COL_IFSC = 6;
export const PARTNER_PAY_COL_TOILETS = 7;
export const PARTNER_PAY_COL_DAYS = 8;
export const PARTNER_PAY_COL_PER_TOILET = 9;
export const PARTNER_PAY_COL_MONTHLY = 10;
export const PARTNER_PAY_COL_TOTAL = 11;
export const PARTNER_PAY_COL_STATUS = 12;

export interface PartnerPayTextValues {
  schoolName: string;
  schoolCategory: string;
  partnerName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
}

export function getPartnerPayTextBaseValues(
  partner: Pick<
    SchoolPartner,
    "schoolName" | "partnerName" | "accountHolderName" | "accountNumber" | "ifscCode"
  >,
  school?: SchoolWork,
): PartnerPayTextValues {
  return {
    schoolName: partner.schoolName || "",
    schoolCategory: school?.schoolCategory || "",
    partnerName: partner.partnerName || "",
    accountHolderName: partner.accountHolderName || "",
    accountNumber: partner.accountNumber || "",
    ifscCode: partner.ifscCode || "",
  };
}

export const PARTNER_PAY_TEXT_TO_SCHOOL_FIELD: Record<PartnerPayTextField, keyof SchoolWork> = {
  schoolName: "schoolName",
  schoolCategory: "schoolCategory",
  partnerName: "sweeperName",
  accountHolderName: "accountHolderName",
  accountNumber: "accountNumber",
  ifscCode: "ifscCode",
};

export function isPartnerPayNumericField(
  field: PartnerPayEditableField,
): field is PartnerPayNumericField {
  return field === "toilets" || field === "days" || field === "monthlyPay" || field === "perToiletPay";
}
/** 0-based column index for Total Pay (prorated payable). */
export const PARTNER_PAYMENT_TOTAL_PAY_COLUMN = PARTNER_PAY_COL_TOTAL;
