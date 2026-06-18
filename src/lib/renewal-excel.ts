import ExcelJS from "exceljs";
import {
  CreateRenewalInput,
  RenewalCategory,
  RenewalOwnerType,
  RenewalPeriod,
} from "../types";
import { computeNextExpiryDate } from "./renewal-helpers";
import {
  CAR_PAPER_SUBTYPE_LABELS,
  getSubtypeLabels,
  IT_RENEWAL_SUBTYPE_LABELS,
  LICENSE_SUBTYPE_LABELS,
} from "./renewals";

const BASE_HEADERS = [
  "Type",
  "Has Expiry",
  "Renewal Period",
  "Issued On",
  "Expires On",
  "Entry Date",
  "Notes",
] as const;

const CAR_PAPER_HEADERS = ["Type", "Vehicle Registration", ...BASE_HEADERS.slice(1)] as const;

const IT_RENEWAL_HEADERS = [
  "Type",
  "Name",
  "Owner Type",
  "Client Name",
  "Amount",
  ...BASE_HEADERS.slice(1),
] as const;

const LICENSE_HEADERS = ["Type", "Description", ...BASE_HEADERS.slice(1)] as const;

export function getRenewalExcelHeaders(category: RenewalCategory): readonly string[] {
  if (category === "car_papers") return CAR_PAPER_HEADERS;
  if (category === "it_renewals") return IT_RENEWAL_HEADERS;
  return LICENSE_HEADERS;
}

function categorySlug(category: RenewalCategory): string {
  if (category === "car_papers") return "car_papers";
  if (category === "it_renewals") return "it_renewals";
  return "licenses";
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: string }).text ?? "").trim();
  }
  if (value instanceof Date) {
    const d = value;
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  }
  return String(value).trim();
}

function headerKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeBool(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "yes" || value === "y" || value === "true" || value === "1";
}

function normalizePeriod(raw: string): RenewalPeriod {
  const value = raw.trim().toLowerCase();
  return value.startsWith("month") ? "monthly" : "yearly";
}

function normalizeOwnerType(raw: string): RenewalOwnerType {
  const value = raw.trim().toLowerCase();
  return value === "client" ? "client" : "mine";
}

function resolveSubType(
  category: RenewalCategory,
  rawType: string,
  subtypeLabels: Record<string, string>,
): string {
  const trimmed = rawType.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const direct = Object.keys(subtypeLabels).find((key) => key.toLowerCase() === lower);
  if (direct) return direct;
  const byLabel = Object.entries(subtypeLabels).find(
    ([, label]) => label.toLowerCase() === lower,
  );
  return byLabel?.[0] || "";
}

function sampleRow(category: RenewalCategory): (string | number)[] {
  const today = new Date().toISOString().slice(0, 10);
  const [y, m, d] = today.split("-");
  const issued = `${d}-${m}-${y}`;
  const expires = `${d}-${m}-${Number(y) + 1}`;

  if (category === "car_papers") {
    return [
      "Insurance",
      "KA-01-AB-1234",
      "Yes",
      "Yearly",
      issued,
      expires,
      today,
      "Sample vehicle insurance renewal",
    ];
  }
  if (category === "it_renewals") {
    return [
      "Domain",
      "example.com",
      "Mine",
      "",
      "1200",
      "Yes",
      "Yearly",
      issued,
      expires,
      today,
      "Sample domain renewal",
    ];
  }
  return [
    "Travel Plus",
    "Annual license renewal",
    "Yes",
    "Yearly",
    issued,
    expires,
    today,
    "Sample license entry",
  ];
}

export async function downloadRenewalExcelTemplate(
  category: RenewalCategory,
  isSample = false,
): Promise<void> {
  const headers = getRenewalExcelHeaders(category);
  const subtypeLabels = getSubtypeLabels(category);
  const workbook = new ExcelJS.Workbook();
  const sheetName =
    category === "car_papers"
      ? "Car Papers"
      : category === "it_renewals"
        ? "IT Renewals"
        : "Licenses";
  const ws = workbook.addWorksheet(sheetName);
  ws.addRow([...headers]);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF791A" } };
  if (isSample) {
    ws.addRow(sampleRow(category));
  }
  ws.columns.forEach((col) => {
    col.width = 18;
  });

  const typeList = Object.values(subtypeLabels).join(",");
  const typeCol = headers.indexOf("Type") + 1;
  if (typeCol > 0) {
    for (let row = 2; row <= 500; row += 1) {
      ws.getCell(row, typeCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${typeList}"`],
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = isSample
    ? `${categorySlug(category)}_renewals_sample.xlsx`
    : `${categorySlug(category)}_renewals_template.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function parseRenewalsWorkbook(
  buffer: ArrayBuffer,
  category: RenewalCategory,
): Promise<CreateRenewalInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const subtypeLabels = getSubtypeLabels(category);
  const headerRow = sheet.getRow(1);
  const colMap: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const key = headerKey(cellText(cell.value));
    if (key) colMap[key] = col;
  });

  const pick = (row: ExcelJS.Row, ...aliases: string[]): string => {
    for (const alias of aliases) {
      const col = colMap[headerKey(alias)];
      if (col) return cellText(row.getCell(col).value);
    }
    return "";
  };

  const items: CreateRenewalInput[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const subType = resolveSubType(category, pick(row, "type"), subtypeLabels);
    const title =
      category === "car_papers"
        ? pick(row, "vehicle registration", "registration", "title").toUpperCase()
        : category === "it_renewals"
          ? pick(row, "name", "title", "domain", "server")
          : pick(row, "description", "title", "name");

    if (!subType && !title) return;

    const hasExpiry = normalizeBool(pick(row, "has expiry", "expiry"));
    const renewalPeriod = normalizePeriod(pick(row, "renewal period", "period"));
    let issuedOn = pick(row, "issued on", "issued", "renewal date");
    let expiresOn = pick(row, "expires on", "expires", "expiry date");
    if (hasExpiry && issuedOn && !expiresOn) {
      expiresOn = computeNextExpiryDate(issuedOn, renewalPeriod);
    }

    const ownerType = normalizeOwnerType(pick(row, "owner type", "owner"));
    const clientName = pick(row, "client name", "client");
    const amount = pick(row, "amount");
    const entryDate = pick(row, "entry date") || new Date().toISOString().slice(0, 10);
    const notes = pick(row, "notes", "remarks");

    items.push({
      category,
      subType: subType || Object.keys(subtypeLabels)[0] || "",
      title,
      clientName: ownerType === "client" ? clientName : "",
      ownerType,
      amount,
      hasExpiry,
      issuedOn,
      expiresOn: hasExpiry ? expiresOn : "",
      renewalDate: issuedOn,
      expiryDate: hasExpiry ? expiresOn : "",
      notes,
      entryDate,
      renewalPeriod,
    });
  });

  return items;
}

export function validateRenewalImportRow(
  row: CreateRenewalInput,
  category: RenewalCategory,
  subtypeLabels: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!row.subType.trim() || !Object.prototype.hasOwnProperty.call(subtypeLabels, row.subType)) {
    errors.subType = "Valid type is required.";
  }
  if (category === "car_papers" && !row.title.trim()) {
    errors.title = "Vehicle registration is required.";
  }
  if (category === "it_renewals") {
    if (!row.title.trim()) errors.title = "Name is required.";
    if (row.ownerType === "client" && !row.clientName.trim()) {
      errors.clientName = "Client name is required for client renewals.";
    }
  }
  if (row.hasExpiry && !row.expiresOn.trim()) {
    errors.expiresOn = "Expires on is required when expiry is enabled.";
  }
  return errors;
}
