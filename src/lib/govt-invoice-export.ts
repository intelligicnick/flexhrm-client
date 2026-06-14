import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { SchoolMonthlyBilling, SchoolWork } from "../types";
import {
  GOVT_BILL_HEADERS,
  STANDARD_MONTH_DAYS,
  buildGovtBillRows,
  computeGovtUnitRate,
  filterLineItemsByBillingCategory,
  filterSchoolsByBillingCategory,
  getSchoolCleaningDays,
  getSchoolBillingToilets,
} from "./school-work-helpers";

const HINDI_MONTHS: Record<string, string> = {
  January: "जनवरी",
  February: "फरवरी",
  March: "मार्च",
  April: "अप्रैल",
  May: "मई",
  June: "जून",
  July: "जुलाई",
  August: "अगस्त",
  September: "सितंबर",
  October: "अक्टूबर",
  November: "नवंबर",
  December: "दिसंबर",
};

export interface GovtInvoiceExportParams {
  schools: SchoolWork[];
  block: string;
  district?: string;
  monthKey: string;
  financialYear: string;
  category: "elementary" | "secondary" | "all";
  defaultDays?: number;
  daysMap?: Record<string, number>;
  toiletsMap?: Record<string, number>;
}

type GovtInvoiceSheetParams = GovtInvoiceExportParams & {
  sheetName: string;
};

export function monthKeyToHindi(monthKey: string): string {
  const parts = monthKey.trim().split(/\s+/);
  if (parts.length < 2) return monthKey;
  const hindiMonth = HINDI_MONTHS[parts[0]] || parts[0];
  return `${hindiMonth} ${parts[parts.length - 1]}`;
}

export function buildGovtInvoiceHeaderLines(params: {
  block: string;
  district?: string;
  monthKey: string;
  financialYear: string;
}): string[] {
  const districtLabel = params.district?.trim() || "पूर्णिया";
  const blockUpper = params.block.toUpperCase();
  return [
    `कार्यालय:- प्रखंड शिक्षा पदाधिकारी, ${blockUpper} (${districtLabel})`,
    "प्रधानाध्यापक के द्वारा दिए गए प्रतिदिन के आधार पर हाउसकीपिंग का विवरण",
    `द्वितीय वर्ष :- ${params.financialYear} माह का नाम :- ${monthKeyToHindi(params.monthKey)}`,
  ];
}

export function prepareGovtInvoiceSchools(params: GovtInvoiceExportParams): {
  schools: SchoolWork[];
  daysMap: Record<string, number>;
  toiletsMap: Record<string, number>;
  unitRate: number;
} {
  let rows = params.schools.filter((s) => s.block === params.block);
  if (params.district) {
    rows = rows.filter(
      (s) => String(s.district || "").toLowerCase() === params.district!.toLowerCase(),
    );
  }
  const schools = filterSchoolsByBillingCategory(rows, params.category);
  const defaultDays = params.defaultDays ?? STANDARD_MONTH_DAYS;
  const daysMap: Record<string, number> = {};
  const toiletsMap: Record<string, number> = {};
  for (const school of schools) {
    daysMap[school.id] =
      params.daysMap?.[school.id] ??
      getSchoolCleaningDays(school, params.monthKey, defaultDays);
    toiletsMap[school.id] =
      params.toiletsMap?.[school.id] ?? getSchoolBillingToilets(school, params.monthKey);
  }
  const unitRate = params.category === "secondary" ? 100 : 50;
  return { schools, daysMap, toiletsMap, unitRate };
}

export function buildGovtInvoiceTableRows(
  schools: SchoolWork[],
  daysMap: Record<string, number>,
  monthKey?: string,
  defaultDays = STANDARD_MONTH_DAYS,
  toiletsMap?: Record<string, number>,
): (string | number)[][] {
  return buildGovtBillRows(schools, daysMap, monthKey, toiletsMap);
}

export function computeGovtInvoiceTotals(
  dataRows: (string | number)[][],
): { toilets: number; cleanings: number; amount: number } {
  return dataRows.reduce(
    (acc, row) => ({
      toilets: acc.toilets + Number(row[5] || 0),
      cleanings: acc.cleanings + Number(row[7] || 0),
      amount: acc.amount + Number(row[9] || 0),
    }),
    { toilets: 0, cleanings: 0, amount: 0 },
  );
}

function applyGovtInvoiceSheetStyle(ws: ExcelJS.Worksheet, headerRow: number, dataStart: number, dataEnd: number) {
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2EFDA" },
  };

  for (let c = 1; c <= GOVT_BILL_HEADERS.length; c++) {
    const cell = ws.getCell(headerRow, c);
    cell.font = { bold: true, size: 10 };
    cell.fill = headerFill;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }

  for (let r = dataStart; r <= dataEnd + 1; r++) {
    for (let c = 1; c <= GOVT_BILL_HEADERS.length; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", horizontal: c >= 6 && c <= 10 ? "right" : "left", wrapText: true };
      if (c === 9 || c === 10) {
        cell.numFmt = "0.00";
      }
    }
  }

  ws.columns = [
    { width: 6 },
    { width: 12 },
    { width: 14 },
    { width: 34 },
    { width: 18 },
    { width: 12 },
    { width: 10 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
  ];
}

function addGovtInvoiceSheetToWorkbook(
  workbook: ExcelJS.Workbook,
  params: GovtInvoiceSheetParams,
): void {
  const { schools, daysMap, toiletsMap, unitRate } = prepareGovtInvoiceSchools(params);
  const defaultDays = params.defaultDays ?? STANDARD_MONTH_DAYS;
  const headerLines = buildGovtInvoiceHeaderLines(params);

  const ws = workbook.addWorksheet(params.sheetName);

  ws.mergeCells(1, 1, 1, GOVT_BILL_HEADERS.length);
  ws.getCell(1, 1).value = headerLines[0];
  ws.getCell(1, 1).font = { bold: true, size: 11 };
  ws.getCell(1, 1).alignment = { horizontal: "center" };

  ws.mergeCells(2, 1, 2, GOVT_BILL_HEADERS.length);
  ws.getCell(2, 1).value = headerLines[1];
  ws.getCell(2, 1).font = { size: 10 };
  ws.getCell(2, 1).alignment = { horizontal: "center" };

  ws.mergeCells(3, 1, 3, GOVT_BILL_HEADERS.length);
  ws.getCell(3, 1).value = headerLines[2];
  ws.getCell(3, 1).font = { size: 10 };
  ws.getCell(3, 1).alignment = { horizontal: "center" };

  const headerRow = 5;
  ws.addRow([]);
  ws.getRow(4).height = 6;
  GOVT_BILL_HEADERS.forEach((header, idx) => {
    ws.getCell(headerRow, idx + 1).value = header;
  });

  const dataStart = headerRow + 1;
  schools.forEach((school, index) => {
    const rowNum = dataStart + index;
    const toilets = toiletsMap[school.id] ?? (Number(school.noOfToilets) || 0);
    const days = daysMap[school.id] ?? defaultDays;
    const rate = computeGovtUnitRate(school) || unitRate;

    ws.getCell(rowNum, 1).value = school.srNo || index + 1;
    ws.getCell(rowNum, 2).value = (school.block || params.block).toUpperCase();
    ws.getCell(rowNum, 3).value = school.udise || "";
    ws.getCell(rowNum, 4).value = school.schoolName || "";
    ws.getCell(rowNum, 5).value = school.schoolCategory || "";
    ws.getCell(rowNum, 6).value = toilets;
    ws.getCell(rowNum, 7).value = days;
    ws.getCell(rowNum, 8).value = { formula: `F${rowNum}*G${rowNum}` };
    ws.getCell(rowNum, 9).value = rate;
    ws.getCell(rowNum, 10).value = { formula: `H${rowNum}*I${rowNum}` };
    ws.getCell(rowNum, 11).value = school.remarks || "";
  });

  const dataEnd = dataStart + schools.length - 1;
  const totalRow = dataEnd + 1;
  ws.getCell(totalRow, 1).value = "TOTAL";
  ws.getCell(totalRow, 1).font = { bold: true };
  if (schools.length > 0) {
    ws.getCell(totalRow, 6).value = { formula: `SUM(F${dataStart}:F${dataEnd})` };
    ws.getCell(totalRow, 7).value = defaultDays;
    ws.getCell(totalRow, 8).value = { formula: `SUM(H${dataStart}:H${dataEnd})` };
    ws.getCell(totalRow, 9).value = unitRate;
    ws.getCell(totalRow, 10).value = { formula: `SUM(J${dataStart}:J${dataEnd})` };
  }
  ws.getRow(totalRow).font = { bold: true };

  const footerRow = totalRow + 2;
  ws.mergeCells(footerRow, 1, footerRow, 5);
  ws.mergeCells(footerRow, 6, footerRow, GOVT_BILL_HEADERS.length);
  ws.getCell(footerRow, 1).value = "प्रदानकर्ता एजेंसी का हस्ताक्षर एवं मुहर";
  ws.getCell(footerRow, 6).value = "हस्ताक्षर एवं मुहर";
  ws.getCell(footerRow + 1, 1).value = "प्रखंड शिक्षा पदाधिकारी";

  applyGovtInvoiceSheetStyle(ws, headerRow, dataStart, dataEnd);
}

async function downloadGovtInvoiceWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string,
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportGovtInvoiceExcel(params: GovtInvoiceExportParams): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheetName =
    params.category === "secondary"
      ? "Secondary"
      : params.category === "elementary"
        ? "Elementary"
        : "All";
  addGovtInvoiceSheetToWorkbook(workbook, { ...params, sheetName });
  const catSlug = params.category === "all" ? "all" : params.category;
  await downloadGovtInvoiceWorkbook(
    workbook,
    `${params.block.toUpperCase()}_${params.monthKey.replace(/\s+/g, "_")}_${catSlug}_invoice.xlsx`,
  );
}

export async function exportGovtInvoiceExcelCombined(
  params: Omit<GovtInvoiceExportParams, "category">,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  addGovtInvoiceSheetToWorkbook(workbook, { ...params, category: "elementary", sheetName: "Elementary" });
  addGovtInvoiceSheetToWorkbook(workbook, { ...params, category: "secondary", sheetName: "Secondary" });
  await downloadGovtInvoiceWorkbook(
    workbook,
    `${params.block.toUpperCase()}_${params.monthKey.replace(/\s+/g, "_")}_invoice.xlsx`,
  );
}

function computeBillingLineItemTotals(
  items: SchoolMonthlyBilling["schools"],
): { toilets: number; cleanings: number; amount: number } {
  return items.reduce(
    (acc, item) => ({
      toilets: acc.toilets + item.toilets,
      cleanings: acc.cleanings + item.totalCleanings,
      amount: acc.amount + item.govtAmount,
    }),
    { toilets: 0, cleanings: 0, amount: 0 },
  );
}

function addGovtInvoiceSheetFromBilling(
  workbook: ExcelJS.Workbook,
  billing: SchoolMonthlyBilling,
  schools: SchoolMonthlyBilling["schools"],
  sheetName: string,
  unitRate: number,
): void {
  const params = {
    block: billing.block,
    district: billing.district,
    monthKey: billing.monthKey,
    financialYear: billing.financialYear,
    category: billing.category,
  };
  const headerLines = buildGovtInvoiceHeaderLines(params);
  const totals = computeBillingLineItemTotals(schools);

  const ws = workbook.addWorksheet(sheetName);

  ws.mergeCells(1, 1, 1, GOVT_BILL_HEADERS.length);
  ws.getCell(1, 1).value = headerLines[0];
  ws.getCell(1, 1).font = { bold: true, size: 11 };
  ws.getCell(1, 1).alignment = { horizontal: "center" };

  ws.mergeCells(2, 1, 2, GOVT_BILL_HEADERS.length);
  ws.getCell(2, 1).value = headerLines[1];
  ws.getCell(2, 1).font = { size: 10 };
  ws.getCell(2, 1).alignment = { horizontal: "center" };

  ws.mergeCells(3, 1, 3, GOVT_BILL_HEADERS.length);
  ws.getCell(3, 1).value = headerLines[2];
  ws.getCell(3, 1).font = { size: 10 };
  ws.getCell(3, 1).alignment = { horizontal: "center" };

  const headerRow = 5;
  ws.addRow([]);
  ws.getRow(4).height = 6;
  GOVT_BILL_HEADERS.forEach((header, idx) => {
    ws.getCell(headerRow, idx + 1).value = header;
  });

  const dataStart = headerRow + 1;
  schools.forEach((item, index) => {
    const rowNum = dataStart + index;
    ws.getCell(rowNum, 1).value = index + 1;
    ws.getCell(rowNum, 2).value = billing.block.toUpperCase();
    ws.getCell(rowNum, 3).value = item.udise || "";
    ws.getCell(rowNum, 4).value = item.schoolName || "";
    ws.getCell(rowNum, 5).value = item.schoolCategory || "";
    ws.getCell(rowNum, 6).value = item.toilets;
    ws.getCell(rowNum, 7).value = item.cleaningDays;
    ws.getCell(rowNum, 8).value = item.totalCleanings;
    ws.getCell(rowNum, 9).value = item.govtUnitRate || unitRate;
    ws.getCell(rowNum, 10).value = item.govtAmount;
    ws.getCell(rowNum, 11).value = item.remarks || "";
  });

  const dataEnd = dataStart + schools.length - 1;
  const totalRow = dataEnd + 1;
  ws.getCell(totalRow, 1).value = "TOTAL";
  ws.getCell(totalRow, 1).font = { bold: true };
  if (schools.length > 0) {
    ws.getCell(totalRow, 6).value = totals.toilets;
    ws.getCell(totalRow, 8).value = totals.cleanings;
    ws.getCell(totalRow, 10).value = totals.amount;
  }
  ws.getRow(totalRow).font = { bold: true };

  const footerRow = totalRow + 2;
  ws.mergeCells(footerRow, 1, footerRow, 5);
  ws.mergeCells(footerRow, 6, footerRow, GOVT_BILL_HEADERS.length);
  ws.getCell(footerRow, 1).value = "प्रदानकर्ता एजेंसी का हस्ताक्षर एवं मुहर";
  ws.getCell(footerRow, 6).value = "हस्ताक्षर एवं मुहर";
  ws.getCell(footerRow + 1, 1).value = "प्रखंड शिक्षा पदाधिकारी";

  applyGovtInvoiceSheetStyle(ws, headerRow, dataStart, dataEnd);
}

export async function exportGovtInvoiceExcelFromBilling(
  billing: SchoolMonthlyBilling,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const elementarySchools = filterLineItemsByBillingCategory(billing.schools, "elementary");
  const secondarySchools = filterLineItemsByBillingCategory(billing.schools, "secondary");

  if (billing.category === "all") {
    if (elementarySchools.length > 0) {
      addGovtInvoiceSheetFromBilling(workbook, billing, elementarySchools, "Elementary", 50);
    }
    if (secondarySchools.length > 0) {
      addGovtInvoiceSheetFromBilling(workbook, billing, secondarySchools, "Secondary", 100);
    }
  } else {
    const unitRate = billing.category === "secondary" ? 100 : 50;
    const sheetName = billing.category === "secondary" ? "Secondary" : "Elementary";
    addGovtInvoiceSheetFromBilling(workbook, billing, billing.schools, sheetName, unitRate);
  }

  const catSlug = billing.category === "all" ? "all" : billing.category;
  await downloadGovtInvoiceWorkbook(
    workbook,
    `${billing.block.toUpperCase()}_${billing.monthKey.replace(/\s+/g, "_")}_${catSlug}_invoice.xlsx`,
  );
}

export async function exportGovtInvoicePdfFromElement(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  pdf.save(filename);
}
