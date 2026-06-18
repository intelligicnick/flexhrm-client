import React, { useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  Gavel,
  Plus,
  Search,
  Trash2,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { resolveGemBidPdfUrl, resolveGemBidSearchUrl } from "../lib/gem-helpers";
import {
  Tender,
  TenderType,
  TenderStatus,
  CreateTenderInput,
} from "../types";
import {
  parseFlexibleDateMs,
  matchesIsoDateRange,
  formatAppDate,
  formatFiledDateStamp,
  formatTenderFiledDate,
  composeTenderEndDateFromDateTimeLocal,
  APP_TIMEZONE,
} from "../lib/date-helpers";
import DateRangeField from "./ui/DateRangeField";
import { DateInput, DateTimeInput } from "./ui/DateInput";

const STATUS_LABELS: Record<TenderStatus, string> = {
  not_filed: "Not Participated",
  not_evaluated: "Participated and Not Evaluated",
  filed: "Participated and Not Evaluated",
  technical_qualified: "Technical Qualified",
  qualified: "Qualified",
  disqualified: "Disqualified",
  technical_not_open: "Technical Not Open",
  cancelled: "Cancelled",
  representation_asked: "Representation Asked",
  challenged_representation: "Challenged Representation",
  financial: "Financial",
  won_bid: "Won the Bid",
};

const STATUS_STYLES: Record<TenderStatus, string> = {
  not_filed: "bg-slate-100 text-slate-600 border-slate-200",
  not_evaluated: "bg-slate-100 text-slate-700 border-slate-200",
  filed: "bg-sky-50 text-sky-700 border-sky-200",
  technical_qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disqualified: "bg-red-50 text-red-700 border-red-200",
  technical_not_open: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-slate-200 text-slate-500 border-slate-300",
  representation_asked: "bg-violet-50 text-violet-700 border-violet-200",
  challenged_representation: "bg-purple-50 text-purple-700 border-purple-200",
  financial: "bg-blue-50 text-blue-700 border-blue-200",
  won_bid: "bg-green-50 text-green-800 border-green-300",
};

const STATUS_ORDER: TenderStatus[] = [
  "not_filed",
  "filed",
  "technical_qualified",
  "technical_not_open",
  "qualified",
  "disqualified",
  "cancelled",
  "representation_asked",
  "challenged_representation",
  "financial",
  "won_bid",
];

const EMPTY_FORM: CreateTenderInput = {
  bidNo: "",
  category: "",
  ministry: "",
  organisation: "",
  consigneeOfficer: "",
  department: "",
  officerName: "",
  address: "",
  tenderType: "manpower",
  quantity: 0,
  rate: "",
  additionalRequirements: "",
  endDate: "",
  startDate: "",
  filedDate: "",
  preBidAt: "",
  preBidVenue: "",
  noPreBid: true,
  status: "not_filed",
  outcome: "",
  notes: "",
  description: "",
  entryDate: "",
  gemDocUrl: "",
  gemCurrentStage: "",
};

function parseEndDateMs(value: string): number | null {
  return parseFlexibleDateMs(value);
}

const NEAR_PARTICIPATION_MS = 7 * 24 * 60 * 60 * 1000;

function isTenderDeleted(tender: Tender): boolean {
  return Boolean(tender.deletedAt?.trim());
}

function isMissedParticipation(tender: Tender): boolean {
  if (isTenderDeleted(tender) || tender.status !== "not_filed") return false;
  const ts = parseEndDateMs(tender.endDate);
  return ts !== null && ts < Date.now();
}

function isNearNotParticipated(tender: Tender): boolean {
  if (tender.status !== "not_filed" || isTenderDeleted(tender)) return false;
  const ts = parseEndDateMs(tender.endDate);
  if (ts === null) return false;
  const now = Date.now();
  return ts >= now && ts - now <= NEAR_PARTICIPATION_MS;
}

function tenderOrganisation(tender: Tender): string {
  return tender.organisation?.trim() || tender.department?.trim() || "";
}

const MANPOWER_TERM_RE =
  /tenure|basic pay|provident fund|esi|working days|duration of employment|estimated bid|in months|in inr/i;

function isLikelyConsigneeName(value: string): boolean {
  const name = value.trim().replace(/^[\d.]+\s+/, "");
  if (!name || !/[A-Za-z]/.test(name)) return false;
  if (MANPOWER_TERM_RE.test(name)) return false;
  if (/^(consignee|reporting|officer)$/i.test(name)) return false;
  if (/^number of\b/i.test(name)) return false;
  if (/^address\s*:/i.test(name)) return false;
  return true;
}

function extractConsigneeFromText(text: string): string {
  const patterns = [
    /consignee\s+reporting\s*\/?\s*officer\s*[:\-–]?\s*([A-Za-z][A-Za-z\s.'-]{1,80}?)(?=\s*,|\s+address|\n|$)/i,
    /(?:^|[\n,])\s*\d+\s+([A-Z][A-Za-z]+(?:\s+[A-Za-z.'-]+){1,4})\s*(?:\n|,|\d{6})/m,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim() ?? "";
    if (isLikelyConsigneeName(candidate)) return candidate.replace(/^\d+\s+/, "").trim();
  }
  return "";
}

function formatManpowerRequirements(text: string): string {
  const value = text.trim();
  if (!value) return "";

  const splitRe =
    /(?=Tenure\s*\/?\s*Duration|Basic Pay|Provident Fund|ESI\s*\(|Number of working days|Estimated Bid Value)/i;
  const parts = value
    .split(splitRe)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    return parts.join("\n");
  }

  return value.replace(/\s{2,}/g, " ");
}

function tenderDepartment(tender: Tender): string {
  const org = tenderOrganisation(tender);
  const dept = tender.department?.trim() || "";
  if (!dept || dept === org) return "";
  return dept;
}

function tenderConsignee(tender: Tender): string {
  const raw = tender.consigneeOfficer?.trim() || tender.officerName?.trim() || "";
  if (isLikelyConsigneeName(raw)) return raw.replace(/^\d+\s+/, "").trim();

  const fromRaw = extractConsigneeFromText(raw);
  if (fromRaw) return fromRaw;

  const addReq = tender.additionalRequirements?.trim() || "";
  const fromAddReq = extractConsigneeFromText(addReq);
  if (fromAddReq) return fromAddReq;

  return "";
}

function tenderAdditionalRequirements(tender: Tender): string {
  const parts: string[] = [];
  const addReq = tender.additionalRequirements?.trim();
  if (addReq) parts.push(addReq);

  const rawOfficer = tender.consigneeOfficer?.trim() || tender.officerName?.trim() || "";
  if (
    rawOfficer &&
    MANPOWER_TERM_RE.test(rawOfficer) &&
    !parts.some((part) => part.includes(rawOfficer.slice(0, 24)))
  ) {
    parts.push(rawOfficer);
  }

  return formatManpowerRequirements(parts.join("\n"));
}

function tenderMatchesSearch(tender: Tender, term: string): boolean {
  return [
    tender.bidNo,
    tender.category,
    tender.ministry,
    tenderOrganisation(tender),
    tenderConsignee(tender),
    tender.address,
    tenderAdditionalRequirements(tender),
    tender.outcome,
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

function tenderSortPriority(tender: Tender): number {
  if (isTenderDeleted(tender)) return 4;
  if (isMissedParticipation(tender)) return 0;
  if (isNearNotParticipated(tender)) return 1;
  return 2;
}

function compareTenders(a: Tender, b: Tender): number {
  const pa = tenderSortPriority(a);
  const pb = tenderSortPriority(b);
  if (pa !== pb) return pa - pb;
  const aTs = parseEndDateMs(a.endDate) ?? 0;
  const bTs = parseEndDateMs(b.endDate) ?? 0;
  if (pa <= 1) return aTs - bTs;
  return bTs - aTs;
}

function isStatusLocked(tender: Tender): boolean {
  return isTenderDeleted(tender) || isMissedParticipation(tender);
}

function tenderMatchesDateRange(
  tender: Tender,
  field: "endDate" | "filedDate",
  from: string,
  to: string,
): boolean {
  const ts = parseFlexibleDateMs(field === "filedDate" ? tender.filedDate : tender.endDate);
  return matchesIsoDateRange(ts, from, to);
}

function calendarDaysUntilEnd(endMs: number, nowMs = Date.now()): number {
  const dayKey = (ms: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(ms));
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((dayKey(endMs) - dayKey(nowMs)) / (1000 * 60 * 60 * 24));
}

function deadlineMeta(endDate: string): {
  label: string;
  cellClassName: string;
  urgent: boolean;
  band: "passed" | "critical" | "warning" | "orange" | "ok" | "none";
} {
  const ts = parseEndDateMs(endDate);
  if (!endDate.trim()) {
    return {
      label: "—",
      cellClassName: "text-slate-400",
      urgent: false,
      band: "none",
    };
  }
  const withTime = /\d{1,2}:\d{2}/.test(endDate);
  const formatted = formatAppDate(endDate, { withTime });
  if (ts === null) {
    return {
      label: formatted,
      cellClassName: "text-slate-700",
      urgent: false,
      band: "ok",
    };
  }

  const daysLeft = calendarDaysUntilEnd(ts);

  if (daysLeft < 0) {
    return {
      label: formatted,
      cellClassName: "bg-red-200 text-red-950 font-bold",
      urgent: true,
      band: "passed",
    };
  }
  if (daysLeft <= 2) {
    return {
      label: formatted,
      cellClassName: "bg-red-100 text-red-800 font-bold",
      urgent: true,
      band: "critical",
    };
  }
  if (daysLeft <= 5) {
    return {
      label: formatted,
      cellClassName: "bg-rose-100 text-rose-800 font-bold",
      urgent: true,
      band: "warning",
    };
  }
  if (daysLeft <= 10) {
    return {
      label: formatted,
      cellClassName: "bg-orange-100 text-orange-800 font-semibold",
      urgent: true,
      band: "orange",
    };
  }
  return {
    label: formatted,
    cellClassName: "bg-emerald-100 text-emerald-800 font-semibold",
    urgent: false,
    band: "ok",
  };
}

function tenderDeadlineCellClass(
  tender: Tender,
  deadline: ReturnType<typeof deadlineMeta>,
): string {
  if (isTenderDeleted(tender) || tender.status !== "not_filed") {
    return "text-slate-600";
  }
  return deadline.cellClassName;
}

function formatStatusSyncedAt(value?: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  return formatAppDate(raw, { withTime: true });
}

function normalizeTenderStatus(raw: string): TenderStatus {
  const value = raw.trim().toLowerCase();
  if (value.includes("not participated") || value.includes("not filed")) return "not_filed";
  if (value.includes("participated") || value.includes("not evaluated")) return "filed";
  if (value.includes("won") && value.includes("bid")) return "won_bid";
  if (value.includes("challenged") && value.includes("representation")) {
    return "challenged_representation";
  }
  if (value.includes("representation")) return "representation_asked";
  if (value.includes("financial")) return "financial";
  if (value.includes("technical") && value.includes("qualified")) {
    return "technical_qualified";
  }
  if (value.includes("qualified") && !value.includes("disqualified")) {
    return "qualified";
  }
  if (value.includes("disqualified")) return "disqualified";
  if (value.includes("technical")) return "technical_not_open";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("filed") || value.includes("bid awarded")) return "filed";
  return "filed";
}

function looksLikeStatus(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 80) return false;
  return (
    value.includes("evaluated") ||
    value.includes("qualified") ||
    value.includes("disqualified") ||
    value.includes("technical") ||
    value.includes("cancel") ||
    value.includes("participated") ||
    value.includes("filed") ||
    value.includes("representation") ||
    value.includes("financial") ||
    value.includes("won") ||
    value.includes("bid awarded")
  );
}

function parsePreBidCell(raw: string): { noPreBid: boolean; preBidAt: string } {
  const value = raw.trim();
  if (!value || /^no pre bid$/i.test(value) || /^n\/a$/i.test(value)) {
    return { noPreBid: true, preBidAt: "" };
  }
  if (/^\d/.test(value)) {
    return { noPreBid: false, preBidAt: value };
  }
  return { noPreBid: true, preBidAt: "" };
}

function formatPreBidLabel(tender: Tender): string {
  if (tender.noPreBid || !tender.preBidAt.trim()) return "No Pre Bid";
  return tender.preBidAt;
}

function formatPreBidVenueLabel(tender: Tender): string {
  if (tender.noPreBid || !tender.preBidVenue?.trim()) return "—";
  return tender.preBidVenue;
}

function isFiledBucket(status: TenderStatus): boolean {
  return status === "filed" || status === "not_evaluated";
}

function selectableStatuses(current: TenderStatus): TenderStatus[] {
  if (current === "not_filed") return STATUS_ORDER;
  return STATUS_ORDER.filter((status) => status !== "not_filed" && status !== "not_evaluated");
}

function truncatePreview(
  text: string,
  max = 40,
): { preview: string; truncated: boolean } {
  const value = text.trim();
  if (!value) return { preview: "—", truncated: false };
  if (value.length <= max) return { preview: value, truncated: false };
  return { preview: `${value.slice(0, max)}…`, truncated: true };
}

function TenderExpandedDetails({ tender }: { tender: Tender }) {
  const consignee = tenderConsignee(tender);
  const addReq = tenderAdditionalRequirements(tender);
  const department = tenderDepartment(tender);

  const sections = [
    {
      title: "Bid details",
      fields: [
        {
          label: "Bid number",
          value: tender.bidNo,
          href: resolveGemBidPdfUrl(tender) ?? resolveGemBidSearchUrl(tender.bidNo),
        },
        { label: "Item category", value: tender.category },
        { label: "Type", value: tender.tenderType === "travel" ? "Car tenders" : "Manpower" },
        { label: "Quantity", value: tender.quantity ? String(tender.quantity) : "" },
        { label: "Estimated bid value", value: tender.rate },
        { label: "Bid end date", value: formatAppDate(tender.endDate, { withTime: /\d{1,2}:\d{2}/.test(tender.endDate) }) },
        { label: "Participation filed", value: tender.filedDate ? formatTenderFiledDate(tender.filedDate) : "" },
        { label: "Last GeM sync", value: formatStatusSyncedAt(tender.statusSyncedAt) },
      ],
    },
    {
      title: "Buyer / consignee (as per PDF)",
      fields: [
        { label: "Ministry / State", value: tender.ministry },
        { label: "Organisation", value: tenderOrganisation(tender) },
        { label: "Department", value: department },
        { label: "Consignee Reporting/Officer", value: consignee },
        { label: "Address", value: tender.address },
      ],
    },
    {
      title: "Additional requirements",
      fields: [{ label: "Manpower / service terms", value: addReq }],
    },
    {
      title: "Pre-bid & notes",
      fields: [
        { label: "Pre-bid date & time", value: formatPreBidLabel(tender) },
        { label: "Pre-bid venue", value: formatPreBidVenueLabel(tender) },
        { label: "Notes", value: tender.notes },
      ],
    },
  ]
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => field.value && field.value !== "—"),
    }))
    .filter((section) => section.fields.length > 0);

  return (
    <div className="rounded-xl border border-orange-100 bg-linear-to-br from-orange-50/80 via-white to-slate-50 p-4 shadow-xs space-y-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#ff791a] mb-2 flex items-center gap-1.5">
            <span className="w-1 h-3 rounded-full bg-[#ff791a]" />
            {section.title}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {section.fields.map((field) => (
              <div
                key={field.label}
                className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                  {field.label}
                </p>
                {"href" in field && field.href ? (
                  <a
                    href={field.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-sm text-sky-700 hover:text-sky-900 hover:underline"
                  >
                    {field.value}
                    <ExternalLink size={11} className="opacity-70" />
                  </a>
                ) : (
                  <p className="text-slate-700 text-xs whitespace-pre-line leading-relaxed">{field.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const TABLE_COL_SPAN = 19;

function splitLegacyPreBid(preBidAt: string): { at: string; venue: string } {
  const match = preBidAt.trim().match(/^(.+?)\s+@\s+(.+)$/);
  if (!match) return { at: preBidAt.trim(), venue: "" };
  return { at: match[1].trim(), venue: match[2].trim() };
}

function normalizeTender(row: Tender): Tender {
  const legacy = row as Tender & {
    preBidStatus?: TenderStatus;
    preBidMeetingAt?: string;
    tenderStatus?: string;
  };
  const legacyPreBid = row.preBidAt || legacy.preBidMeetingAt || "";
  const split = splitLegacyPreBid(legacyPreBid);
  const preBidAt = split.at || legacyPreBid;
  const preBidVenue = row.preBidVenue?.trim() || split.venue;
  let status = row.status || legacy.preBidStatus || "not_filed";
  if (status === "not_evaluated") status = "filed";
  return {
    ...row,
    ministry: row.ministry || "",
    organisation: row.organisation || row.department || "",
    consigneeOfficer: row.consigneeOfficer || row.officerName || "",
    department: row.organisation || row.department || "",
    officerName: row.consigneeOfficer || row.officerName || "",
    additionalRequirements: row.additionalRequirements || "",
    startDate: row.startDate || "",
    status,
    preBidAt,
    preBidVenue,
    noPreBid:
      preBidAt.trim() || preBidVenue.trim()
        ? false
        : Boolean(row.noPreBid ?? !legacy.preBidMeetingAt?.trim()),
    outcome: row.outcome || legacy.tenderStatus || "",
  };
}

function cellStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\n/g, " ").trim();
}

function parseQuantity(value: unknown): number {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

async function parseTendersWorkbook(
  buffer: ArrayBuffer,
): Promise<CreateTenderInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const items: CreateTenderInput[] = [];

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name.trim().toUpperCase();
    const isTravel = sheetName.includes("TRAVEL");
    const tenderType: TenderType = isTravel ? "travel" : "manpower";

    let headerRow = 0;
    for (let r = 1; r <= Math.min(worksheet.rowCount, 5); r++) {
      const a = cellStr(worksheet.getRow(r).getCell(1).value).toUpperCase();
      if (a.includes("BID NO") || a.startsWith("GEM/")) {
        headerRow = a.includes("BID NO") ? r : r - 1;
        if (a.startsWith("GEM/")) headerRow = 0;
        break;
      }
    }

    const startRow = headerRow > 0 ? headerRow + 1 : 1;
    for (let r = startRow; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const bidNo = cellStr(row.getCell(1).value);
      if (!bidNo || bidNo.toUpperCase().includes("INTELLIGIC") || bidNo.toUpperCase().includes("BID NO")) {
        continue;
      }
      if (!bidNo.toUpperCase().includes("GEM/") && !/^\d+$/.test(bidNo)) {
        continue;
      }
      const resolvedBidNo = bidNo.replace(/^\d+\s*/, "").trim() || bidNo;

      const preBidRaw = cellStr(row.getCell(10).value);
      const statusRaw = cellStr(row.getCell(11).value);
      const filedDateRaw = cellStr(row.getCell(9).value);
      const preBid = parsePreBidCell(preBidRaw);

      let status: TenderStatus = "not_filed";
      let outcome = "";

      if (looksLikeStatus(statusRaw)) {
        status = normalizeTenderStatus(statusRaw);
        if (statusRaw.length > 40) outcome = statusRaw;
      } else if (looksLikeStatus(preBidRaw)) {
        status = normalizeTenderStatus(preBidRaw);
        if (statusRaw) outcome = statusRaw;
      } else if (statusRaw) {
        outcome = statusRaw;
      }

      if (status === "filed" && filedDateRaw && /filed/i.test(filedDateRaw)) {
        status = "filed";
      }

      items.push({
        bidNo: resolvedBidNo,
        category: cellStr(row.getCell(2).value),
        ministry: "",
        organisation: cellStr(row.getCell(3).value),
        consigneeOfficer: cellStr(row.getCell(4).value),
        department: cellStr(row.getCell(3).value),
        officerName: cellStr(row.getCell(4).value),
        address: cellStr(row.getCell(5).value),
        tenderType,
        quantity: parseQuantity(row.getCell(6).value),
        rate: cellStr(row.getCell(7).value),
        additionalRequirements: "",
        endDate: cellStr(row.getCell(8).value),
        startDate: "",
        filedDate: filedDateRaw,
        preBidAt: preBid.preBidAt,
        noPreBid: preBid.noPreBid,
        status,
        outcome,
        notes: "",
      });
    }
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.bidNo.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type BidNumberCellProps = {
  tender: Tender;
  copiedBidId: string | null;
  onCopy: (tender: Tender) => void;
};

function BidNumberCell({ tender, copiedBidId, onCopy }: BidNumberCellProps) {
  const pdfUrl = resolveGemBidPdfUrl(tender);
  const copied = copiedBidId === tender.id;
  const deleted = isTenderDeleted(tender);
  const missed = isMissedParticipation(tender);

  return (
    <div>
      <div className="flex items-start gap-0.5">
        {pdfUrl ? (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-0.5 font-mono text-[10px] font-bold text-sky-700 hover:text-sky-900 hover:underline leading-tight"
            title="Open GeM bid PDF in new tab"
          >
            <span className="whitespace-normal break-all">{tender.bidNo}</span>
            <ExternalLink size={9} className="shrink-0 opacity-70 mt-0.5" />
          </a>
        ) : (
          <a
            href={resolveGemBidSearchUrl(tender.bidNo)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-0.5 font-mono text-[10px] font-bold text-slate-700 hover:text-sky-800 hover:underline leading-tight"
            title="Search this bid on GeM (PDF link not stored — re-import via extension to capture PDF URL)"
          >
            <span className="whitespace-normal break-all">{tender.bidNo}</span>
            <ExternalLink size={9} className="shrink-0 opacity-50 mt-0.5" />
          </a>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(tender);
          }}
          className="shrink-0 p-0.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 cursor-pointer transition"
          title={copied ? "Copied!" : "Copy bid number"}
        >
          {copied ? (
            <Check size={11} className="text-emerald-600" />
          ) : (
            <Copy size={11} />
          )}
        </button>
      </div>
      {(deleted || missed) && (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {deleted && (
            <span className="text-[9px] font-bold uppercase text-slate-400">Deleted</span>
          )}
          {missed && (
            <span className="text-[9px] font-bold uppercase text-red-600">Locked</span>
          )}
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: TenderType }) {
  const isTravel = type === "travel";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
        isTravel
          ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200/80"
          : "bg-sky-100 text-sky-700 ring-1 ring-sky-200/80"
      }`}
    >
      {isTravel ? "Car tenders" : "Manpower"}
    </span>
  );
}

interface TendersPanelProps {
  tenders: Tender[];
  readOnly?: boolean;
  initialDeadlineFilter?: "all" | "upcoming" | "passed";
  onRefresh: () => Promise<void>;
  onCreate: (payload: CreateTenderInput) => Promise<void>;
  onUpdate: (id: string, payload: Partial<CreateTenderInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (items: CreateTenderInput[]) => Promise<{ created: number; updated: number; skipped: number }>;
}

export default function TendersPanel({
  tenders,
  readOnly = false,
  initialDeadlineFilter = "all",
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onImport,
}: TendersPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | TenderType>("");
  const [statusFilter, setStatusFilter] = useState<"" | TenderStatus>("");
  const [deadlineFilter, setDeadlineFilter] = useState<"all" | "upcoming" | "passed">(initialDeadlineFilter);
  const [dateRangeField, setDateRangeField] = useState<"endDate" | "filedDate">("endDate");

  useEffect(() => {
    setDeadlineFilter(initialDeadlineFilter);
  }, [initialDeadlineFilter]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [endDateTimeLocal, setEndDateTimeLocal] = useState("");
  const [startDateIso, setStartDateIso] = useState("");
  const [filedDateIso, setFiledDateIso] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateTenderInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [expandedTenderId, setExpandedTenderId] = useState<string | null>(null);
  const [copiedBidId, setCopiedBidId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const copyBidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyBidNumber = async (tender: Tender) => {
    try {
      await navigator.clipboard.writeText(tender.bidNo);
    } catch {
      window.prompt("Copy bid number:", tender.bidNo);
      return;
    }
    setCopiedBidId(tender.id);
    if (copyBidTimeoutRef.current) clearTimeout(copyBidTimeoutRef.current);
    copyBidTimeoutRef.current = setTimeout(() => {
      setCopiedBidId((current) => (current === tender.id ? null : current));
    }, 1500);
  };

  const normalizedTenders = useMemo(
    () => tenders.map(normalizeTender),
    [tenders],
  );

  const activeTenders = useMemo(
    () => normalizedTenders.filter((t) => !isTenderDeleted(t)),
    [normalizedTenders],
  );

  const stats = useMemo(() => {
    const now = Date.now();
    let upcoming = 0;
    let passed = 0;
    let filed = 0;
    let qualified = 0;
    activeTenders.forEach((t) => {
      if (isFiledBucket(t.status) || t.filedDate.trim()) filed += 1;
      if (t.status === "qualified") qualified += 1;
      const ts = parseEndDateMs(t.endDate);
      if (ts === null) return;
      if (ts >= now) upcoming += 1;
      else passed += 1;
    });
    return { total: activeTenders.length, upcoming, passed, filed, qualified };
  }, [activeTenders]);

  const filtered = useMemo(() => {
    let rows = [...normalizedTenders];
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((t) => tenderMatchesSearch(t, term));
    } else {
      rows = rows.filter((t) => !isTenderDeleted(t));
    }
    if (typeFilter) rows = rows.filter((t) => t.tenderType === typeFilter);
    if (statusFilter) {
      rows = rows.filter((t) =>
        statusFilter === "filed" ? isFiledBucket(t.status) : t.status === statusFilter,
      );
    }
    if (deadlineFilter !== "all") {
      const now = Date.now();
      rows = rows.filter((t) => {
        const ts = parseEndDateMs(t.endDate);
        if (ts === null) return deadlineFilter === "upcoming";
        return deadlineFilter === "upcoming" ? ts >= now : ts < now;
      });
    }
    if (dateFrom || dateTo) {
      rows = rows.filter((t) => tenderMatchesDateRange(t, dateRangeField, dateFrom, dateTo));
    }
    return rows.sort(compareTenders);
  }, [normalizedTenders, search, typeFilter, statusFilter, deadlineFilter, dateRangeField, dateFrom, dateTo]);

  const clearDateRange = () => {
    setDateFrom("");
    setDateTo("");
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEndDateTimeLocal("");
    setStartDateIso("");
    setFiledDateIso("");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.bidNo.trim()) {
      setToast("Bid number is required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateTenderInput = {
        ...form,
        status: "not_filed",
        filedDate: filedDateIso,
        startDate: startDateIso,
        endDate: composeTenderEndDateFromDateTimeLocal(endDateTimeLocal),
        organisation: form.organisation || form.department,
        consigneeOfficer: form.consigneeOfficer || form.officerName,
        department: form.organisation || form.department,
        officerName: form.consigneeOfficer || form.officerName,
      };
      await onCreate(payload);
      setModalOpen(false);
      setToast("Tender added.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (tender: Tender, status: TenderStatus) => {
    const nextStatus = isFiledBucket(status) ? "filed" : status;
    if (isStatusLocked(tender)) {
      setToast(
        isTenderDeleted(tender)
          ? "Deleted tenders cannot be updated."
          : "Deadline passed without participation — status is locked.",
      );
      return;
    }
    if (
      tender.status === nextStatus ||
      (isFiledBucket(tender.status) && nextStatus === "filed")
    ) {
      return;
    }
    if (nextStatus === "not_filed" && tender.status !== "not_filed") {
      setToast("Status cannot be changed back to Not Participated.");
      return;
    }
    setUpdatingStatusId(tender.id);
    try {
      const patch: Partial<CreateTenderInput> = { status: nextStatus };
      if (tender.status === "not_filed" && nextStatus === "filed") {
        patch.filedDate = formatFiledDateStamp();
      }
      await onUpdate(tender.id, patch);
      setToast(`${tender.bidNo} → ${STATUS_LABELS[nextStatus]}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const toggleExpandedRow = (tenderId: string) => {
    setExpandedTenderId((current) => (current === tenderId ? null : tenderId));
  };

  const handleDelete = async (tender: Tender) => {
    if (isMissedParticipation(tender)) {
      setToast("Deadline passed without participation — tender cannot be deleted.");
      return;
    }
    if (isTenderDeleted(tender)) return;
    if (!window.confirm(`Delete tender ${tender.bidNo}?`)) return;
    try {
      await onDelete(tender.id);
      setToast("Tender deleted.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const items = await parseTendersWorkbook(buffer);
      if (items.length === 0) {
        setToast("No tender rows found in the spreadsheet.");
        return;
      }
      const result = await onImport(items);
      setToast(`Import complete: ${result.created} added, ${result.updated} updated, ${result.skipped} skipped.`);
      await onRefresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const hasActiveFilters =
    Boolean(typeFilter || statusFilter || deadlineFilter !== "all" || dateFrom || dateTo || search.trim());

  const applyQuickFilter = (key: "all" | "filed" | "qualified" | "upcoming" | "passed") => {
    if (key === "all") {
      setTypeFilter("");
      setStatusFilter("");
      setDeadlineFilter("all");
      setSearch("");
      clearDateRange();
      return;
    }
    if (key === "filed") {
      setStatusFilter("filed");
      setDeadlineFilter("all");
      return;
    }
    if (key === "qualified") {
      setStatusFilter("qualified");
      setDeadlineFilter("all");
      return;
    }
    setStatusFilter("");
    setDeadlineFilter(key);
  };

  const statCards = [
    {
      key: "all" as const,
      label: "Total",
      value: stats.total,
      icon: FileSpreadsheet,
      tone: "text-slate-700",
      bg: "bg-white",
      ring: "ring-slate-200",
      active: !hasActiveFilters,
    },
    {
      key: "filed" as const,
      label: "Participated",
      value: stats.filed,
      icon: CheckCircle2,
      tone: "text-sky-600",
      bg: "bg-sky-50",
      ring: "ring-sky-200",
      active: statusFilter === "filed",
    },
    {
      key: "qualified" as const,
      label: "Qualified",
      value: stats.qualified,
      icon: Gavel,
      tone: "text-emerald-600",
      bg: "bg-emerald-50",
      ring: "ring-emerald-200",
      active: statusFilter === "qualified",
    },
    {
      key: "upcoming" as const,
      label: "Upcoming",
      value: stats.upcoming,
      icon: Clock,
      tone: "text-amber-600",
      bg: "bg-amber-50",
      ring: "ring-amber-200",
      active: deadlineFilter === "upcoming" && !statusFilter,
    },
    {
      key: "passed" as const,
      label: "Passed",
      value: stats.passed,
      icon: AlertTriangle,
      tone: "text-red-600",
      bg: "bg-red-50",
      ring: "ring-red-200",
      active: deadlineFilter === "passed" && !statusFilter,
    },
  ];

  const selectClass =
    "px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none transition";

  return (
    <section className="flex-1 flex flex-col min-h-[400px] min-w-0 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="relative border-b border-slate-100 bg-linear-to-r from-[#fff7f0] via-white to-slate-50 px-5 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,121,26,0.08),transparent_55%)] pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#ff791a]">
                Intelligic Solutions
              </p>
              <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
                {activeTenders.length} active
              </span>
            </div>
            <h2 className="font-extrabold text-slate-900 text-xl flex items-center gap-2.5 tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e293b] text-[#ff791a] shadow-sm">
                <Gavel size={18} />
              </span>
              GeM Tenders
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Manpower &amp; Car tenders bids — track deadlines, filing and evaluation status
            </p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs transition"
              >
                <Upload size={14} />
                {importing ? "Importing…" : "Import Excel"}
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="px-3.5 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-200/50 transition"
              >
                <Plus size={14} />
                Add Tender
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pt-4 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4">
          {statCards.map(({ key, label, value, icon: Icon, tone, bg, ring, active }) => (
            <button
              key={key}
              type="button"
              onClick={() => applyQuickFilter(key)}
              className={`rounded-xl border text-left px-3.5 py-3 transition-all cursor-pointer ${
                active
                  ? `${bg} border-transparent ring-2 ${ring} shadow-sm`
                  : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <Icon size={14} className={tone} />
              </div>
              <p className={`text-2xl font-extrabold tabular-nums mt-1 ${tone}`}>{value}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 space-y-3 mb-3">
          <div className="flex flex-col lg:flex-row flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bid no., dept, category, outcome… (includes deleted)"
                className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none transition"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "" | TenderType)}
              className={selectClass}
            >
              <option value="">All types</option>
              <option value="manpower">Manpower</option>
              <option value="travel">Car tenders</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | TenderStatus)}
              className={selectClass}
            >
              <option value="">All status</option>
              {STATUS_ORDER.map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABELS[key]}
                </option>
              ))}
            </select>
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value as typeof deadlineFilter)}
              className={selectClass}
            >
              <option value="all">All deadlines</option>
              <option value="upcoming">Upcoming</option>
              <option value="passed">Passed</option>
            </select>
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white hover:bg-slate-50 flex items-center gap-1.5 font-semibold text-slate-600 transition"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => applyQuickFilter("all")}
                className="px-3.5 py-2.5 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-1 transition"
              >
                <X size={12} />
                Clear filters
              </button>
            )}
          </div>

          <DateRangeField
            field={dateRangeField}
            fieldOptions={[
              { value: "endDate", label: "End date" },
              { value: "filedDate", label: "Filed date" },
            ]}
            onFieldChange={(value) => setDateRangeField(value as "endDate" | "filedDate")}
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            onClear={clearDateRange}
          />
        </div>

        {toast && (
          <div className="mb-3 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs flex items-center justify-between shadow-lg animate-fade-in">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast(null)} className="cursor-pointer ml-3 p-0.5 rounded hover:bg-white/10">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-20 px-5">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-orange-100 to-orange-50 flex items-center justify-center mx-auto shadow-sm ring-1 ring-orange-100">
              <Gavel size={30} className="text-[#ff791a]" />
            </div>
            <div>
              <p className="text-base text-slate-800 font-bold">
                {hasActiveFilters ? "No tenders match your filters" : "No tenders yet"}
              </p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {hasActiveFilters
                  ? "Try clearing filters or broadening your search."
                  : "Add tenders manually or import your TENDERS.xlsx workbook to get started."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => applyQuickFilter("all")}
                  className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                >
                  Clear filters
                </button>
              )}
              {!readOnly && !hasActiveFilters && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1.5 transition"
                  >
                    <Upload size={13} />
                    Import Excel
                  </button>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="px-4 py-2 text-xs font-bold bg-[#ff791a] hover:bg-[#e4640c] text-white rounded-xl flex items-center gap-1.5 transition"
                  >
                    <Plus size={13} />
                    Add Tender
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 min-h-0 px-5 pb-5">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-20rem)] border border-slate-200/80 rounded-xl shadow-xs scrollbar-thin bg-white">
            <table className="w-full text-xs min-w-[1760px] table-fixed">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="bg-slate-100/90 text-left text-[9px] uppercase tracking-wider text-slate-500 backdrop-blur-sm">
                  <th className="w-8 px-1 py-1.5" aria-label="Expand" />
                  <th colSpan={3} className="px-2 py-1.5 font-bold border-l border-slate-200/80 text-[#ff791a]">
                    Bid
                  </th>
                  <th colSpan={5} className="px-2 py-1.5 font-bold border-l border-slate-200/80 text-slate-600">
                    Buyer / Consignee
                  </th>
                  <th colSpan={2} className="px-2 py-1.5 font-bold border-l border-slate-200/80 text-slate-600">
                    Terms
                  </th>
                  <th colSpan={5} className="px-2 py-1.5 font-bold border-l border-slate-200/80 text-slate-600">
                    Dates & Pre-Bid
                  </th>
                  <th className="px-2 py-1.5 font-bold border-l border-slate-200/80 text-slate-600">Status</th>
                  <th className="px-2 py-1.5 font-bold border-l border-slate-200/80 text-slate-600">Last Updated</th>
                  {!readOnly && <th className="w-10 px-1 py-1.5 border-l border-slate-200/80" aria-label="Actions" />}
                </tr>
                <tr className="bg-white text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="w-8 px-1 py-2.5 font-semibold" aria-label="Expand" />
                  <th className="min-w-[200px] px-2 py-2.5 font-semibold">Bid No.</th>
                  <th className="w-[88px] min-w-[88px] px-2 py-2.5 font-semibold">Type</th>
                  <th className="w-[150px] px-2 py-2.5 font-semibold">Category</th>
                  <th className="w-[100px] px-2 py-2.5 font-semibold border-l border-slate-100">Ministry</th>
                  <th className="w-[110px] px-2 py-2.5 font-semibold">Organisation</th>
                  <th className="w-[100px] px-2 py-2.5 font-semibold">Department</th>
                  <th className="w-[110px] px-2 py-2.5 font-semibold">Address</th>
                  <th className="w-[120px] px-2 py-2.5 font-semibold leading-tight normal-case">
                    <span className="block text-[9px] uppercase text-slate-400">Consignee</span>
                    <span className="block font-semibold">Reporting/Officer</span>
                  </th>
                  <th className="w-[44px] px-2 py-2.5 font-semibold text-right border-l border-slate-100">Qty</th>
                  <th className="w-[140px] px-2 py-2.5 font-semibold">Add. Req.</th>
                  <th className="min-w-[148px] px-2 py-2.5 font-semibold border-l border-slate-100">End Date</th>
                  <th className="min-w-[132px] px-2 py-2.5 font-semibold">Filed</th>
                  <th className="w-[88px] px-2 py-2.5 font-semibold">Entry</th>
                  <th className="w-[108px] px-2 py-2.5 font-semibold">Pre-Bid</th>
                  <th className="w-[120px] px-2 py-2.5 font-semibold">Pre-Bid Venue</th>
                  <th className="w-[132px] px-2 py-2.5 font-semibold border-l border-slate-100">Status</th>
                  <th className="min-w-[140px] px-2 py-2.5 font-semibold border-l border-slate-100 leading-tight">
                    <span className="block">Last Updated</span>
                    <span className="block text-[9px] normal-case text-slate-400">GeM sync</span>
                  </th>
                  {!readOnly && <th className="w-10 px-1 py-2.5 font-semibold" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tender, idx) => {
                  const deadline = deadlineMeta(tender.endDate);
                  const deadlineCellClass = tenderDeadlineCellClass(tender, deadline);
                  const addReqText = tenderAdditionalRequirements(tender);
                  const addReqPreview = truncatePreview(addReqText, 36);
                  const consignee = tenderConsignee(tender);
                  const department = tenderDepartment(tender);
                  const venuePreview = truncatePreview(formatPreBidVenueLabel(tender), 34);
                  const isExpanded = expandedTenderId === tender.id;
                  const deleted = isTenderDeleted(tender);
                  const locked = isStatusLocked(tender);
                  const urgentNotParticipated =
                    isNearNotParticipated(tender) || isMissedParticipation(tender);
                  const rowBg = deleted
                    ? "bg-slate-100/80"
                    : urgentNotParticipated
                      ? "bg-amber-50/50"
                      : idx % 2 === 0
                        ? "bg-white"
                        : "bg-slate-50/40";

                  return (
                    <React.Fragment key={tender.id}>
                    <tr
                      className={`border-t border-slate-100 hover:bg-orange-50/50 transition-colors ${rowBg} ${isExpanded ? "bg-orange-50/60 ring-1 ring-inset ring-orange-200" : ""}`}
                    >
                      <td className="px-1 py-2 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => toggleExpandedRow(tender.id)}
                          className={`p-1 rounded-lg cursor-pointer transition ${
                            isExpanded
                              ? "bg-orange-100 text-orange-700"
                              : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          }`}
                          title="Show full details"
                        >
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </button>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <BidNumberCell
                          tender={tender}
                          copiedBidId={copiedBidId}
                          onCopy={copyBidNumber}
                        />
                      </td>
                      <td className="px-2 py-2 align-middle overflow-hidden">
                        <TypeBadge type={tender.tenderType} />
                      </td>
                      <td className="px-2 py-2 align-middle min-w-0 overflow-hidden">
                        <p className="text-slate-700 truncate" title={tender.category}>
                          {tender.category || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-2 align-middle border-l border-slate-100/80">
                        <p className="text-slate-600 truncate" title={tender.ministry}>
                          {tender.ministry || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <p className="text-slate-700 truncate" title={tenderOrganisation(tender) || "—"}>
                          {tenderOrganisation(tender) || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <p className="text-slate-600 truncate" title={department || "Same as organisation"}>
                          {department || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <p className="text-slate-600 truncate" title={tender.address}>
                          {tender.address || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <p
                          className={`truncate ${consignee ? "text-slate-800 font-medium" : "text-slate-300"}`}
                          title={consignee || "Not extracted from PDF"}
                        >
                          {consignee || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-2 align-middle text-right tabular-nums font-semibold text-slate-800 border-l border-slate-100/80">
                        {tender.quantity || "—"}
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <button
                          type="button"
                          onClick={() => toggleExpandedRow(tender.id)}
                          className={`text-left w-full truncate ${addReqPreview.truncated ? "text-orange-700 hover:underline cursor-pointer" : addReqText ? "text-slate-700 cursor-pointer" : "text-slate-300 cursor-pointer"}`}
                          title={addReqText || "—"}
                        >
                          {addReqPreview.preview}
                        </button>
                      </td>
                      <td className="px-2 py-2 align-middle min-w-[148px] border-l border-slate-100/80">
                        <span className={`inline-flex items-start gap-1 leading-tight rounded-lg px-2 py-1 text-[11px] ${deadlineCellClass}`}>
                          {deadline.urgent && deadline.label !== "—" && (
                            <Clock size={10} className="shrink-0 mt-0.5" />
                          )}
                          <span className="whitespace-normal break-words">{deadline.label}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 align-middle min-w-[132px]">
                        {tender.filedDate ? (
                          <span className="text-sky-700 font-medium whitespace-normal break-words leading-tight block">
                            {formatTenderFiledDate(tender.filedDate)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-middle whitespace-nowrap text-slate-600 truncate">
                        {tender.entryDate ? formatAppDate(tender.entryDate) : tender.createdAt ? formatAppDate(tender.createdAt) : "—"}
                      </td>
                      <td className="px-2 py-2 align-middle whitespace-nowrap text-slate-600 truncate">
                        {formatPreBidLabel(tender)}
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <button
                          type="button"
                          onClick={() => toggleExpandedRow(tender.id)}
                          className={`text-left w-full truncate ${venuePreview.truncated ? "text-orange-700 hover:underline cursor-pointer" : "text-slate-600 cursor-pointer"}`}
                          title={formatPreBidVenueLabel(tender)}
                        >
                          {venuePreview.preview}
                        </button>
                      </td>
                      <td className="px-2 py-2 align-middle border-l border-slate-100/80">
                        {readOnly || locked ? (
                          <span
                            className={`inline-flex max-w-full items-center px-2 py-0.5 rounded-full text-[10px] font-bold border truncate ${STATUS_STYLES[isFiledBucket(tender.status) ? "filed" : tender.status]}`}
                            title={
                              isMissedParticipation(tender)
                                ? "Deadline passed without participation"
                                : deleted
                                  ? "Deleted"
                                  : undefined
                            }
                          >
                            {STATUS_LABELS[isFiledBucket(tender.status) ? "filed" : tender.status]}
                          </span>
                        ) : (
                          <div className="relative inline-block w-full max-w-[128px]">
                            <select
                              value={isFiledBucket(tender.status) ? "filed" : tender.status}
                              disabled={updatingStatusId === tender.id}
                              onChange={(e) =>
                                void handleStatusChange(tender, e.target.value as TenderStatus)
                              }
                              className={`w-full appearance-none pl-2 pr-6 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition disabled:opacity-60 ${STATUS_STYLES[isFiledBucket(tender.status) ? "filed" : tender.status]}`}
                            >
                              {selectableStatuses(tender.status).map((key) => (
                                <option key={key} value={key}>
                                  {STATUS_LABELS[key]}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              size={11}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 align-middle min-w-[140px] border-l border-slate-100/80">
                        <span
                          className={`whitespace-normal break-words leading-tight block ${
                            tender.statusSyncedAt ? "text-violet-800 font-medium" : "text-slate-300"
                          }`}
                          title={
                            tender.statusSyncedAt
                              ? "Last updated from GeM via FlexHRM Smart Capture"
                              : "Not synced yet — use Sync Status on GeM Seller Bids"
                          }
                        >
                          {formatStatusSyncedAt(tender.statusSyncedAt)}
                        </span>
                      </td>
                      {!readOnly && (
                        <td className="px-1 py-2 align-middle">
                          {!locked && !deleted && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(tender)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 cursor-pointer transition"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr className={`${rowBg} border-t border-orange-100`}>
                        <td colSpan={readOnly ? TABLE_COL_SPAN - 1 : TABLE_COL_SPAN} className="px-4 py-4 bg-orange-50/30">
                          <TenderExpandedDetails tender={tender} />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-500">
            <p>
              <span className="font-bold text-slate-700 tabular-nums">{filtered.length}</span> shown ·{" "}
              <span className="font-bold text-slate-700 tabular-nums">{activeTenders.length}</span> active
              {search.trim() ? " · search includes deleted" : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400">Deadline:</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 font-semibold">10+ days</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-orange-800 font-semibold">≤10 days</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-800 font-semibold">≤2 days / passed</span>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-linear-to-r from-orange-50 to-white shrink-0">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Add Tender</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Enter bid details manually</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs overflow-y-auto">
              <label className="sm:col-span-2">
                <span className="font-bold text-slate-600 block mb-1">Bid No. *</span>
                <input
                  value={form.bidNo}
                  onChange={(e) => setForm((f) => ({ ...f, bidNo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-mono"
                  placeholder="GEM/2025/B/6475500"
                />
              </label>
              <label>
                <span className="font-bold text-slate-600 block mb-1">Type</span>
                <select
                  value={form.tenderType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tenderType: e.target.value as TenderType }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="manpower">Manpower</option>
                  <option value="travel">Car tenders</option>
                </select>
              </label>
              <label>
                <span className="font-bold text-slate-600 block mb-1">
                  {form.tenderType === "travel" ? "No. of Vehicles" : "No. of Persons"}
                </span>
                <input
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quantity: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="font-bold text-slate-600 block mb-1">Item Category</span>
                <textarea
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                />
              </label>
              <label>
                <span className="font-bold text-slate-600 block mb-1">Ministry / State</span>
                <input
                  value={form.ministry}
                  onChange={(e) => setForm((f) => ({ ...f, ministry: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                />
              </label>
              <label>
                <span className="font-bold text-slate-600 block mb-1">Organisation</span>
                <input
                  value={form.organisation}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      organisation: e.target.value,
                      department: e.target.value,
                    }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                />
              </label>
              <label>
                <span className="font-bold text-slate-600 block mb-1">Consignee Reporting/Officer</span>
                <input
                  value={form.consigneeOfficer}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      consigneeOfficer: e.target.value,
                      officerName: e.target.value,
                    }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="font-bold text-slate-600 block mb-1">Address</span>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="font-bold text-slate-600 block mb-1">Estimated Bid Value</span>
                <input
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                  placeholder="Rs. 5,00,00,000"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="font-bold text-slate-600 block mb-1">Additional Requirements</span>
                <textarea
                  value={form.additionalRequirements}
                  onChange={(e) => setForm((f) => ({ ...f, additionalRequirements: e.target.value }))}
                  rows={5}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm whitespace-pre-line"
                  placeholder={"Tenure (months): 12\nBasic Pay: 781\nWorking days/month: 26"}
                />
              </label>
              <DateTimeInput
                label="Bid End Date & Time"
                value={endDateTimeLocal}
                onChange={(e) => setEndDateTimeLocal(e.target.value)}
                className="sm:col-span-2"
              />
              <DateInput
                label="Bid Start Date"
                value={startDateIso}
                onChange={(e) => setStartDateIso(e.target.value)}
              />
              <DateInput
                label="Participation Filed"
                value={filedDateIso}
                onChange={(e) => setFiledDateIso(e.target.value)}
              />
              <label className="sm:col-span-2">
                <span className="font-bold text-slate-600 block mb-1">Pre-Bid</span>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.noPreBid}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          noPreBid: e.target.checked,
                          preBidAt: e.target.checked ? "" : f.preBidAt,
                          preBidVenue: e.target.checked ? "" : f.preBidVenue,
                        }))
                      }
                      className="rounded border-slate-300"
                    />
                    <span>No Pre Bid</span>
                  </label>
                  {!form.noPreBid && (
                    <>
                      <input
                        value={form.preBidAt}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            preBidAt: e.target.value,
                            noPreBid: !e.target.value.trim() && !f.preBidVenue.trim(),
                          }))
                        }
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                        placeholder="01-06-2026 15:00:00"
                      />
                      <textarea
                        value={form.preBidVenue}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            preBidVenue: e.target.value,
                            noPreBid: !e.target.value.trim() && !f.preBidAt.trim(),
                          }))
                        }
                        rows={3}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                        placeholder="Raman Research Institute, Bangalore - 560080"
                      />
                    </>
                  )}
                </div>
              </label>
              <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-slate-400">Initial status</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  New tenders start as <strong>Not Participated</strong>. Change to{" "}
                  <strong>Participated and Not Evaluated</strong> from the table when you file — the filed date is stamped automatically.
                </p>
              </div>
              <label className="sm:col-span-2">
                <span className="font-bold text-slate-600 block mb-1">Outcome / Notes</span>
                <textarea
                  value={form.outcome}
                  onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                  placeholder="Rejection reason, single selected, etc."
                />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl hover:bg-white cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold bg-[#ff791a] hover:bg-[#e4640c] text-white rounded-xl cursor-pointer disabled:opacity-50 shadow-sm transition"
              >
                {submitting ? "Saving…" : "Save Tender"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
