import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  Gavel,
  Plus,
  Search,
  Pencil,
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
  Car,
  Briefcase,
  Filter,
  Zap,
  TrendingUp,
  LayoutGrid,
  Table2,
  MapPin,
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
  parseFlexibleDateToIso,
  matchesIsoDateRange,
  formatAppDate,
  formatFiledDateStamp,
  formatTenderFiledDate,
  composeTenderEndDateFromDateTimeLocal,
  parseTenderEndDateToDateTimeLocal,
  APP_TIMEZONE,
} from "../lib/date-helpers";
import { validateOptionalAmountString } from "../lib/number-validation";
import DateRangeField from "./ui/DateRangeField";
import { DateInput, DateTimeInput } from "./ui/DateInput";

const STATUS_LABELS: Record<TenderStatus, string> = {
  not_filed: "Not Participated",
  not_evaluated: "Participated and Not Evaluated",
  filed: "Participated and Not Evaluated",
  technical_qualified: "Technical Completed",
  qualified: "Qualified",
  disqualified: "Disqualified",
  technical_not_open: "Technical Not Open",
  cancelled: "Cancelled",
  representation_asked: "Representation Asked",
  challenged_representation: "Challenged Representation",
  financial: "Financial",
  bid_awarded: "Bid Awarded",
  bid_not_awarded: "Bid Not Awarded",
  won_bid: "Won the Bid",
};

const STATUS_STYLES: Record<TenderStatus, string> = {
  not_filed: "bg-slate-100 text-slate-600 border-slate-200",
  not_evaluated: "bg-slate-100 text-slate-700 border-slate-200",
  filed: "bg-sky-50 text-sky-700 border-sky-200",
  technical_qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disqualified: "bg-red-50 text-red-600 border-red-400",
  technical_not_open: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-slate-200 text-slate-500 border-slate-300",
  representation_asked: "bg-violet-50 text-violet-700 border-violet-200",
  challenged_representation: "bg-purple-50 text-purple-700 border-purple-200",
  financial: "bg-blue-50 text-blue-700 border-blue-200",
  bid_awarded: "bg-emerald-50 text-emerald-800 border-emerald-300",
  bid_not_awarded: "bg-amber-50 text-amber-800 border-amber-300",
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
  "bid_awarded",
  "bid_not_awarded",
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

function tenderToFormInput(tender: Tender): CreateTenderInput {
  return {
    bidNo: tender.bidNo || "",
    category: tender.category || "",
    ministry: tender.ministry || "",
    organisation: tender.organisation || tender.department || "",
    consigneeOfficer: tender.consigneeOfficer || tender.officerName || "",
    department: tender.organisation || tender.department || "",
    officerName: tender.consigneeOfficer || tender.officerName || "",
    address: tender.address || "",
    tenderType: tender.tenderType || "manpower",
    quantity: tender.quantity || 0,
    rate: tender.rate || "",
    additionalRequirements: tender.additionalRequirements || "",
    endDate: tender.endDate || "",
    startDate: tender.startDate || "",
    filedDate: tender.filedDate || "",
    preBidAt: tender.preBidAt || "",
    preBidVenue: tender.preBidVenue || "",
    noPreBid: Boolean(tender.noPreBid),
    status: tender.status || "not_filed",
    outcome: tender.outcome || "",
    notes: tender.notes || "",
    description: tender.description || "",
    entryDate: tender.entryDate || "",
    gemDocUrl: tender.gemDocUrl || "",
    gemCurrentStage: tender.gemCurrentStage || "",
    deletedAt: tender.deletedAt,
    statusSyncedAt: tender.statusSyncedAt,
    statusSyncNote: tender.statusSyncNote,
    statusBeforeSync: tender.statusBeforeSync,
  };
}

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

function canManageTender(tender: Tender, canManageLockedTenders: boolean): boolean {
  return !isTenderDeleted(tender) && (!isStatusLocked(tender) || canManageLockedTenders);
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

function formatStatusSyncNote(value?: string): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "status change found") return "status change found";
  if (raw === "unchanged") return "unchanged";
  return "";
}

function statusLabelForPill(status: TenderStatus): string {
  return STATUS_LABELS[isFiledBucket(status) ? "filed" : status];
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
  if (value.includes("bid not awarded") || value.includes("not awarded")) {
    return "bid_not_awarded";
  }
  if (value.includes("bid awarded")) return "bid_awarded";
  if (value.includes("technical") && (value.includes("completed") || value.includes("qualified"))) {
    return "technical_qualified";
  }
  if (value.includes("qualified") && !value.includes("disqualified")) {
    return "qualified";
  }
  if (value.includes("disqualified")) return "disqualified";
  if (value.includes("technical")) return "technical_not_open";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("filed")) return "filed";
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
    value.includes("bid awarded") ||
    value.includes("bid not awarded")
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

function resolvePreBidInfo(tender: Tender): {
  time: string;
  venue: string;
  hasMeeting: boolean;
} {
  const time = tender.preBidAt?.trim() ?? "";
  const venue = tender.preBidVenue?.trim() ?? "";
  const hasMeeting = Boolean(time || venue);
  return { time, venue, hasMeeting };
}

function formatPreBidLabel(tender: Tender): string {
  const { time, hasMeeting } = resolvePreBidInfo(tender);
  if (time) return time;
  if (!hasMeeting && tender.noPreBid) return "No Pre Bid";
  return "No Pre Bid";
}

function formatPreBidVenueLabel(tender: Tender): string {
  const { venue, hasMeeting } = resolvePreBidInfo(tender);
  if (venue) return venue;
  if (!hasMeeting && tender.noPreBid) return "—";
  return "—";
}

function tenderEntryDateLabel(tender: Tender): string {
  const raw = tender.entryDate?.trim() || tender.createdAt?.trim() || "";
  if (!raw) return "—";
  return formatAppDate(raw);
}

function tenderRecordUpdatedLabel(tender: Tender): string {
  const raw = tender.updatedAt?.trim() || "";
  if (!raw) return "—";
  return formatAppDate(raw, { withTime: true });
}

function formatTenderCategoryDisplay(category: string): { display: string; full: string } {
  const full = category.trim() || "Uncategorised bid";
  const versionMatch = full.match(/^(.*?\(Version\s*[\d.]+\))/i);
  if (versionMatch) {
    return { display: versionMatch[1].trim(), full };
  }
  const semi = full.indexOf(";");
  if (semi > 0) {
    return { display: full.slice(0, semi).trim(), full };
  }
  if (full.length > 72) {
    return { display: `${full.slice(0, 69)}…`, full };
  }
  return { display: full, full };
}

function CompactField({
  label,
  value,
  valueClassName = "text-slate-800",
  sub,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5 min-w-0 text-[11px] leading-normal py-0.5">
        <span className="text-slate-400 shrink-0 w-[4.5rem]">{label}</span>
        <span className={`font-semibold truncate flex-1 ${valueClassName}`} title={value}>
          {value}
        </span>
      </div>
      {sub ? (
        <p className="text-[10px] text-slate-500 truncate ml-[5.25rem] mb-0.5 leading-normal" title={sub}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function TenderCardDataPanel({
  tender,
  deadline,
  deadlineCellClass,
  syncNote,
  previousSyncStatus,
}: {
  tender: Tender;
  deadline: ReturnType<typeof deadlineMeta>;
  deadlineCellClass: string;
  syncNote: string;
  previousSyncStatus: string;
}) {
  const { time, venue, hasMeeting } = resolvePreBidInfo(tender);
  const gemSync = formatStatusSyncedAt(tender.statusSyncedAt);
  const gemSyncSub = [syncNote, previousSyncStatus ? `Was: ${previousSyncStatus}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="pl-8 pt-2.5 mt-2 border-t border-slate-100">
      <div className="rounded-md border border-slate-100 bg-slate-50/70 p-2.5 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
        <div className="space-y-1.5 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1">Dates</p>
          <CompactField label="End" value={deadline.label} valueClassName={deadlineCellClass} />
          <CompactField
            label="Filed"
            value={tender.filedDate ? formatTenderFiledDate(tender.filedDate) : "—"}
            valueClassName={tender.filedDate ? "text-sky-700" : "text-slate-400"}
          />
          <CompactField label="Entry" value={tenderEntryDateLabel(tender)} />
          <CompactField label="Qty" value={tender.quantity > 0 ? String(tender.quantity) : "—"} />
        </div>
        <div className="space-y-1.5 min-w-0 md:border-l md:border-slate-200/70 md:pl-3">
          <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-600 mb-1">Last updated</p>
          <CompactField
            label="Record"
            value={tenderRecordUpdatedLabel(tender)}
            valueClassName={tender.updatedAt ? "text-slate-800" : "text-slate-400"}
          />
          <CompactField
            label="GeM sync"
            value={tender.statusSyncedAt ? gemSync : "Not synced"}
            valueClassName={tender.statusSyncedAt ? "text-violet-800" : "text-slate-400"}
            sub={gemSyncSub || undefined}
          />
        </div>
        <div className="space-y-1.5 min-w-0 md:border-l md:border-slate-200/70 md:pl-3">
          <p className="text-[9px] font-bold uppercase tracking-wide text-violet-600 mb-1">Pre-bid</p>
          <CompactField
            label="Time"
            value={hasMeeting && time ? time : "No pre bid"}
            valueClassName={hasMeeting && time ? "text-slate-800" : "text-slate-400"}
          />
          <CompactField
            label="Venue"
            value={hasMeeting && venue ? venue : "—"}
            valueClassName={hasMeeting && venue ? "text-slate-700" : "text-slate-400"}
          />
        </div>
      </div>
    </div>
  );
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
        ...(tender.statusSyncNote
          ? [{ label: "Sync note", value: formatStatusSyncNote(tender.statusSyncNote) || tender.statusSyncNote }]
          : []),
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

const TENDER_VIEW_KEY = "flexhrm:tenders:view";
type TenderViewMode = "cards" | "table";
type BulkTenderField =
  | "tenderType"
  | "quantity"
  | "category"
  | "ministry"
  | "organisation"
  | "consigneeOfficer"
  | "address"
  | "rate"
  | "additionalRequirements"
  | "endDate"
  | "startDate"
  | "filedDate"
  | "status"
  | "preBid"
  | "outcome"
  | "notes";

const DEFAULT_BULK_TENDER_FORM: Partial<CreateTenderInput> = {
  tenderType: "manpower",
  quantity: 0,
  category: "",
  ministry: "",
  organisation: "",
  consigneeOfficer: "",
  address: "",
  rate: "",
  additionalRequirements: "",
  status: "not_filed",
  noPreBid: true,
  preBidAt: "",
  preBidVenue: "",
  outcome: "",
  notes: "",
};

function readTenderViewPreference(): TenderViewMode {
  try {
    return localStorage.getItem(TENDER_VIEW_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

type TenderListItem = {
  tender: Tender;
  deadline: ReturnType<typeof deadlineMeta>;
  deadlineCellClass: string;
  consignee: string;
  department: string;
  organisation: string;
  deleted: boolean;
  locked: boolean;
  urgent: boolean;
  missed: boolean;
  syncNote: string;
  previousSyncStatus: string;
};

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
        description: "",
        entryDate: "",
        preBidVenue: "",
        gemDocUrl: "",
        gemCurrentStage: "",
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
            className="inline-flex items-start gap-0.5 font-mono text-xs font-bold text-sky-700 hover:text-sky-900 hover:underline leading-tight"
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
            className="inline-flex items-start gap-0.5 font-mono text-xs font-bold text-slate-700 hover:text-sky-800 hover:underline leading-tight"
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
  const Icon = isTravel ? Car : Briefcase;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
        isTravel
          ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200/80"
          : "bg-sky-100 text-sky-700 ring-1 ring-sky-200/80"
      }`}
    >
      <Icon size={10} className="shrink-0 opacity-80" />
      {isTravel ? "Car" : "Manpower"}
    </span>
  );
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  title,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      title={title}
      className="h-4 w-4 rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
    />
  );
}

type TenderCardRowProps = {
  item: TenderListItem;
  isExpanded: boolean;
  readOnly: boolean;
  canManageLockedTenders: boolean;
  selected: boolean;
  selectable: boolean;
  copiedBidId: string | null;
  updatingStatusId: string | null;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onCopy: (tender: Tender) => void;
  onStatusChange: (tender: Tender, status: TenderStatus) => void;
  onEdit: (tender: Tender) => void;
  onDelete: (tender: Tender) => void;
};

const TenderCardRow = React.memo(function TenderCardRow({
  item,
  isExpanded,
  readOnly,
  canManageLockedTenders,
  selected,
  selectable,
  copiedBidId,
  updatingStatusId,
  onToggleSelect,
  onToggleExpand,
  onCopy,
  onStatusChange,
  onEdit,
  onDelete,
}: TenderCardRowProps) {
  const {
    tender,
    deadline,
    deadlineCellClass,
    consignee,
    department,
    organisation,
    deleted,
    locked,
    urgent,
    missed,
    syncNote,
    previousSyncStatus,
  } = item;

  const subtitle = [organisation, department !== organisation ? department : "", consignee]
    .filter(Boolean)
    .join(" · ");
  const category = formatTenderCategoryDisplay(tender.category);

  return (
    <article
      id={`tender-row-${tender.id}`}
      className={`rounded-lg border overflow-hidden ${
        isExpanded
          ? "border-orange-300 shadow-md ring-1 ring-orange-200/80 bg-white"
          : urgent
            ? "border-amber-200/90 bg-linear-to-r from-amber-50/80 to-white shadow-sm"
            : deleted
              ? "border-slate-200 bg-slate-50/90 opacity-80"
              : "border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-slate-300/80"
      }`}
    >
      <div className="px-3 py-2.5 flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          {!readOnly && (
            <div className="pt-1">
              <SelectionCheckbox
                checked={selected}
                disabled={!selectable}
                onChange={() => onToggleSelect(tender.id)}
                title={selectable ? "Select tender" : "This tender cannot be bulk managed"}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => onToggleExpand(tender.id)}
            className={`shrink-0 p-1 rounded-md cursor-pointer mt-0.5 ${
              isExpanded
                ? "bg-orange-100 text-orange-700"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            }`}
            title={isExpanded ? "Collapse details" : "Expand details"}
          >
            <ChevronRight size={14} className={isExpanded ? "rotate-90 transition-transform" : "transition-transform"} />
          </button>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <BidNumberCell tender={tender} copiedBidId={copiedBidId} onCopy={onCopy} />
              <TypeBadge type={tender.tenderType} />
              {missed && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-red-100 text-red-800">
                  Missed
                </span>
              )}
              {urgent && !missed && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  Due soon
                </span>
              )}
              {deleted && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">
                  Deleted
                </span>
              )}
            </div>
            <h3
              className="text-xs font-bold text-slate-900 leading-snug truncate"
              title={category.full}
            >
              {category.display}
            </h3>
            {(subtitle || tender.ministry || tender.address) && (
              <p
                className="text-[11px] text-slate-500 truncate leading-normal"
                title={subtitle || tender.ministry || tender.address}
              >
                {subtitle || tender.ministry || tender.address}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            {readOnly || locked ? (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border max-w-[140px] truncate ${STATUS_STYLES[isFiledBucket(tender.status) ? "filed" : tender.status]}`}
                title={statusLabelForPill(tender.status)}
              >
                {statusLabelForPill(tender.status)}
              </span>
            ) : (
              <div className="relative w-[148px]">
                <select
                  value={isFiledBucket(tender.status) ? "filed" : tender.status}
                  disabled={updatingStatusId === tender.id}
                  onChange={(e) => void onStatusChange(tender, e.target.value as TenderStatus)}
                  className={`w-full appearance-none pl-2 pr-6 py-1 rounded-full text-[11px] font-bold border cursor-pointer disabled:opacity-60 ${STATUS_STYLES[isFiledBucket(tender.status) ? "filed" : tender.status]}`}
                >
                  {selectableStatuses(tender.status).map((key) => (
                    <option key={key} value={key}>
                      {STATUS_LABELS[key]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
              </div>
            )}
            {!readOnly && !deleted && (!locked || canManageLockedTenders) && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(tender)}
                  className="p-1.5 rounded-md hover:bg-sky-50 text-slate-300 hover:text-sky-500 cursor-pointer shrink-0"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(tender)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 cursor-pointer shrink-0"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        <TenderCardDataPanel
          tender={tender}
          deadline={deadline}
          deadlineCellClass={deadlineCellClass}
          syncNote={syncNote}
          previousSyncStatus={previousSyncStatus}
        />
      </div>

      {isExpanded && (
        <div className="border-t border-orange-100 bg-orange-50/30 px-3 py-2.5">
          <TenderExpandedDetails tender={tender} />
        </div>
      )}
    </article>
  );
});

type TenderTableRowProps = TenderCardRowProps;

const TenderTableRow = React.memo(function TenderTableRow({
  item,
  isExpanded,
  readOnly,
  canManageLockedTenders,
  selected,
  selectable,
  copiedBidId,
  updatingStatusId,
  onToggleSelect,
  onToggleExpand,
  onCopy,
  onStatusChange,
  onEdit,
  onDelete,
}: TenderTableRowProps) {
  const { tender, deadline, deadlineCellClass, organisation, deleted, locked, urgent, missed, syncNote, previousSyncStatus } =
    item;
  const { time: preBidTime, venue: preBidVenue, hasMeeting: hasPreBid } = resolvePreBidInfo(tender);
  const colSpan = readOnly ? 8 : 10;

  return (
    <>
      <tr
        id={`tender-row-${tender.id}`}
        className={`border-t border-slate-100 ${
          isExpanded
            ? "bg-orange-50/70"
            : urgent
              ? "bg-amber-50/40"
              : deleted
                ? "bg-slate-50/80 opacity-80"
                : "bg-white hover:bg-slate-50/80"
        }`}
      >
        {!readOnly && (
          <td className="px-2 py-2.5 align-middle">
            <SelectionCheckbox
              checked={selected}
              disabled={!selectable}
              onChange={() => onToggleSelect(tender.id)}
              title={selectable ? "Select tender" : "This tender cannot be bulk managed"}
            />
          </td>
        )}
        <td className="px-2 py-2.5 align-middle">
          <button
            type="button"
            onClick={() => onToggleExpand(tender.id)}
            className={`p-1 rounded-lg cursor-pointer ${isExpanded ? "text-orange-700" : "text-slate-400 hover:text-slate-700"}`}
          >
            <ChevronRight size={14} className={isExpanded ? "rotate-90 transition-transform" : "transition-transform"} />
          </button>
        </td>
        <td className="px-2 py-2.5 align-middle min-w-[140px]">
          <BidNumberCell tender={tender} copiedBidId={copiedBidId} onCopy={onCopy} />
        </td>
        <td className="px-2 py-2.5 align-middle whitespace-nowrap">
          <TypeBadge type={tender.tenderType} />
        </td>
        <td className="px-2 py-2.5 align-middle max-w-[200px]">
          <p className="text-slate-800 font-medium truncate" title={tender.category}>
            {tender.category || "—"}
          </p>
          <p className="text-[10px] text-slate-500 truncate mt-0.5" title={organisation}>
            {organisation || "—"}
          </p>
        </td>
        <td className="px-2 py-2.5 align-middle whitespace-nowrap">
          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${deadlineCellClass}`}>
            {deadline.urgent && deadline.label !== "—" ? <Clock size={10} /> : null}
            {deadline.label}
          </span>
          {missed && <span className="block text-[9px] font-bold text-red-600 uppercase mt-0.5">Missed</span>}
          {urgent && !missed && <span className="block text-[9px] font-bold text-amber-700 uppercase mt-0.5">Due soon</span>}
        </td>
        <td className="px-2 py-2.5 align-middle w-[150px] min-w-[150px] max-w-[150px] overflow-hidden">
          <div className="min-w-0">
            <span
              className={`block truncate ${hasPreBid && preBidTime ? "text-slate-800 font-medium" : "text-slate-400"}`}
              title={hasPreBid && preBidTime ? preBidTime : "No pre bid"}
            >
              {hasPreBid && preBidTime ? preBidTime : "No pre bid"}
            </span>
            {hasPreBid && preBidVenue ? (
              <span className="block text-[10px] text-slate-500 truncate mt-0.5" title={preBidVenue}>
                {preBidVenue}
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-2 py-2.5 align-middle min-w-[160px]">
          {readOnly || locked ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${STATUS_STYLES[isFiledBucket(tender.status) ? "filed" : tender.status]}`}
            >
              {statusLabelForPill(tender.status)}
            </span>
          ) : (
            <div className="relative min-w-[150px]">
              <select
                value={isFiledBucket(tender.status) ? "filed" : tender.status}
                disabled={updatingStatusId === tender.id}
                onChange={(e) => void onStatusChange(tender, e.target.value as TenderStatus)}
                className={`w-full appearance-none pl-2 pr-6 py-1 rounded-full text-[10px] font-bold border cursor-pointer disabled:opacity-60 ${STATUS_STYLES[isFiledBucket(tender.status) ? "filed" : tender.status]}`}
              >
                {selectableStatuses(tender.status).map((key) => (
                  <option key={key} value={key}>
                    {STATUS_LABELS[key]}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
            </div>
          )}
        </td>
        <td className="px-2 py-2.5 align-middle text-[11px]">
          <span className={tender.statusSyncedAt ? "text-violet-800 font-medium" : "text-slate-300"}>
            {formatStatusSyncedAt(tender.statusSyncedAt)}
          </span>
          {previousSyncStatus ? (
            <span className="block text-[10px] text-slate-500 mt-0.5">{previousSyncStatus}</span>
          ) : syncNote ? (
            <span className="block text-[10px] text-slate-500 mt-0.5">{syncNote}</span>
          ) : null}
        </td>
        {!readOnly && (
          <td className="px-2 py-2.5 align-middle whitespace-nowrap">
            {!deleted && (!locked || canManageLockedTenders) && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(tender)}
                  className="p-1.5 rounded-lg hover:bg-sky-50 text-slate-300 hover:text-sky-500 cursor-pointer"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(tender)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 cursor-pointer"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </td>
        )}
      </tr>
      {isExpanded && (
        <tr className="bg-orange-50/40 border-t border-orange-100">
          <td colSpan={colSpan} className="px-4 py-4">
            <TenderExpandedDetails tender={tender} />
          </td>
        </tr>
      )}
    </>
  );
});

interface TendersPanelProps {
  tenders: Tender[];
  readOnly?: boolean;
  canManageLockedTenders?: boolean;
  initialDeadlineFilter?: "all" | "upcoming" | "passed";
  onRefresh: () => Promise<void>;
  onCreate: (payload: CreateTenderInput) => Promise<void>;
  onUpdate: (id: string, payload: Partial<CreateTenderInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBulkUpdate: (
    ids: string[],
    payload: Partial<CreateTenderInput>,
  ) => Promise<{ updated: number; errors: string[] }>;
  onBulkDelete: (ids: string[]) => Promise<{ deleted: number; errors: string[] }>;
  onImport: (items: CreateTenderInput[]) => Promise<{ created: number; updated: number; skipped: number }>;
}

export default function TendersPanel({
  tenders,
  readOnly = false,
  canManageLockedTenders = false,
  initialDeadlineFilter = "all",
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onBulkUpdate,
  onBulkDelete,
  onImport,
}: TendersPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState("");
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTenderInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [expandedTenderId, setExpandedTenderId] = useState<string | null>(null);
  const [copiedBidId, setCopiedBidId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<TenderViewMode>(readTenderViewPreference);
  const [selectedTenderIds, setSelectedTenderIds] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState<Partial<Record<BulkTenderField, boolean>>>({});
  const [bulkForm, setBulkForm] = useState<Partial<CreateTenderInput>>(DEFAULT_BULK_TENDER_FORM);
  const [bulkEndDateTimeLocal, setBulkEndDateTimeLocal] = useState("");
  const [bulkStartDateIso, setBulkStartDateIso] = useState("");
  const [bulkFiledDateIso, setBulkFiledDateIso] = useState("");
  const copyBidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTenderViewMode = useCallback((mode: TenderViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(TENDER_VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 200);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const copyBidNumber = useCallback(async (tender: Tender) => {
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
  }, []);

  const normalizedTenders = useMemo(
    () => tenders.map(normalizeTender),
    [tenders],
  );

  const activeTenders = useMemo(
    () => normalizedTenders.filter((t) => !isTenderDeleted(t)),
    [normalizedTenders],
  );

  const selectedTenderSet = useMemo(() => new Set(selectedTenderIds), [selectedTenderIds]);

  const allSelectableTenderIds = useMemo(
    () =>
      normalizedTenders
        .filter((tender) => canManageTender(tender, canManageLockedTenders))
        .map((tender) => tender.id),
    [normalizedTenders, canManageLockedTenders],
  );

  useEffect(() => {
    const selectableSet = new Set(allSelectableTenderIds);
    setSelectedTenderIds((current) => current.filter((id) => selectableSet.has(id)));
  }, [allSelectableTenderIds]);

  const stats = useMemo(() => {
    const now = Date.now();
    let upcoming = 0;
    let passed = 0;
    let filed = 0;
    let qualified = 0;
    let urgent = 0;
    let manpower = 0;
    let travel = 0;
    activeTenders.forEach((t) => {
      if (t.tenderType === "travel") travel += 1;
      else manpower += 1;
      if (isFiledBucket(t.status) || t.filedDate.trim()) filed += 1;
      if (t.status === "qualified") qualified += 1;
      if (isNearNotParticipated(t) || isMissedParticipation(t)) urgent += 1;
      const ts = parseEndDateMs(t.endDate);
      if (ts === null) return;
      if (ts >= now) upcoming += 1;
      else passed += 1;
    });
    return { total: activeTenders.length, upcoming, passed, filed, qualified, urgent, manpower, travel };
  }, [activeTenders]);

  const urgentTenders = useMemo(
    () =>
      activeTenders
        .filter((t) => isNearNotParticipated(t) || isMissedParticipation(t))
        .sort(compareTenders)
        .slice(0, 6),
    [activeTenders],
  );

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

  const listItems = useMemo((): TenderListItem[] => {
    return filtered.map((tender) => {
      const deadline = deadlineMeta(tender.endDate);
      return {
        tender,
        deadline,
        deadlineCellClass: tenderDeadlineCellClass(tender, deadline),
        consignee: tenderConsignee(tender),
        department: tenderDepartment(tender),
        organisation: tenderOrganisation(tender),
        deleted: isTenderDeleted(tender),
        locked: isStatusLocked(tender),
        urgent: isNearNotParticipated(tender) || isMissedParticipation(tender),
        missed: isMissedParticipation(tender),
        syncNote: formatStatusSyncNote(tender.statusSyncNote),
        previousSyncStatus:
          tender.statusSyncNote === "status change found" && tender.statusBeforeSync
            ? statusLabelForPill(tender.statusBeforeSync)
            : "",
      };
    });
  }, [filtered]);

  const selectedTenders = useMemo(
    () => normalizedTenders.filter((tender) => selectedTenderSet.has(tender.id)),
    [normalizedTenders, selectedTenderSet],
  );

  const selectableVisibleIds = useMemo(
    () =>
      listItems
        .filter((item) => canManageTender(item.tender, canManageLockedTenders))
        .map((item) => item.tender.id),
    [listItems, canManageLockedTenders],
  );

  const selectedVisibleCount = useMemo(
    () => selectableVisibleIds.filter((id) => selectedTenderSet.has(id)).length,
    [selectableVisibleIds, selectedTenderSet],
  );

  const areAllVisibleSelected =
    selectableVisibleIds.length > 0 && selectedVisibleCount === selectableVisibleIds.length;
  const hasSomeVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < selectableVisibleIds.length;

  const clearDateRange = () => {
    setDateFrom("");
    setDateTo("");
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setEndDateTimeLocal("");
    setStartDateIso("");
    setFiledDateIso("");
    setModalOpen(true);
  };

  const openEdit = (tender: Tender) => {
    setEditingId(tender.id);
    setForm(tenderToFormInput(tender));
    setEndDateTimeLocal(parseTenderEndDateToDateTimeLocal(tender.endDate));
    setStartDateIso(parseFlexibleDateToIso(tender.startDate || ""));
    setFiledDateIso(parseFlexibleDateToIso(tender.filedDate || ""));
    setModalOpen(true);
  };

  const toggleTenderSelection = useCallback((tenderId: string) => {
    setSelectedTenderIds((current) =>
      current.includes(tenderId)
        ? current.filter((id) => id !== tenderId)
        : [...current, tenderId],
    );
  }, []);

  const toggleSelectVisibleTenders = useCallback(() => {
    if (selectableVisibleIds.length === 0) return;
    setSelectedTenderIds((current) => {
      const visibleSet = new Set(selectableVisibleIds);
      const allSelected = selectableVisibleIds.every((id) => current.includes(id));
      if (allSelected) {
        return current.filter((id) => !visibleSet.has(id));
      }
      return Array.from(new Set([...current, ...selectableVisibleIds]));
    });
  }, [selectableVisibleIds]);

  const clearSelectedTenders = useCallback(() => {
    setSelectedTenderIds([]);
  }, []);

  const openBulkEdit = useCallback(() => {
    if (selectedTenders.length === 0) {
      setToast("Select at least one tender to bulk edit.");
      return;
    }
    const sample = selectedTenders[0];
    setBulkForm({
      ...DEFAULT_BULK_TENDER_FORM,
      tenderType: sample.tenderType,
      quantity: sample.quantity,
      category: sample.category,
      ministry: sample.ministry || "",
      organisation: tenderOrganisation(sample),
      consigneeOfficer: tenderConsignee(sample) || sample.consigneeOfficer || "",
      address: sample.address,
      rate: sample.rate,
      additionalRequirements: sample.additionalRequirements || "",
      status: isFiledBucket(sample.status) ? "filed" : sample.status,
      noPreBid: Boolean(sample.noPreBid),
      preBidAt: sample.preBidAt || "",
      preBidVenue: sample.preBidVenue || "",
      outcome: sample.outcome,
      notes: sample.notes,
    });
    setBulkEditFields({});
    setBulkEndDateTimeLocal(parseTenderEndDateToDateTimeLocal(sample.endDate));
    setBulkStartDateIso(parseFlexibleDateToIso(sample.startDate || ""));
    setBulkFiledDateIso(parseFlexibleDateToIso(sample.filedDate || ""));
    setBulkEditOpen(true);
  }, [selectedTenders]);

  const closeBulkEdit = useCallback(() => {
    setBulkEditOpen(false);
    setBulkSubmitting(false);
    setBulkEditFields({});
  }, []);

  const handleSubmit = async () => {
    if (!form.bidNo.trim()) {
      setToast("Bid number is required.");
      return;
    }

    const rateError = validateOptionalAmountString(form.rate, "Estimated bid value");
    if (rateError) {
      setToast(rateError);
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateTenderInput = {
        ...form,
        status: editingId ? form.status : "not_filed",
        filedDate: filedDateIso,
        startDate: startDateIso,
        endDate: composeTenderEndDateFromDateTimeLocal(endDateTimeLocal),
        organisation: form.organisation || form.department,
        consigneeOfficer: form.consigneeOfficer || form.officerName,
        department: form.organisation || form.department,
        officerName: form.consigneeOfficer || form.officerName,
      };
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      setModalOpen(false);
      setEditingId(null);
      setToast(editingId ? "Tender updated." : "Tender added.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = useCallback(async (tender: Tender, status: TenderStatus) => {
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
  }, [onUpdate]);

  const toggleExpandedRow = useCallback((tenderId: string) => {
    setExpandedTenderId((current) => (current === tenderId ? null : tenderId));
  }, []);

  const handleDelete = useCallback(async (tender: Tender) => {
    if (isMissedParticipation(tender) && !canManageLockedTenders) {
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
  }, [canManageLockedTenders, onDelete]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedTenderIds.length === 0) {
      setToast("Select at least one tender to bulk delete.");
      return;
    }
    const count = selectedTenderIds.length;
    if (!window.confirm(`Delete ${count} selected tender${count === 1 ? "" : "s"}?`)) return;
    try {
      const result = await onBulkDelete(selectedTenderIds);
      if (result.deleted > 0) {
        setSelectedTenderIds([]);
      }
      setToast(
        result.errors.length > 0
          ? `Deleted ${result.deleted} tender${result.deleted === 1 ? "" : "s"} · ${result.errors.length} failed.`
          : `Deleted ${result.deleted} tender${result.deleted === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Bulk delete failed.");
    }
  }, [onBulkDelete, selectedTenderIds]);

  const handleBulkUpdate = useCallback(async () => {
    if (selectedTenderIds.length === 0) {
      setToast("Select at least one tender to bulk edit.");
      return;
    }
    const enabledFields = Object.entries(bulkEditFields)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([field]) => field as BulkTenderField);
    if (enabledFields.length === 0) {
      setToast("Choose at least one field to update.");
      return;
    }

    const rateError = bulkEditFields.rate
      ? validateOptionalAmountString(String(bulkForm.rate ?? ""), "Estimated bid value")
      : "";
    if (rateError) {
      setToast(rateError);
      return;
    }
    if (
      bulkEditFields.status &&
      bulkForm.status === "not_filed" &&
      selectedTenders.some((tender) => tender.status !== "not_filed")
    ) {
      setToast("Bulk edit cannot move selected tenders back to Not Participated.");
      return;
    }

    const payload: Partial<CreateTenderInput> = {};
    if (bulkEditFields.tenderType) payload.tenderType = bulkForm.tenderType as TenderType;
    if (bulkEditFields.quantity) payload.quantity = Math.max(0, Number(bulkForm.quantity) || 0);
    if (bulkEditFields.category) payload.category = String(bulkForm.category ?? "");
    if (bulkEditFields.ministry) payload.ministry = String(bulkForm.ministry ?? "");
    if (bulkEditFields.organisation) {
      const organisation = String(bulkForm.organisation ?? "");
      payload.organisation = organisation;
      payload.department = organisation;
    }
    if (bulkEditFields.consigneeOfficer) {
      const consigneeOfficer = String(bulkForm.consigneeOfficer ?? "");
      payload.consigneeOfficer = consigneeOfficer;
      payload.officerName = consigneeOfficer;
    }
    if (bulkEditFields.address) payload.address = String(bulkForm.address ?? "");
    if (bulkEditFields.rate) payload.rate = String(bulkForm.rate ?? "");
    if (bulkEditFields.additionalRequirements) {
      payload.additionalRequirements = String(bulkForm.additionalRequirements ?? "");
    }
    if (bulkEditFields.endDate) {
      payload.endDate = composeTenderEndDateFromDateTimeLocal(bulkEndDateTimeLocal);
    }
    if (bulkEditFields.startDate) payload.startDate = bulkStartDateIso;
    if (bulkEditFields.filedDate) payload.filedDate = bulkFiledDateIso;
    if (bulkEditFields.status) payload.status = bulkForm.status as TenderStatus;
    if (bulkEditFields.preBid) {
      const noPreBid = Boolean(bulkForm.noPreBid);
      payload.noPreBid = noPreBid;
      payload.preBidAt = noPreBid ? "" : String(bulkForm.preBidAt ?? "");
      payload.preBidVenue = noPreBid ? "" : String(bulkForm.preBidVenue ?? "");
    }
    if (bulkEditFields.outcome) payload.outcome = String(bulkForm.outcome ?? "");
    if (bulkEditFields.notes) payload.notes = String(bulkForm.notes ?? "");

    setBulkSubmitting(true);
    try {
      const result = await onBulkUpdate(selectedTenderIds, payload);
      if (result.updated > 0) {
        setSelectedTenderIds([]);
        closeBulkEdit();
      }
      setToast(
        result.errors.length > 0
          ? `Updated ${result.updated} tender${result.updated === 1 ? "" : "s"} · ${result.errors.length} failed.`
          : `Updated ${result.updated} tender${result.updated === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Bulk update failed.");
    } finally {
      setBulkSubmitting(false);
    }
  }, [bulkEditFields, bulkEndDateTimeLocal, bulkFiledDateIso, bulkForm, bulkStartDateIso, closeBulkEdit, onBulkUpdate, selectedTenderIds, selectedTenders]);

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
    Boolean(typeFilter || statusFilter || deadlineFilter !== "all" || dateFrom || dateTo || searchInput.trim());

  const applyQuickFilter = (key: "all" | "filed" | "qualified" | "upcoming" | "passed") => {
    if (key === "all") {
      setTypeFilter("");
      setStatusFilter("");
      setDeadlineFilter("all");
      setSearchInput("");
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
      label: "Total Active",
      value: stats.total,
      icon: FileSpreadsheet,
      iconBg: "bg-slate-100 text-slate-600",
      tone: "text-slate-800",
      sub: `${stats.manpower} manpower · ${stats.travel} car`,
      active: !hasActiveFilters,
    },
    {
      key: "filed" as const,
      label: "Participated",
      value: stats.filed,
      icon: CheckCircle2,
      iconBg: "bg-sky-100 text-sky-600",
      tone: "text-sky-700",
      sub: stats.total > 0 ? `${Math.round((stats.filed / stats.total) * 100)}% of active` : undefined,
      active: statusFilter === "filed",
    },
    {
      key: "qualified" as const,
      label: "Qualified",
      value: stats.qualified,
      icon: TrendingUp,
      iconBg: "bg-emerald-100 text-emerald-600",
      tone: "text-emerald-700",
      sub: "Technical / final",
      active: statusFilter === "qualified",
    },
    {
      key: "upcoming" as const,
      label: "Upcoming",
      value: stats.upcoming,
      icon: Clock,
      iconBg: "bg-amber-100 text-amber-600",
      tone: "text-amber-700",
      sub: stats.urgent > 0 ? `${stats.urgent} need action` : "Open deadlines",
      active: deadlineFilter === "upcoming" && !statusFilter,
      highlight: stats.urgent > 0,
    },
    {
      key: "passed" as const,
      label: "Passed",
      value: stats.passed,
      icon: AlertTriangle,
      iconBg: "bg-red-100 text-red-600",
      tone: "text-red-700",
      sub: "Deadline elapsed",
      active: deadlineFilter === "passed" && !statusFilter,
    },
  ];

  const selectClass =
    "px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none transition";

  return (
    <section className="flex-1 flex flex-col min-h-[400px] min-w-0 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="relative border-b border-slate-800/10 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,121,26,0.25),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.08),transparent_40%)]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff791a]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative px-5 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-200 ring-1 ring-white/10">
                  <Gavel size={11} />
                  GeM Bids
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/20 tabular-nums">
                  {activeTenders.length} active
                </span>
                {stats.urgent > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/25 px-2 py-0.5 text-[10px] font-bold text-red-200 ring-1 ring-red-400/30 animate-pulse">
                    <Zap size={10} />
                    {stats.urgent} urgent
                  </span>
                )}
              </div>
              <h2 className="font-extrabold text-white text-2xl tracking-tight flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff791a] text-white shadow-lg shadow-orange-900/40 ring-2 ring-orange-400/30">
                  <Gavel size={20} />
                </span>
                Tender Pipeline
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-xl leading-relaxed">
                Track manpower &amp; car tender bids — deadlines, participation status, and GeM sync in one place.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 ring-1 ring-white/10">
                  <Briefcase size={12} className="text-sky-400" />
                  {stats.manpower} Manpower
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 ring-1 ring-white/10">
                  <Car size={12} className="text-violet-400" />
                  {stats.travel} Car
                </span>
              </div>
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
                  className="px-4 py-2.5 border border-white/15 bg-white/10 hover:bg-white/15 backdrop-blur-sm text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                >
                  <Upload size={14} />
                  {importing ? "Importing…" : "Import Excel"}
                </button>
                <button
                  type="button"
                  onClick={openCreate}
                  className="px-4 py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-orange-900/30 transition"
                >
                  <Plus size={14} />
                  Add Tender
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 pb-3 bg-linear-to-b from-slate-50/80 to-white">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {statCards.map(({ key, label, value, icon: Icon, iconBg, tone, sub, active, highlight }) => (
            <button
              key={key}
              type="button"
              onClick={() => applyQuickFilter(key)}
              className={`group rounded-xl border text-left px-4 py-3.5 transition-all cursor-pointer ${
                active
                  ? "bg-white border-[#ff791a]/40 ring-2 ring-[#ff791a]/20 shadow-md"
                  : highlight
                    ? "bg-amber-50/80 border-amber-200 hover:border-amber-300 hover:shadow-sm"
                    : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className={`text-2xl font-black tabular-nums mt-1 ${tone}`}>{value}</p>
                  {sub && (
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate group-hover:text-slate-500 transition">
                      {sub}
                    </p>
                  )}
                </div>
                <div className={`p-2 rounded-xl shrink-0 ${iconBg}`}>
                  <Icon size={15} />
                </div>
              </div>
            </button>
          ))}
        </div>

        {urgentTenders.length > 0 && (
          <div className="mb-5 rounded-xl border border-red-200/80 bg-linear-to-r from-red-50 via-orange-50/50 to-amber-50 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <Zap size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-red-900">
                    Needs Attention ({urgentTenders.length}{stats.urgent > urgentTenders.length ? ` of ${stats.urgent}` : ""})
                  </h3>
                  <p className="text-[11px] text-red-700/80">
                    Not participated — deadline within 7 days or already passed
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => applyQuickFilter("upcoming")}
                className="text-[11px] font-bold text-red-700 hover:text-red-900 underline underline-offset-2 shrink-0"
              >
                View all upcoming →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {urgentTenders.map((tender) => {
                const deadline = deadlineMeta(tender.endDate);
                const missed = isMissedParticipation(tender);
                return (
                  <button
                    key={tender.id}
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setSearch("");
                      setTypeFilter("");
                      setStatusFilter("");
                      setDeadlineFilter("all");
                      setExpandedTenderId(tender.id);
                      requestAnimationFrame(() => {
                        const row = document.getElementById(`tender-row-${tender.id}`);
                        row?.scrollIntoView({ behavior: "smooth", block: "center" });
                      });
                    }}
                    className="flex items-start gap-3 rounded-lg border border-white/80 bg-white/90 px-3 py-2.5 text-left hover:border-red-200 hover:shadow-sm transition group"
                  >
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${missed ? "bg-red-200 text-red-900" : "bg-amber-200 text-amber-900"}`}>
                      {missed ? "Missed" : "Due soon"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] font-bold text-slate-800 truncate group-hover:text-[#ff791a] transition">
                        {tender.bidNo}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {tender.category || tenderOrganisation(tender) || "—"}
                      </p>
                      <p className={`text-[10px] font-semibold mt-1 ${deadline.cellClassName} inline-block rounded px-1.5 py-0.5`}>
                        {deadline.label}
                      </p>
                    </div>
                    <TypeBadge type={tender.tenderType} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3 mb-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-500">
            <Filter size={13} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Filters</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setTenderViewMode("cards")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-md transition cursor-pointer ${
                    viewMode === "cards"
                      ? "bg-white text-[#ff791a] shadow-sm ring-1 ring-slate-200/80"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title="Card view (recommended)"
                >
                  <LayoutGrid size={12} />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setTenderViewMode("table")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-md transition cursor-pointer ${
                    viewMode === "table"
                      ? "bg-white text-[#ff791a] shadow-sm ring-1 ring-slate-200/80"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  title="Compact table view"
                >
                  <Table2 size={12} />
                  Table
                </button>
              </div>
              {hasActiveFilters && (
                <span className="text-[10px] font-semibold text-[#ff791a]">
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          {!readOnly && (selectableVisibleIds.length > 0 || selectedTenderIds.length > 0) && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2.5 flex flex-col lg:flex-row lg:items-center gap-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2 font-semibold">
                  <SelectionCheckbox
                    checked={areAllVisibleSelected}
                    indeterminate={hasSomeVisibleSelected}
                    disabled={selectableVisibleIds.length === 0}
                    onChange={toggleSelectVisibleTenders}
                    title={areAllVisibleSelected ? "Clear visible selection" : "Select all visible tenders"}
                  />
                  <span>
                    {selectedTenderIds.length} selected
                    {selectableVisibleIds.length > 0 ? ` · ${selectableVisibleIds.length} selectable in view` : ""}
                  </span>
                </div>
                {selectedTenderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelectedTenders}
                    className="text-slate-500 hover:text-slate-700 font-semibold underline underline-offset-2"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div className="lg:ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openBulkEdit}
                  disabled={selectedTenderIds.length === 0}
                  className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:border-orange-200 hover:text-[#ff791a] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Bulk Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkDelete()}
                  disabled={selectedTenderIds.length === 0}
                  className="px-3.5 py-2 text-xs rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Bulk Delete
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col lg:flex-row flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search bid no., dept, category, outcome… (includes deleted)"
                className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none transition"
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
              className="px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 hover:bg-white flex items-center gap-1.5 font-semibold text-slate-600 transition"
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
        <div className="flex-1 flex items-center justify-center py-20 px-5 bg-linear-to-b from-white to-slate-50/50">
          <div className="text-center space-y-5 max-w-md">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-orange-200 to-orange-100 blur-sm" />
              <div className="relative w-full h-full rounded-2xl bg-linear-to-br from-orange-100 to-orange-50 flex items-center justify-center shadow-md ring-1 ring-orange-200/60">
                <Gavel size={32} className="text-[#ff791a]" />
              </div>
            </div>
            <div>
              <p className="text-lg text-slate-800 font-extrabold">
                {hasActiveFilters ? "No tenders match your filters" : "No tenders yet"}
              </p>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
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
                  className="px-4 py-2.5 text-xs font-bold border border-slate-200 rounded-xl hover:bg-white bg-slate-50 transition shadow-xs"
                >
                  Clear filters
                </button>
              )}
              {!readOnly && !hasActiveFilters && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 text-xs font-bold border border-slate-200 rounded-xl hover:bg-white bg-slate-50 flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Upload size={13} />
                    Import Excel
                  </button>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="px-4 py-2.5 text-xs font-bold bg-[#ff791a] hover:bg-[#e4640c] text-white rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-200/40 transition"
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
          {viewMode === "cards" ? (
            <div className="space-y-2 max-h-[calc(100vh-18rem)] overflow-y-auto pr-1 scrollbar-thin">
              {listItems.map((item) => (
                <TenderCardRow
                  key={item.tender.id}
                  item={item}
                  isExpanded={expandedTenderId === item.tender.id}
                  readOnly={readOnly}
                  canManageLockedTenders={canManageLockedTenders}
                  selected={selectedTenderSet.has(item.tender.id)}
                  selectable={canManageTender(item.tender, canManageLockedTenders)}
                  copiedBidId={copiedBidId}
                  updatingStatusId={updatingStatusId}
                  onToggleSelect={toggleTenderSelection}
                  onToggleExpand={toggleExpandedRow}
                  onCopy={copyBidNumber}
                  onStatusChange={handleStatusChange}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="max-h-[calc(100vh-18rem)] overflow-auto rounded-xl border border-slate-200/80 shadow-sm scrollbar-thin bg-white">
              <table className="w-full text-xs text-left min-w-[980px] border-separate border-spacing-0">
                <thead className="bg-slate-800 text-slate-200 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-wide">
                    {!readOnly && (
                      <th className="px-2 py-2.5 w-10">
                        <SelectionCheckbox
                          checked={areAllVisibleSelected}
                          indeterminate={hasSomeVisibleSelected}
                          disabled={selectableVisibleIds.length === 0}
                          onChange={toggleSelectVisibleTenders}
                          title={areAllVisibleSelected ? "Clear visible selection" : "Select all visible tenders"}
                        />
                      </th>
                    )}
                    <th className="px-2 py-2.5 w-8" aria-label="Expand" />
                    <th className="px-2 py-2.5 font-bold">Bid No.</th>
                    <th className="px-2 py-2.5 font-bold">Type</th>
                    <th className="px-2 py-2.5 font-bold">Category / Org</th>
                    <th className="px-2 py-2.5 font-bold">End Date</th>
                    <th className="px-2 py-2.5 font-bold w-[150px] min-w-[150px] max-w-[150px]">Pre-bid</th>
                    <th className="px-2 py-2.5 font-bold">Status</th>
                    <th className="px-2 py-2.5 font-bold">GeM Sync</th>
                    {!readOnly && <th className="px-2 py-2.5 font-bold w-24" aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {listItems.map((item) => (
                    <TenderTableRow
                      key={item.tender.id}
                      item={item}
                      isExpanded={expandedTenderId === item.tender.id}
                      readOnly={readOnly}
                      canManageLockedTenders={canManageLockedTenders}
                      selected={selectedTenderSet.has(item.tender.id)}
                      selectable={canManageTender(item.tender, canManageLockedTenders)}
                      copiedBidId={copiedBidId}
                      updatingStatusId={updatingStatusId}
                      onToggleSelect={toggleTenderSelection}
                      onToggleExpand={toggleExpandedRow}
                      onCopy={copyBidNumber}
                      onStatusChange={handleStatusChange}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[10px] text-slate-500">
            <p>
              <span className="font-bold text-slate-800 tabular-nums">{listItems.length}</span> tender
              {listItems.length !== 1 ? "s" : ""} shown
              {search.trim() ? " · search includes deleted" : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
              <span className="text-slate-400 font-semibold">Deadline:</span>
              <span className="inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-800 font-semibold text-[9px]">10+ days</span>
              <span className="inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-orange-800 font-semibold text-[9px]">≤10 days</span>
              <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-red-800 font-semibold text-[9px]">≤2 days / passed</span>
            </div>
          </div>
        </div>
      )}

      {bulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-linear-to-r from-orange-50 to-white shrink-0">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Bulk Edit Tenders</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Apply the checked fields to {selectedTenderIds.length} selected tender{selectedTenderIds.length === 1 ? "" : "s"}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeBulkEdit}
                className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900">
                Only checked fields will be updated. Leave a checked field blank if you want to clear that value on all selected tenders.
              </div>
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5 text-left font-bold w-24">Apply</th>
                      <th className="px-3 py-2.5 text-left font-bold w-56">Field</th>
                      <th className="px-3 py-2.5 text-left font-bold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.tenderType)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, tenderType: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Type</td>
                      <td className="px-3 py-3">
                        <select
                          value={bulkForm.tenderType || "manpower"}
                          onChange={(e) => setBulkForm((current) => ({ ...current, tenderType: e.target.value as TenderType }))}
                          disabled={!bulkEditFields.tenderType}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="manpower">Manpower</option>
                          <option value="travel">Car tenders</option>
                        </select>
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.quantity)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, quantity: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Quantity</td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          value={bulkForm.quantity ?? 0}
                          onChange={(e) => setBulkForm((current) => ({ ...current, quantity: Math.max(0, Number(e.target.value) || 0) }))}
                          disabled={!bulkEditFields.quantity}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.category)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, category: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Item Category</td>
                      <td className="px-3 py-3">
                        <textarea
                          value={bulkForm.category ?? ""}
                          onChange={(e) => setBulkForm((current) => ({ ...current, category: e.target.value }))}
                          disabled={!bulkEditFields.category}
                          rows={2}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.ministry)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, ministry: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Ministry / State</td>
                      <td className="px-3 py-3">
                        <input
                          value={bulkForm.ministry ?? ""}
                          onChange={(e) => setBulkForm((current) => ({ ...current, ministry: e.target.value }))}
                          disabled={!bulkEditFields.ministry}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.organisation)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, organisation: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Organisation</td>
                      <td className="px-3 py-3">
                        <input
                          value={bulkForm.organisation ?? ""}
                          onChange={(e) => setBulkForm((current) => ({ ...current, organisation: e.target.value }))}
                          disabled={!bulkEditFields.organisation}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.consigneeOfficer)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, consigneeOfficer: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Consignee Reporting/Officer</td>
                      <td className="px-3 py-3">
                        <input
                          value={bulkForm.consigneeOfficer ?? ""}
                          onChange={(e) => setBulkForm((current) => ({ ...current, consigneeOfficer: e.target.value }))}
                          disabled={!bulkEditFields.consigneeOfficer}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.address)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, address: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Address</td>
                      <td className="px-3 py-3">
                        <textarea
                          value={bulkForm.address ?? ""}
                          onChange={(e) => setBulkForm((current) => ({ ...current, address: e.target.value }))}
                          disabled={!bulkEditFields.address}
                          rows={2}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.rate)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, rate: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Estimated Bid Value</td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={bulkForm.rate ?? ""}
                          onChange={(e) => setBulkForm((current) => ({ ...current, rate: e.target.value }))}
                          disabled={!bulkEditFields.rate}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.status)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, status: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Status</td>
                      <td className="px-3 py-3">
                        <select
                          value={isFiledBucket((bulkForm.status as TenderStatus) || "not_filed") ? "filed" : bulkForm.status || "not_filed"}
                          onChange={(e) => setBulkForm((current) => ({ ...current, status: e.target.value as TenderStatus }))}
                          disabled={!bulkEditFields.status}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          {STATUS_ORDER.map((key) => (
                            <option key={key} value={key}>
                              {STATUS_LABELS[key]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.additionalRequirements)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, additionalRequirements: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Additional Requirements</td>
                      <td className="px-3 py-3">
                        <textarea
                          value={bulkForm.additionalRequirements ?? ""}
                          onChange={(e) => setBulkForm((current) => ({ ...current, additionalRequirements: e.target.value }))}
                          disabled={!bulkEditFields.additionalRequirements}
                          rows={4}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.preBid)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, preBid: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Pre-Bid</td>
                      <td className="px-3 py-3 space-y-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(bulkForm.noPreBid)}
                            onChange={(e) =>
                              setBulkForm((current) => ({
                                ...current,
                                noPreBid: e.target.checked,
                                preBidAt: e.target.checked ? "" : current.preBidAt,
                                preBidVenue: e.target.checked ? "" : current.preBidVenue,
                              }))
                            }
                            disabled={!bulkEditFields.preBid}
                            className="rounded border-slate-300"
                          />
                          <span className={!bulkEditFields.preBid ? "text-slate-400" : "text-slate-700"}>No Pre Bid</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            value={bulkForm.preBidAt ?? ""}
                            onChange={(e) =>
                              setBulkForm((current) => ({
                                ...current,
                                preBidAt: e.target.value,
                                noPreBid: !e.target.value.trim() && !String(current.preBidVenue ?? "").trim(),
                              }))
                            }
                            disabled={!bulkEditFields.preBid || Boolean(bulkForm.noPreBid)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                            placeholder="01-06-2026 15:00:00"
                          />
                          <textarea
                            value={bulkForm.preBidVenue ?? ""}
                            onChange={(e) =>
                              setBulkForm((current) => ({
                                ...current,
                                preBidVenue: e.target.value,
                                noPreBid: !e.target.value.trim() && !String(current.preBidAt ?? "").trim(),
                              }))
                            }
                            disabled={!bulkEditFields.preBid || Boolean(bulkForm.noPreBid)}
                            rows={2}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                            placeholder="Pre-bid venue"
                          />
                        </div>
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.endDate)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, endDate: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Bid End Date & Time</td>
                      <td className="px-3 py-3">
                        <DateTimeInput
                          value={bulkEndDateTimeLocal}
                          onChange={(e) => setBulkEndDateTimeLocal(e.target.value)}
                          disabled={!bulkEditFields.endDate}
                          className="disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.startDate)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, startDate: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Bid Start Date</td>
                      <td className="px-3 py-3">
                        <DateInput
                          value={bulkStartDateIso}
                          onChange={(e) => setBulkStartDateIso(e.target.value)}
                          disabled={!bulkEditFields.startDate}
                          className="disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.filedDate)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, filedDate: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Participation Filed Date</td>
                      <td className="px-3 py-3">
                        <DateInput
                          value={bulkFiledDateIso}
                          onChange={(e) => setBulkFiledDateIso(e.target.value)}
                          disabled={!bulkEditFields.filedDate}
                          className="disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.outcome)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, outcome: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Outcome / Notes</td>
                      <td className="px-3 py-3">
                        <textarea
                          value={bulkForm.outcome ?? ""}
                          onChange={(e) => setBulkForm((current) => ({ ...current, outcome: e.target.value }))}
                          disabled={!bulkEditFields.outcome}
                          rows={3}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(bulkEditFields.notes)}
                          onChange={(e) => setBulkEditFields((current) => ({ ...current, notes: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">Internal Notes</td>
                      <td className="px-3 py-3">
                        <textarea
                          value={bulkForm.notes ?? ""}
                          onChange={(e) => setBulkForm((current) => ({ ...current, notes: e.target.value }))}
                          disabled={!bulkEditFields.notes}
                          rows={3}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={closeBulkEdit}
                className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl hover:bg-white cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBulkUpdate()}
                disabled={bulkSubmitting}
                className="px-4 py-2 text-xs font-bold bg-[#ff791a] hover:bg-[#e4640c] text-white rounded-xl cursor-pointer disabled:opacity-50 shadow-sm transition"
              >
                {bulkSubmitting ? "Applying…" : "Apply Bulk Edit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-linear-to-r from-orange-50 to-white shrink-0">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingId ? "Edit Tender" : "Add Tender"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {editingId ? "Update bid details" : "Enter bid details manually"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingId(null);
                }}
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
                  type="number"
                  min={0}
                  step="any"
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5"
                  placeholder="5000000"
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
                onClick={() => {
                  setModalOpen(false);
                  setEditingId(null);
                }}
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
                {submitting ? "Saving…" : editingId ? "Update Tender" : "Save Tender"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
