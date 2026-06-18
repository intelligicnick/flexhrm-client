import React, { useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  Gavel,
  Plus,
  Search,
  Filter,
  Trash2,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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
  composeTenderEndDate,
} from "../lib/date-helpers";
import DateRangeField from "./ui/DateRangeField";
import { DateInput, TimeInput } from "./ui/DateInput";

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

function tenderConsignee(tender: Tender): string {
  return tender.consigneeOfficer?.trim() || tender.officerName?.trim() || "";
}

function tenderMatchesSearch(tender: Tender, term: string): boolean {
  return [
    tender.bidNo,
    tender.category,
    tender.ministry,
    tenderOrganisation(tender),
    tenderConsignee(tender),
    tender.address,
    tender.additionalRequirements,
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

function deadlineMeta(endDate: string): {
  label: string;
  className: string;
  urgent: boolean;
  band: "passed" | "soon" | "ok" | "none";
} {
  const ts = parseEndDateMs(endDate);
  if (!endDate.trim()) {
    return { label: "—", className: "text-slate-400", urgent: false, band: "none" };
  }
  if (ts === null) {
    return { label: endDate, className: "text-slate-700", urgent: false, band: "ok" };
  }
  const now = Date.now();
  const diffHours = (ts - now) / (1000 * 60 * 60);
  const formatted = formatAppDate(endDate, { withTime: /\d{1,2}:\d{2}/.test(endDate) });

  if (diffHours < 0) {
    return {
      label: formatted,
      className: "text-red-700 font-semibold",
      urgent: true,
      band: "passed",
    };
  }
  if (diffHours <= 48) {
    return {
      label: formatted,
      className: "text-amber-700 font-semibold",
      urgent: true,
      band: "soon",
    };
  }
  return { label: formatted, className: "text-slate-700", urgent: false, band: "ok" };
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
  const fields = [
    { label: "Additional requirements", value: tender.additionalRequirements },
    { label: "Pre-bid date & time", value: formatPreBidLabel(tender) },
    { label: "Pre-bid venue", value: formatPreBidVenueLabel(tender) },
    { label: "Ministry / State", value: tender.ministry },
    { label: "Organisation", value: tenderOrganisation(tender) },
    { label: "Department", value: tender.department },
    { label: "Consignee officer", value: tenderConsignee(tender) },
    { label: "Address", value: tender.address },
    { label: "Notes", value: tender.notes },
  ].filter((field) => field.value && field.value !== "—");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-[11px] leading-relaxed">
      {fields.map((field) => (
        <div
          key={field.label}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
            {field.label}
          </p>
          <p className="text-slate-700 whitespace-pre-line">{field.value}</p>
        </div>
      ))}
    </div>
  );
}

const TABLE_COL_SPAN = 18;

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

function TypeBadge({ type }: { type: TenderType }) {
  const isTravel = type === "travel";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
        isTravel
          ? "bg-violet-50 text-violet-700 ring-1 ring-violet-100"
          : "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
      }`}
    >
      {isTravel ? "Travel" : "Manpower"}
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
  const [endDateIso, setEndDateIso] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startDateIso, setStartDateIso] = useState("");
  const [filedDateIso, setFiledDateIso] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateTenderInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [expandedTenderId, setExpandedTenderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    setEndDateIso("");
    setEndTime("");
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
        endDate: composeTenderEndDate(endDateIso, endTime),
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

  return (
    <section className="flex-1 flex flex-col min-h-[400px] min-w-0 bg-white border border-slate-200 rounded-xl shadow-xs">
      <div className="bg-linear-to-r from-orange-50 via-white to-slate-50 border-b border-slate-100 px-5 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#ff791a] mb-1">
              Intelligic Solutions
            </p>
            <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
              <Gavel className="text-[#ff791a]" size={20} />
              GeM Tenders
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manpower &amp; Travel Plus bids — track deadlines, filing and evaluation status
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
                className="px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Upload size={14} />
                {importing ? "Importing…" : "Import Excel"}
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="px-3 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                Add Tender
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pt-4 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {[
            { label: "Total", value: stats.total, icon: FileSpreadsheet, tone: "text-slate-700", bg: "bg-slate-50" },
            { label: "Participated", value: stats.filed, icon: CheckCircle2, tone: "text-sky-600", bg: "bg-sky-50/80" },
            { label: "Qualified", value: stats.qualified, icon: Gavel, tone: "text-emerald-600", bg: "bg-emerald-50/80" },
            { label: "Upcoming", value: stats.upcoming, icon: Clock, tone: "text-amber-600", bg: "bg-amber-50/80" },
            { label: "Passed", value: stats.passed, icon: AlertTriangle, tone: "text-red-600", bg: "bg-red-50/80" },
          ].map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className={`rounded-xl border border-slate-100 ${bg} px-3 py-2.5`}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <Icon size={12} className={tone} />
                {label}
              </div>
              <div className={`text-xl font-extrabold tabular-nums ${tone}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bid no., dept, category, outcome… (includes deleted)"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none transition"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | TenderType)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All types</option>
            <option value="manpower">Manpower</option>
            <option value="travel">Travel Plus</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | TenderStatus)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
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
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="all">All deadlines</option>
            <option value="upcoming">Upcoming</option>
            <option value="passed">Passed</option>
          </select>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 font-semibold text-slate-600"
          >
            <Filter size={12} />
            Refresh
          </button>
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
          className="mb-3"
        />

        {toast && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs flex items-center justify-between animate-fade-in">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast(null)} className="cursor-pointer ml-2">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-16 px-5">
          <div className="text-center space-y-3 max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto">
              <Gavel size={28} className="text-[#ff791a]" />
            </div>
            <p className="text-sm text-slate-700 font-bold">No tenders yet</p>
            <p className="text-xs text-slate-400">
              Add tenders manually or import your TENDERS.xlsx workbook to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 min-h-0 px-5 pb-5">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-20rem)] border border-slate-200 rounded-xl shadow-xs scrollbar-thin">
            <table className="w-full text-[11px] min-w-[1680px] table-fixed">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-300">
                  <th className="w-8 px-1 py-2 font-bold" aria-label="Expand" />
                  <th className="w-[130px] px-2 py-2 font-bold">Bid No.</th>
                  <th className="w-[88px] min-w-[88px] px-2 py-2 font-bold">Type</th>
                  <th className="w-[150px] px-2 py-2 font-bold">Category</th>
                  <th className="w-[100px] px-2 py-2 font-bold">Ministry</th>
                  <th className="w-[100px] px-2 py-2 font-bold">Organisation</th>
                  <th className="w-[100px] px-2 py-2 font-bold">Department</th>
                  <th className="w-[100px] px-2 py-2 font-bold">Address</th>
                  <th className="w-[88px] px-2 py-2 font-bold">Officer</th>
                  <th className="w-[44px] px-2 py-2 font-bold text-right">Qty</th>
                  <th className="w-[120px] px-2 py-2 font-bold">Add. Req.</th>
                  <th className="w-[108px] px-2 py-2 font-bold">End Date</th>
                  <th className="w-[88px] px-2 py-2 font-bold">Filed Date</th>
                  <th className="w-[88px] px-2 py-2 font-bold">Entry Date</th>
                  <th className="w-[108px] px-2 py-2 font-bold">Pre-Bid</th>
                  <th className="w-[120px] px-2 py-2 font-bold">Pre-Bid Venue</th>
                  <th className="w-[132px] px-2 py-2 font-bold">Status</th>
                  {!readOnly && <th className="w-10 px-1 py-2 font-bold" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tender, idx) => {
                  const deadline = deadlineMeta(tender.endDate);
                  const addReqPreview = truncatePreview(tender.additionalRequirements, 34);
                  const venuePreview = truncatePreview(formatPreBidVenueLabel(tender), 34);
                  const isExpanded = expandedTenderId === tender.id;
                  const deleted = isTenderDeleted(tender);
                  const locked = isStatusLocked(tender);
                  const urgentNotParticipated = isNearNotParticipated(tender) || isMissedParticipation(tender);
                  const rowBg = deleted
                    ? "bg-slate-100/80"
                    : urgentNotParticipated
                      ? "bg-amber-50/70"
                      : deadline.band === "passed"
                        ? "bg-red-50/40"
                        : deadline.band === "soon"
                          ? "bg-amber-50/50"
                          : idx % 2 === 0
                            ? "bg-white"
                            : "bg-slate-50/40";

                  return (
                    <React.Fragment key={tender.id}>
                    <tr
                      className={`border-t border-slate-100 hover:bg-orange-50/40 transition-colors h-9 ${rowBg} ${isExpanded ? "ring-1 ring-inset ring-orange-200" : ""}`}
                    >
                      <td className="px-1 py-1 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => toggleExpandedRow(tender.id)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                          title="Show full details"
                        >
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </button>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <span className="font-mono text-[10px] font-bold text-slate-900 truncate block">
                          {tender.bidNo}
                          {deleted && (
                            <span className="ml-1 text-[9px] font-bold uppercase text-slate-400">Deleted</span>
                          )}
                          {isMissedParticipation(tender) && (
                            <span className="ml-1 text-[9px] font-bold uppercase text-red-600">Locked</span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-1 align-middle overflow-hidden">
                        <TypeBadge type={tender.tenderType} />
                      </td>
                      <td className="px-2 py-1 align-middle min-w-0 overflow-hidden">
                        <p className="text-slate-700 truncate" title={tender.category}>
                          {tender.category || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <p className="text-slate-600 truncate" title={tender.ministry}>
                          {tender.ministry || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <p className="text-slate-700 truncate" title={tender.organisation || "—"}>
                          {tender.organisation || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <p className="text-slate-700 truncate" title={tender.department || "—"}>
                          {tender.department || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <p className="text-slate-600 truncate" title={tender.address}>
                          {tender.address || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <p className="text-slate-600 truncate" title={tenderConsignee(tender)}>
                          {tenderConsignee(tender) || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-1 align-middle text-right tabular-nums font-semibold text-slate-800">
                        {tender.quantity || "—"}
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <button
                          type="button"
                          onClick={() => toggleExpandedRow(tender.id)}
                          className={`text-left w-full truncate ${addReqPreview.truncated ? "text-orange-700 hover:underline cursor-pointer" : "text-slate-600 cursor-pointer"}`}
                          title={tender.additionalRequirements || "—"}
                        >
                          {addReqPreview.preview}
                        </button>
                      </td>
                      <td className={`px-2 py-1 align-middle whitespace-nowrap ${deadline.className}`}>
                        <div className="flex items-center gap-1 truncate">
                          {deadline.urgent && deadline.label !== "—" && (
                            <Clock size={10} className="shrink-0" />
                          )}
                          <span className="truncate">{deadline.label}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1 align-middle whitespace-nowrap">
                        {tender.filedDate ? (
                          <span className="text-sky-700 font-medium truncate block">
                            {formatTenderFiledDate(tender.filedDate)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1 align-middle whitespace-nowrap text-slate-600 truncate">
                        {tender.entryDate ? formatAppDate(tender.entryDate) : tender.createdAt ? formatAppDate(tender.createdAt) : "—"}
                      </td>
                      <td className="px-2 py-1 align-middle whitespace-nowrap text-slate-600 truncate">
                        {formatPreBidLabel(tender)}
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <button
                          type="button"
                          onClick={() => toggleExpandedRow(tender.id)}
                          className={`text-left w-full truncate ${venuePreview.truncated ? "text-orange-700 hover:underline cursor-pointer" : "text-slate-600 cursor-pointer"}`}
                          title={formatPreBidVenueLabel(tender)}
                        >
                          {venuePreview.preview}
                        </button>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        {readOnly || locked ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border truncate max-w-full ${STATUS_STYLES[isFiledBucket(tender.status) ? "filed" : tender.status]}`}
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
                              className={`w-full appearance-none pl-1.5 pr-6 py-1 rounded-md text-[10px] font-bold border cursor-pointer transition disabled:opacity-60 ${STATUS_STYLES[isFiledBucket(tender.status) ? "filed" : tender.status]}`}
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
                      {!readOnly && (
                        <td className="px-1 py-1 align-middle">
                          {!locked && !deleted && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(tender)}
                              className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer transition"
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
                        <td colSpan={readOnly ? TABLE_COL_SPAN - 1 : TABLE_COL_SPAN} className="px-3 py-3">
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
          <p className="text-[10px] text-slate-400 mt-2 text-right">
            {filtered.length} shown · {activeTenders.length} active
            {search.trim() ? " (search includes deleted)" : ""} · scroll left/right for all columns
          </p>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-orange-50/50">
              <h3 className="font-extrabold text-slate-900">Add Tender</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="cursor-pointer">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                  <option value="travel">Travel Plus</option>
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
                <span className="font-bold text-slate-600 block mb-1">Consignee Officer</span>
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
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateInput
                  label="Bid End Date"
                  value={endDateIso}
                  onChange={(e) => setEndDateIso(e.target.value)}
                />
                <TimeInput
                  label="Bid End Time (optional)"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
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
            <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-bold bg-[#ff791a] text-white rounded-lg cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
