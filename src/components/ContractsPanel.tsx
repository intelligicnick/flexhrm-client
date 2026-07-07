import React, { useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Shield,
  ExternalLink,
  MapPin,
  Copy,
  Check,
} from "lucide-react";
import {
  Contract,
  ContractType,
  ContractStatus,
  CreateContractInput,
  Tender,
  BgDdRecord,
} from "../types";
import {
  parseFlexibleDateMs,
  parseFlexibleDateToIso,
  matchesIsoDateRange,
  formatAppDate,
} from "../lib/date-helpers";
import DateRangeField from "./ui/DateRangeField";
import { DateInput } from "./ui/DateInput";
import {
  resolveGemContractFullLinkForCopy,
  resolveGemContractNoLabel,
  resolveGemContractPdfUrl,
} from "../lib/gem-helpers";
import { validateOptionalAmountString } from "../lib/number-validation";
import {
  formatContractLabel,
  otherContractsUsingLocation,
} from "../lib/contract-locations";
import { fetchBgDdRecords } from "../lib/bg-dd";

const STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Active",
  upcoming: "Upcoming",
  expired: "Expired",
  extended: "Extended",
  terminated: "Terminated",
};

const STATUS_STYLES: Record<ContractStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  upcoming: "bg-sky-50 text-sky-700 border-sky-200",
  expired: "bg-red-50 text-red-700 border-red-200",
  extended: "bg-violet-50 text-violet-700 border-violet-200",
  terminated: "bg-slate-200 text-slate-600 border-slate-300",
};

const EMPTY_FORM: CreateContractInput = {
  contractNo: "",
  officerName: "",
  officeName: "",
  correspondingOffice: "",
  fromDate: "",
  toDate: "",
  companyName: "",
  category: "",
  contractType: "manpower",
  hasExtension: false,
  extensionEndDate: "",
  bgApplicable: false,
  bgNumber: "",
  bgAmount: "",
  bgIssuingBank: "",
  bgExpiryDate: "",
  bgDetails: "",
  ddoName: "",
  ddoIssuingDetails: "",
  tenderBidNo: "",
  contractValue: "",
  status: "active",
  notes: "",
  entryDate: "",
  linkedLocations: [],
};

function coerceText(value: string | null | undefined): string {
  return value == null ? "" : String(value);
}

function contractToFormInput(contract: Contract): CreateContractInput {
  return {
    contractNo: coerceText(contract.contractNo),
    officerName: coerceText(contract.officerName),
    officeName: coerceText(contract.officeName),
    correspondingOffice: coerceText(contract.correspondingOffice),
    fromDate: coerceText(contract.fromDate),
    toDate: coerceText(contract.toDate),
    companyName: coerceText(contract.companyName),
    category: coerceText(contract.category),
    contractType: contract.contractType || "manpower",
    hasExtension: Boolean(contract.hasExtension),
    extensionEndDate: coerceText(contract.extensionEndDate),
    bgApplicable: Boolean(contract.bgApplicable),
    bgNumber: coerceText(contract.bgNumber),
    bgAmount: normalizeAmountString(contract.bgAmount),
    bgIssuingBank: coerceText(contract.bgIssuingBank),
    bgExpiryDate: coerceText(contract.bgExpiryDate),
    bgDetails: coerceText(contract.bgDetails),
    ddoName: coerceText(contract.ddoName),
    ddoIssuingDetails: coerceText(contract.ddoIssuingDetails),
    tenderBidNo: coerceText(contract.tenderBidNo),
    contractValue: normalizeAmountString(contract.contractValue),
    status: contract.status || "active",
    notes: coerceText(contract.notes),
    entryDate: coerceText(contract.entryDate),
    linkedLocations: contract.linkedLocations || [],
  };
}

function normalizeAmountString(value: string | undefined | null): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return "";
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "";
}

function mergeLinkedBgRecord(
  form: CreateContractInput,
  bgRecords: BgDdRecord[],
): CreateContractInput {
  if (bgRecords.length === 0) return form;

  const bgRecord = [...bgRecords].sort((a, b) => {
    const aTs = Date.parse(a.updatedAt || a.createdAt || "") || 0;
    const bTs = Date.parse(b.updatedAt || b.createdAt || "") || 0;
    return bTs - aTs;
  })[0];

  if (bgRecord.instrumentType !== "bg") return form;

  const hasBgData = [
    bgRecord.number,
    bgRecord.amount,
    bgRecord.issuingBank,
    bgRecord.expiryDate,
    bgRecord.notes,
  ].some((value) => String(value || "").trim().length > 0);

  if (!hasBgData && !form.bgApplicable) return form;

  return {
    ...form,
    bgApplicable: true,
    bgNumber: bgRecord.number || form.bgNumber,
    bgAmount: bgRecord.amount || form.bgAmount,
    bgIssuingBank: bgRecord.issuingBank || form.bgIssuingBank,
    bgExpiryDate:
      parseFlexibleDateToIso(bgRecord.expiryDate || "") ||
      parseFlexibleDateToIso(form.bgExpiryDate || ""),
    bgDetails: bgRecord.notes || form.bgDetails,
  };
}

function effectiveEndDate(contract: Contract): string {
  if (contract.hasExtension && contract.extensionEndDate.trim()) {
    return contract.extensionEndDate;
  }
  return contract.toDate;
}

function endDateMeta(endDate: string): {
  label: string;
  className: string;
  band: "passed" | "soon" | "ok" | "none";
} {
  const ts = parseFlexibleDateMs(endDate);
  if (!endDate.trim()) {
    return { label: "—", className: "text-slate-400", band: "none" };
  }
  if (ts === null) {
    return { label: endDate, className: "text-slate-700", band: "ok" };
  }
  const now = Date.now();
  const diffDays = (ts - now) / (1000 * 60 * 60 * 24);
  const formatted = formatAppDate(endDate);

  if (diffDays < 0) {
    return { label: formatted, className: "text-red-700 font-semibold", band: "passed" };
  }
  if (diffDays <= 60) {
    return { label: formatted, className: "text-amber-700 font-semibold", band: "soon" };
  }
  return { label: formatted, className: "text-slate-700", band: "ok" };
}

function normalizeBool(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "yes" || value === "y" || value === "true" || value === "1";
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

async function parseContractsWorkbook(buffer: ArrayBuffer): Promise<CreateContractInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

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

  const items: CreateContractInput[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const contractNo = pick(row, "contract no", "contract number", "contract nur", "contract");
    if (!contractNo) return;

    const companyName = pick(row, "company name", "company nan", "company");
    const isTravel = /travel/i.test(companyName) || /travel/i.test(pick(row, "category"));
    const hasExtension = normalizeBool(pick(row, "extension"));
    const bgApplicable = normalizeBool(pick(row, "bg applicable", "bg applicabl", "bank guarantee"));

    items.push({
      contractNo,
      officerName: pick(row, "officer name", "officer"),
      officeName: pick(row, "office name", "office"),
      correspondingOffice: pick(row, "corresponding", "correspondin"),
      fromDate: pick(row, "from date", "start date"),
      toDate: pick(row, "to date", "end date"),
      companyName,
      category: pick(row, "category"),
      contractType: isTravel ? "travel" : "manpower",
      hasExtension,
      extensionEndDate: hasExtension ? pick(row, "extension end date", "extended to") : "",
      bgApplicable,
      bgNumber: pick(row, "bg number", "bg nu"),
      bgAmount: pick(row, "bg amount"),
      bgIssuingBank: pick(row, "bg bank", "issuing bank"),
      bgExpiryDate: pick(row, "bg expiry", "bg expiry date"),
      bgDetails: pick(row, "bg details"),
      ddoName: pick(row, "ddo name", "ddo"),
      ddoIssuingDetails: pick(row, "ddo issuing", "issuing details"),
      tenderBidNo: pick(row, "tender bid", "bid no", "bid number"),
      contractValue: pick(row, "contract value", "value"),
      status: "active",
      notes: pick(row, "notes", "remarks"),
      entryDate: new Date().toISOString().slice(0, 10),
    });
  });

  return items;
}

const CONTRACT_ROW_HEIGHT_PX = 48;

const TABLE_COLUMNS = [
  { key: "expand", label: "", width: 36 },
  { key: "index", label: "#", width: 44 },
  { key: "contractNo", label: "Contract No", width: 148 },
  { key: "officerName", label: "Officer", width: 128 },
  { key: "officeName", label: "Office", width: 140 },
  { key: "fromDate", label: "From", width: 96 },
  { key: "toDate", label: "To / Extended", width: 112 },
  { key: "companyName", label: "Company", width: 132 },
  { key: "category", label: "Category", width: 148 },
  { key: "hasExtension", label: "Ext", width: 52 },
  { key: "bgApplicable", label: "BG", width: 52 },
  { key: "status", label: "Status", width: 96 },
  { key: "actions", label: "Actions", width: 108 },
] as const;

type ContractColumnKey = (typeof TABLE_COLUMNS)[number]["key"];

function displayValue(value: string | undefined | null): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || "—";
}

function ContractTableCell({
  children,
  fullText,
  onActivate,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  fullText?: string;
  onActivate?: () => void;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return (
    <td
      className={`px-2 py-0 align-middle border-r border-slate-100 last:border-r-0 ${alignClass} ${className}`}
      style={{ height: CONTRACT_ROW_HEIGHT_PX, maxHeight: CONTRACT_ROW_HEIGHT_PX }}
      title={fullText?.trim() || undefined}
      onClick={onActivate}
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onKeyDown={
        onActivate
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
    >
      <div
        className={`flex h-full items-center overflow-hidden ${
          align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        <div className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-tight">
          {children}
        </div>
      </div>
    </td>
  );
}

function GemContractPdfBlock({ contract }: { contract: Contract }) {
  const pdfUrl = resolveGemContractPdfUrl(contract);
  const fullPdfLink = resolveGemContractFullLinkForCopy(contract);
  const [copied, setCopied] = useState(false);

  if (!pdfUrl && !fullPdfLink) return <>—</>;

  const copyFullPdfLink = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!fullPdfLink) return;
    try {
      await navigator.clipboard.writeText(fullPdfLink);
    } catch {
      window.prompt("Copy full contract PDF link:", fullPdfLink);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      {pdfUrl ? (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          Open contract PDF
          <ExternalLink size={11} className="shrink-0" />
        </a>
      ) : null}
      {fullPdfLink ? (
        <div className="flex items-start gap-1">
          <code className="flex-1 font-mono text-[11px] leading-snug break-all text-slate-700">
            {fullPdfLink}
          </code>
          <button
            type="button"
            onClick={copyFullPdfLink}
            className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-200/80 hover:text-slate-700"
            title={copied ? "Copied!" : "Copy full contract PDF link"}
          >
            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ContractExpandedDetails({
  contract,
  highlightKey,
}: {
  contract: Contract;
  highlightKey?: ContractColumnKey | null;
}) {
  const pdfUrl = resolveGemContractPdfUrl(contract);
  const contractLabel = resolveGemContractNoLabel(contract);
  const end = effectiveEndDate(contract);

  const rows: Array<{ key: ContractColumnKey | "detail"; label: string; value: React.ReactNode }> = [
    {
      key: "contractNo",
      label: "Contract No",
      value: pdfUrl ? (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
          onClick={(event) => event.stopPropagation()}
        >
          {contractLabel}
        </a>
      ) : (
        contractLabel
      ),
    },
    { key: "officerName", label: "Officer Name", value: displayValue(contract.officerName) },
    { key: "officeName", label: "Office Name", value: displayValue(contract.officeName) },
    {
      key: "detail",
      label: "Corresponding Office",
      value: displayValue(contract.correspondingOffice),
    },
    { key: "fromDate", label: "From Date", value: displayValue(formatAppDate(contract.fromDate) || contract.fromDate) },
    {
      key: "toDate",
      label: contract.hasExtension ? "Extended To" : "To Date",
      value: displayValue(formatAppDate(end) || end),
    },
    { key: "companyName", label: "Company Name", value: displayValue(contract.companyName) },
    { key: "category", label: "Category", value: displayValue(contract.category) },
    {
      key: "detail",
      label: "Contract Type",
      value: contract.contractType === "travel" ? "Travel Plus" : "Manpower",
    },
    { key: "hasExtension", label: "Extension", value: contract.hasExtension ? "Yes" : "No" },
    {
      key: "detail",
      label: "Extension End Date",
      value: displayValue(formatAppDate(contract.extensionEndDate) || contract.extensionEndDate),
    },
    { key: "bgApplicable", label: "BG Applicable", value: contract.bgApplicable ? "Yes" : "No" },
    { key: "detail", label: "BG Number", value: displayValue(contract.bgNumber) },
    { key: "detail", label: "BG Amount", value: displayValue(contract.bgAmount) },
    { key: "detail", label: "BG Issuing Bank", value: displayValue(contract.bgIssuingBank) },
    {
      key: "detail",
      label: "BG Expiry",
      value: displayValue(formatAppDate(contract.bgExpiryDate) || contract.bgExpiryDate),
    },
    { key: "detail", label: "BG Details", value: displayValue(contract.bgDetails) },
    { key: "detail", label: "DDO Name", value: displayValue(contract.ddoName) },
    { key: "detail", label: "DDO Issuing Details", value: displayValue(contract.ddoIssuingDetails) },
    { key: "detail", label: "Tender Bid No", value: displayValue(contract.tenderBidNo) },
    { key: "detail", label: "Contract Value", value: displayValue(contract.contractValue) },
    {
      key: "status",
      label: "Status",
      value: STATUS_LABELS[contract.status] || contract.status,
    },
    { key: "detail", label: "Entry Date", value: displayValue(formatAppDate(contract.entryDate) || contract.entryDate) },
    {
      key: "detail",
      label: "GeM Contract PDF",
      value: <GemContractPdfBlock contract={contract} />,
    },
    { key: "detail", label: "Notes", value: displayValue(contract.notes) },
    {
      key: "detail",
      label: "Linked Office Locations",
      value:
        contract.linkedLocations && contract.linkedLocations.length > 0
          ? contract.linkedLocations.join(" → ")
          : "—",
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 px-2 py-3">
      {rows.map(({ key, label, value }) => {
        const highlighted = highlightKey != null && key === highlightKey;
        return (
          <div
            key={`${label}-${key}`}
            className={`rounded-lg border px-3 py-2 min-h-[72px] ${
              highlighted
                ? "border-orange-300 bg-orange-50 ring-1 ring-orange-200"
                : "border-slate-100 bg-white"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <div className="text-xs text-slate-700 mt-1 whitespace-pre-wrap break-words leading-relaxed">
              {value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ContractsPanelProps {
  contracts: Contract[];
  tenders?: Tender[];
  availableLocations?: string[];
  readOnly?: boolean;
  onRefresh: () => Promise<void>;
  onCreate: (payload: CreateContractInput) => Promise<void>;
  onUpdate: (id: string, payload: Partial<CreateContractInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (items: CreateContractInput[]) => Promise<{ created: number; updated: number; skipped: number }>;
}

export default function ContractsPanel({
  contracts,
  tenders = [],
  availableLocations = [],
  readOnly = false,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onImport,
}: ContractsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ContractType>("");
  const [statusFilter, setStatusFilter] = useState<"" | ContractStatus>("");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "active" | "expiring_soon" | "expired">("all");
  const [bgDueOnly, setBgDueOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateContractInput>(EMPTY_FORM);
  const [fromDateIso, setFromDateIso] = useState("");
  const [toDateIso, setToDateIso] = useState("");
  const [extensionEndIso, setExtensionEndIso] = useState("");
  const [bgExpiryIso, setBgExpiryIso] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedColumnKey, setExpandedColumnKey] = useState<ContractColumnKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [locationToAdd, setLocationToAdd] = useState("");

  const sortedLocations = useMemo(
    () => [...availableLocations].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [availableLocations],
  );

  const addableLocations = useMemo(() => {
    const linked = new Set((form.linkedLocations || []).map((loc) => loc.toLowerCase()));
    return sortedLocations.filter((loc) => !linked.has(loc.toLowerCase()));
  }, [sortedLocations, form.linkedLocations]);

  const visibleColumns = useMemo(
    () => TABLE_COLUMNS.filter((column) => readOnly ? column.key !== "actions" : true),
    [readOnly],
  );

  const tableMinWidth = useMemo(
    () => visibleColumns.reduce((sum, column) => sum + column.width, 0),
    [visibleColumns],
  );

  const toggleContractRow = (contractId: string, columnKey?: ContractColumnKey) => {
    if (expandedId === contractId) {
      if (columnKey && columnKey !== "expand" && columnKey !== "actions") {
        setExpandedColumnKey(columnKey);
        return;
      }
      setExpandedId(null);
      setExpandedColumnKey(null);
      return;
    }
    setExpandedId(contractId);
    setExpandedColumnKey(columnKey && columnKey !== "expand" && columnKey !== "actions" ? columnKey : null);
  };

  const wonTenders = useMemo(
    () => tenders.filter((t) => t.status === "won_bid" || /won/i.test(t.outcome)),
    [tenders],
  );

  const stats = useMemo(() => {
    const now = Date.now();
    const soonCutoff = now + 60 * 24 * 60 * 60 * 1000;
    const bgSoonCutoff = now + 30 * 24 * 60 * 60 * 1000;
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let bgDue = 0;

    contracts.forEach((c) => {
      const end = effectiveEndDate(c);
      const ts = parseFlexibleDateMs(end);
      if (ts !== null) {
        if (ts < now) expired += 1;
        else if (ts <= soonCutoff) expiringSoon += 1;
        else active += 1;
      }
      if (c.bgApplicable) {
        const bgTs = parseFlexibleDateMs(c.bgExpiryDate);
        if (bgTs !== null && bgTs >= now && bgTs <= bgSoonCutoff) bgDue += 1;
      }
    });

    return { total: contracts.length, active, expiringSoon, expired, bgDue };
  }, [contracts]);

  const filtered = useMemo(() => {
    let rows = [...contracts];
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((c) =>
        [
          c.contractNo,
          c.companyName,
          c.officerName,
          c.officeName,
          c.category,
          c.tenderBidNo,
          c.ddoName,
          c.bgNumber,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }
    if (typeFilter) rows = rows.filter((c) => c.contractType === typeFilter);
    if (statusFilter) rows = rows.filter((c) => c.status === statusFilter);
    if (expiryFilter !== "all") {
      const now = Date.now();
      const soonCutoff = now + 60 * 24 * 60 * 60 * 1000;
      rows = rows.filter((c) => {
        const ts = parseFlexibleDateMs(effectiveEndDate(c));
        if (ts === null) return expiryFilter === "active";
        if (expiryFilter === "expired") return ts < now;
        if (expiryFilter === "expiring_soon") return ts >= now && ts <= soonCutoff;
        return ts >= now;
      });
    }
    if (bgDueOnly) {
      const now = Date.now();
      const soonCutoff = now + 30 * 24 * 60 * 60 * 1000;
      rows = rows.filter((c) => {
        if (!c.bgApplicable) return false;
        const ts = parseFlexibleDateMs(c.bgExpiryDate);
        return ts !== null && ts >= now && ts <= soonCutoff;
      });
    }
    if (dateFrom || dateTo) {
      rows = rows.filter((c) => {
        const ts = parseFlexibleDateMs(c.toDate);
        return matchesIsoDateRange(ts, dateFrom, dateTo);
      });
    }
    return rows.sort((a, b) => {
      const aTs = parseFlexibleDateMs(effectiveEndDate(a)) ?? 0;
      const bTs = parseFlexibleDateMs(effectiveEndDate(b)) ?? 0;
      return bTs - aTs;
    });
  }, [contracts, search, typeFilter, statusFilter, expiryFilter, bgDueOnly, dateFrom, dateTo]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFromDateIso("");
    setToDateIso("");
    setExtensionEndIso("");
    setBgExpiryIso("");
    setLocationToAdd("");
    setModalOpen(true);
  };

  const openEdit = async (contract: Contract) => {
    setEditingId(contract.id);
    setEditLoading(true);
    try {
      let freshContract: Contract = contract;
      try {
        const res = await fetch(`/api/contracts/${encodeURIComponent(contract.id)}`);
        if (res.ok) {
          freshContract = await res.json();
        }
      } catch {
        // Fall back to the in-memory contract row.
      }

      let bgRecords: BgDdRecord[] = [];
      try {
        bgRecords = await fetchBgDdRecords({
          contractId: contract.id,
          instrumentType: "bg",
        });
      } catch {
        // BG details are optional; still open the edit form.
      }

      const formData = mergeLinkedBgRecord(contractToFormInput(freshContract), bgRecords);
      setForm(formData);
      setFromDateIso(parseFlexibleDateToIso(freshContract.fromDate || ""));
      setToDateIso(parseFlexibleDateToIso(freshContract.toDate || ""));
      setExtensionEndIso(parseFlexibleDateToIso(freshContract.extensionEndDate || ""));
      setBgExpiryIso(parseFlexibleDateToIso(formData.bgExpiryDate || ""));
      setLocationToAdd("");
      setModalOpen(true);
    } catch {
      setToast("Failed to load contract details.");
    } finally {
      setEditLoading(false);
    }
  };

  const moveLinkedLocation = (index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const next = [...(prev.linkedLocations || [])];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, linkedLocations: next };
    });
  };

  const removeLinkedLocation = (index: number) => {
    setForm((prev) => ({
      ...prev,
      linkedLocations: (prev.linkedLocations || []).filter((_, idx) => idx !== index),
    }));
  };

  const addLinkedLocation = () => {
    const value = locationToAdd.trim();
    if (!value) return;
    setForm((prev) => {
      const existing = prev.linkedLocations || [];
      if (existing.some((loc) => loc.toLowerCase() === value.toLowerCase())) {
        return prev;
      }
      return { ...prev, linkedLocations: [...existing, value] };
    });
    setLocationToAdd("");
  };

  const buildPayload = (): CreateContractInput => ({
    ...form,
    fromDate: parseFlexibleDateToIso(fromDateIso || form.fromDate),
    toDate: parseFlexibleDateToIso(toDateIso || form.toDate),
    extensionEndDate: form.hasExtension
      ? parseFlexibleDateToIso(extensionEndIso || form.extensionEndDate)
      : "",
    bgExpiryDate: form.bgApplicable
      ? parseFlexibleDateToIso(bgExpiryIso || form.bgExpiryDate)
      : "",
    contractValue: normalizeAmountString(form.contractValue),
    bgAmount: form.bgApplicable ? normalizeAmountString(form.bgAmount) : "",
    entryDate:
      parseFlexibleDateToIso(form.entryDate) || new Date().toISOString().slice(0, 10),
    linkedLocations: form.linkedLocations || [],
  });

  const handleSubmit = async () => {
    if (!form.contractNo.trim()) {
      setToast("Contract number is required.");
      return;
    }

    const contractValueError = validateOptionalAmountString(form.contractValue, "Contract value");
    if (contractValueError) {
      setToast(contractValueError);
      return;
    }
    if (form.bgApplicable) {
      const bgAmountError = validateOptionalAmountString(form.bgAmount, "BG amount");
      if (bgAmountError) {
        setToast(bgAmountError);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await onUpdate(editingId, payload);
        setToast("Contract updated.");
      } else {
        await onCreate(payload);
        setToast("Contract added.");
      }
      setModalOpen(false);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (contract: Contract) => {
    if (!window.confirm(`Delete contract ${contract.contractNo}?`)) return;
    try {
      await onDelete(contract.id);
      setToast("Contract deleted.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const items = await parseContractsWorkbook(buffer);
      if (items.length === 0) {
        setToast("No contract rows found in the spreadsheet.");
        return;
      }
      const result = await onImport(items);
      setToast(
        `Import complete: ${result.created} added, ${result.updated} updated, ${result.skipped} skipped.`,
      );
      await onRefresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Contracts");
    const headers = [
      "Sr No",
      "Contract No",
      "Officer Name",
      "Office Name",
      "Corresponding",
      "From Date",
      "To Date",
      "Company Name",
      "Category",
      "Extension",
      "BG Applicable",
      "BG Number",
      "BG Amount",
      "BG Bank",
      "BG Expiry",
      "BG Details",
      "DDO Name",
      "DDO Issuing Details",
      "Tender Bid No",
      "Contract Value",
      "Status",
      "Notes",
    ];
    sheet.addRow(headers);
    filtered.forEach((c, index) => {
      sheet.addRow([
        index + 1,
        c.contractNo,
        c.officerName,
        c.officeName,
        c.correspondingOffice,
        c.fromDate,
        c.toDate,
        c.companyName,
        c.category,
        c.hasExtension ? "Yes" : "No",
        c.bgApplicable ? "Yes" : "No",
        c.bgNumber,
        c.bgAmount,
        c.bgIssuingBank,
        c.bgExpiryDate,
        c.bgDetails,
        c.ddoName,
        c.ddoIssuingDetails,
        c.tenderBidNo,
        c.contractValue,
        STATUS_LABELS[c.status] || c.status,
        c.notes,
      ]);
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contracts_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    setToast(`Exported ${filtered.length} contract(s).`);
  };

  const fillFromTender = (bidNo: string) => {
    const tender = tenders.find((t) => t.bidNo === bidNo);
    if (!tender) return;
    setForm((prev) => ({
      ...prev,
      tenderBidNo: tender.bidNo,
      officerName: tender.officerName || prev.officerName,
      officeName: tender.department || prev.officeName,
      category: tender.category || prev.category,
      contractType: tender.tenderType,
      companyName: tender.tenderType === "travel" ? "Travel Plus" : prev.companyName,
    }));
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
              <FileText className="text-[#ff791a]" size={20} />
              Awarded Contracts
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track contract periods, extensions, bank guarantees, and DDO details
            </p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                id="contracts-import-file"
                name="contracts-import-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                aria-label="Import contracts from Excel"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => void handleExport()}
                className="px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                Export Excel
              </button>
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
                Add Contract
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pt-4 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {[
            { label: "Total", value: stats.total, icon: FileSpreadsheet, tone: "text-slate-700", bg: "bg-slate-50" },
            { label: "Active", value: stats.active, icon: CheckCircle2, tone: "text-emerald-600", bg: "bg-emerald-50/80" },
            { label: "Expiring (60d)", value: stats.expiringSoon, icon: Clock, tone: "text-amber-600", bg: "bg-amber-50/80" },
            { label: "Expired", value: stats.expired, icon: AlertTriangle, tone: "text-red-600", bg: "bg-red-50/80" },
            { label: "BG Due (30d)", value: stats.bgDue, icon: Shield, tone: "text-violet-600", bg: "bg-violet-50/80" },
          ].map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className={`rounded-xl border border-slate-100 ${bg} px-3 py-2.5`}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <Icon size={14} className={tone} />
              </div>
              <p className={`text-xl font-extrabold mt-0.5 ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="contracts-search"
              name="contracts-search"
              type="search"
              aria-label="Search contracts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contract no, company, officer, DDO, BG…"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <select
            id="contracts-type-filter"
            name="contracts-type-filter"
            aria-label="Filter by contract type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | ContractType)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All types</option>
            <option value="manpower">Manpower</option>
            <option value="travel">Travel Plus</option>
          </select>
          <select
            id="contracts-status-filter"
            name="contracts-status-filter"
            aria-label="Filter by contract status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | ContractStatus)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as ContractStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            id="contracts-expiry-filter"
            name="contracts-expiry-filter"
            aria-label="Filter by expiry"
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value as typeof expiryFilter)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="all">All expiry</option>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring in 60 days</option>
            <option value="expired">Expired</option>
          </select>
          <label className="flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white cursor-pointer">
            <input
              id="contracts-bg-due-filter"
              name="contracts-bg-due-filter"
              type="checkbox"
              aria-label="Show contracts with bank guarantee due soon"
              checked={bgDueOnly}
              onChange={(e) => setBgDueOnly(e.target.checked)}
              className="rounded"
            />
            BG due soon
          </label>
        </div>

        <DateRangeField
          title="Filter by end date"
          field="toDate"
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          onClear={() => { setDateFrom(""); setDateTo(""); }}
        />
      </div>

      <div className="flex-1 overflow-auto px-5 pb-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-center">
            <div>
              <FileText size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500 font-semibold">No contracts found</p>
              <p className="text-xs text-slate-400 mt-1">Add a contract or import from Excel.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table
              className="w-full text-xs table-fixed border-collapse"
              style={{ minWidth: tableMinWidth }}
            >
              <colgroup>
                {visibleColumns.map((column) => (
                  <col key={column.key} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-2 py-2 border-b border-slate-200 border-r border-slate-100 last:border-r-0 ${
                        column.key === "hasExtension" || column.key === "bgApplicable"
                          ? "text-center"
                          : column.key === "actions"
                            ? "text-right"
                            : "text-left"
                      }`}
                      style={{ height: CONTRACT_ROW_HEIGHT_PX }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((contract, index) => {
                  const end = effectiveEndDate(contract);
                  const endMeta = endDateMeta(end);
                  const isExpanded = expandedId === contract.id;
                  const pdfUrl = resolveGemContractPdfUrl(contract);
                  const contractLabel = resolveGemContractNoLabel(contract);

                  const activateCell = (columnKey: ContractColumnKey) => {
                    if (columnKey === "actions") return;
                    toggleContractRow(contract.id, columnKey);
                  };

                  return (
                    <React.Fragment key={contract.id}>
                      <tr
                        className={`border-t border-slate-100 ${
                          isExpanded ? "bg-orange-50/40" : "hover:bg-orange-50/30"
                        }`}
                      >
                        <ContractTableCell
                          onActivate={() => toggleContractRow(contract.id, "expand")}
                          className="cursor-pointer"
                        >
                          <span className="inline-flex text-slate-400">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={String(index + 1)}
                          onActivate={() => activateCell("index")}
                          className="text-slate-400 font-mono cursor-pointer"
                        >
                          {index + 1}
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={pdfUrl || contractLabel}
                          onActivate={() => activateCell("contractNo")}
                          className="font-semibold text-slate-800 cursor-pointer"
                        >
                          {pdfUrl ? (
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline max-w-full"
                              title={pdfUrl}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <span className="truncate">{contractLabel}</span>
                              <ExternalLink size={12} className="shrink-0" />
                            </a>
                          ) : (
                            contractLabel
                          )}
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={contract.officerName}
                          onActivate={() => activateCell("officerName")}
                          className="text-slate-700 cursor-pointer"
                        >
                          {displayValue(contract.officerName)}
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={contract.officeName}
                          onActivate={() => activateCell("officeName")}
                          className="text-slate-700 cursor-pointer"
                        >
                          {displayValue(contract.officeName)}
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={formatAppDate(contract.fromDate) || contract.fromDate}
                          onActivate={() => activateCell("fromDate")}
                          className="text-slate-600 cursor-pointer"
                        >
                          {formatAppDate(contract.fromDate) || "—"}
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={endMeta.label}
                          onActivate={() => activateCell("toDate")}
                          className={`${endMeta.className} cursor-pointer`}
                        >
                          <span className="inline-flex items-center gap-1 max-w-full">
                            <span className="truncate">{endMeta.label}</span>
                            {contract.hasExtension && contract.extensionEndDate && (
                              <span className="text-[10px] text-violet-600 font-bold shrink-0">EXT</span>
                            )}
                          </span>
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={contract.companyName}
                          onActivate={() => activateCell("companyName")}
                          className="text-slate-700 cursor-pointer"
                        >
                          {displayValue(contract.companyName)}
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={contract.category}
                          onActivate={() => activateCell("category")}
                          className="text-slate-600 cursor-pointer"
                        >
                          {displayValue(contract.category)}
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={contract.hasExtension ? "Yes" : "No"}
                          onActivate={() => activateCell("hasExtension")}
                          align="center"
                          className="cursor-pointer"
                        >
                          {contract.hasExtension ? (
                            <span className="text-emerald-600 font-bold">Yes</span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={contract.bgApplicable ? "Yes" : "No"}
                          onActivate={() => activateCell("bgApplicable")}
                          align="center"
                          className="cursor-pointer"
                        >
                          {contract.bgApplicable ? (
                            <span className="text-violet-600 font-bold">Yes</span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </ContractTableCell>

                        <ContractTableCell
                          fullText={STATUS_LABELS[contract.status]}
                          onActivate={() => activateCell("status")}
                          className="cursor-pointer"
                        >
                          <span
                            className={`inline-flex max-w-full truncate px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[contract.status]}`}
                          >
                            {STATUS_LABELS[contract.status]}
                          </span>
                        </ContractTableCell>

                        {!readOnly && (
                          <ContractTableCell align="right" className="whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void openEdit(contract)}
                              disabled={editLoading && editingId === contract.id}
                              className="text-sky-600 hover:text-sky-800 font-bold mr-2 disabled:opacity-50"
                            >
                              {editLoading && editingId === contract.id ? "Loading…" : "Edit"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(contract)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 size={14} className="inline" />
                            </button>
                          </ContractTableCell>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-t border-orange-100">
                          <td colSpan={visibleColumns.length} className="px-2 py-1">
                            <p className="px-2 pt-2 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                              Full contract details
                            </p>
                            <ContractExpandedDetails
                              contract={contract}
                              highlightKey={expandedColumnKey}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
          {toast}
          <button type="button" onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900">
                {editingId ? "Edit Contract" : "Add Contract"}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {wonTenders.length > 0 && !editingId && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400" htmlFor="contract-form-won-tender">
                    Fill from won tender
                  </label>
                  <select
                    id="contract-form-won-tender"
                    name="wonTender"
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) fillFromTender(e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Select a won tender…</option>
                    {wonTenders.map((t) => (
                      <option key={t.id} value={t.bidNo}>{t.bidNo} — {t.category}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block" htmlFor="contract-form-contractNo">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Contract No *</span>
                  <input
                    id="contract-form-contractNo"
                    name="contractNo"
                    value={form.contractNo}
                    onChange={(e) => setForm({ ...form, contractNo: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block" htmlFor="contract-form-companyName">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Company Name</span>
                  <input
                    id="contract-form-companyName"
                    name="companyName"
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    placeholder="Travel Plus / Intelligic"
                  />
                </label>
                <label className="block" htmlFor="contract-form-officerName">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Officer Name</span>
                  <input
                    id="contract-form-officerName"
                    name="officerName"
                    value={form.officerName}
                    onChange={(e) => setForm({ ...form, officerName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block" htmlFor="contract-form-officeName">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Office Name</span>
                  <input
                    id="contract-form-officeName"
                    name="officeName"
                    value={form.officeName}
                    onChange={(e) => setForm({ ...form, officeName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block" htmlFor="contract-form-fromDate">
                  <span className="text-[10px] font-bold uppercase text-slate-400">From Date</span>
                  <DateInput
                    id="contract-form-fromDate"
                    name="fromDate"
                    value={fromDateIso}
                    onChange={(e) => setFromDateIso(e.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="block" htmlFor="contract-form-toDate">
                  <span className="text-[10px] font-bold uppercase text-slate-400">To Date</span>
                  <DateInput
                    id="contract-form-toDate"
                    name="toDate"
                    value={toDateIso}
                    onChange={(e) => setToDateIso(e.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="block" htmlFor="contract-form-category">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Category</span>
                  <input
                    id="contract-form-category"
                    name="category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block" htmlFor="contract-form-contractType">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Contract Type</span>
                  <select
                    id="contract-form-contractType"
                    name="contractType"
                    value={form.contractType}
                    onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  >
                    <option value="manpower">Manpower</option>
                    <option value="travel">Travel Plus</option>
                  </select>
                </label>
                <label className="block" htmlFor="contract-form-contractValue">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Contract Value</span>
                  <input
                    id="contract-form-contractValue"
                    name="contractValue"
                    type="number"
                    min={0}
                    step="any"
                    value={form.contractValue}
                    onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block" htmlFor="contract-form-tenderBidNo">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Tender Bid No</span>
                  <input
                    id="contract-form-tenderBidNo"
                    name="tenderBidNo"
                    value={form.tenderBidNo}
                    onChange={(e) => setForm({ ...form, tenderBidNo: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
              </div>

              <div className="border border-orange-100 rounded-xl p-3 space-y-3 bg-orange-50/30">
                <div>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#ff791a]" />
                    Link Office Locations
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Assign worksite locations to this contract in priority order. Employees at a linked location can be mapped directly to this contract.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    id="contract-form-location-to-add"
                    name="locationToAdd"
                    aria-label="Select office location to link"
                    value={locationToAdd}
                    onChange={(e) => setLocationToAdd(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">
                      {addableLocations.length > 0 ? "Select office location…" : "No more locations available"}
                    </option>
                    {addableLocations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addLinkedLocation}
                    disabled={!locationToAdd.trim()}
                    className="px-3 py-2 text-xs font-bold text-white bg-[#ff791a] hover:bg-[#e4640c] rounded-lg disabled:opacity-50"
                  >
                    Add Location
                  </button>
                </div>

                {(form.linkedLocations || []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No office locations linked yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(form.linkedLocations || []).map((loc, index) => {
                      const conflicts = otherContractsUsingLocation(loc, contracts, editingId || undefined);
                      return (
                        <div
                          key={`${loc}-${index}`}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                          <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">{index + 1}.</span>
                          <span className="flex-1 text-xs font-semibold text-slate-800 truncate">{loc}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveLinkedLocation(index, -1)}
                              disabled={index === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                              title="Move up"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLinkedLocation(index, 1)}
                              disabled={index === (form.linkedLocations || []).length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                              title="Move down"
                            >
                              <ChevronDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLinkedLocation(index)}
                              className="p-1 text-red-400 hover:text-red-600"
                              title="Remove"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {conflicts.length > 0 && (
                            <span
                              className="hidden lg:inline text-[10px] text-amber-700 font-semibold max-w-[220px] truncate"
                              title={`Also linked on: ${conflicts.map((c) => c.contractNo).join(", ")}`}
                            >
                              Also on {conflicts.map((c) => c.contractNo).join(", ")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border border-slate-100 rounded-xl p-3 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700" htmlFor="contract-form-hasExtension">
                  <input
                    id="contract-form-hasExtension"
                    name="hasExtension"
                    type="checkbox"
                    checked={form.hasExtension}
                    onChange={(e) => setForm({ ...form, hasExtension: e.target.checked })}
                  />
                  Extension granted
                </label>
                {form.hasExtension && (
                  <label className="block" htmlFor="contract-form-extensionEndDate">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Extension End Date</span>
                    <DateInput
                      id="contract-form-extensionEndDate"
                      name="extensionEndDate"
                      value={extensionEndIso}
                      onChange={(e) => setExtensionEndIso(e.target.value)}
                      className="mt-1"
                    />
                  </label>
                )}
              </div>

              <div className="border border-slate-100 rounded-xl p-3 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700" htmlFor="contract-form-bgApplicable">
                  <input
                    id="contract-form-bgApplicable"
                    name="bgApplicable"
                    type="checkbox"
                    checked={form.bgApplicable}
                    onChange={(e) => setForm({ ...form, bgApplicable: e.target.checked })}
                  />
                  Bank Guarantee applicable
                </label>
                {form.bgApplicable && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block" htmlFor="contract-form-bgNumber">
                      <span className="text-[10px] font-bold uppercase text-slate-400">BG Number</span>
                      <input
                        id="contract-form-bgNumber"
                        name="bgNumber"
                        value={form.bgNumber}
                        onChange={(e) => setForm({ ...form, bgNumber: e.target.value })}
                        className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </label>
                    <label className="block" htmlFor="contract-form-bgAmount">
                      <span className="text-[10px] font-bold uppercase text-slate-400">BG Amount</span>
                      <input
                        id="contract-form-bgAmount"
                        name="bgAmount"
                        type="number"
                        min={0}
                        step="any"
                        value={form.bgAmount}
                        onChange={(e) => setForm({ ...form, bgAmount: e.target.value })}
                        className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </label>
                    <label className="block" htmlFor="contract-form-bgIssuingBank">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Issuing Bank</span>
                      <input
                        id="contract-form-bgIssuingBank"
                        name="bgIssuingBank"
                        value={form.bgIssuingBank}
                        onChange={(e) => setForm({ ...form, bgIssuingBank: e.target.value })}
                        className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </label>
                    <label className="block" htmlFor="contract-form-bgExpiryDate">
                      <span className="text-[10px] font-bold uppercase text-slate-400">BG Expiry</span>
                      <DateInput
                        id="contract-form-bgExpiryDate"
                        name="bgExpiryDate"
                        value={bgExpiryIso}
                        onChange={(e) => setBgExpiryIso(e.target.value)}
                        className="mt-1"
                      />
                    </label>
                    <label className="block sm:col-span-2" htmlFor="contract-form-bgDetails">
                      <span className="text-[10px] font-bold uppercase text-slate-400">BG Details</span>
                      <textarea
                        id="contract-form-bgDetails"
                        name="bgDetails"
                        value={form.bgDetails}
                        onChange={(e) => setForm({ ...form, bgDetails: e.target.value })}
                        rows={2}
                        className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                        placeholder="Branch, validity, issuing details…"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block" htmlFor="contract-form-ddoName">
                  <span className="text-[10px] font-bold uppercase text-slate-400">DDO Name</span>
                  <input
                    id="contract-form-ddoName"
                    name="ddoName"
                    value={form.ddoName}
                    onChange={(e) => setForm({ ...form, ddoName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block" htmlFor="contract-form-status">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Status</span>
                  <select
                    id="contract-form-status"
                    name="status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  >
                    {(Object.keys(STATUS_LABELS) as ContractStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2" htmlFor="contract-form-ddoIssuingDetails">
                  <span className="text-[10px] font-bold uppercase text-slate-400">DDO Issuing Details</span>
                  <textarea
                    id="contract-form-ddoIssuingDetails"
                    name="ddoIssuingDetails"
                    value={form.ddoIssuingDetails}
                    onChange={(e) => setForm({ ...form, ddoIssuingDetails: e.target.value })}
                    rows={2}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    placeholder="Issuing authority, bank, etc."
                  />
                </label>
                <label className="block sm:col-span-2" htmlFor="contract-form-notes">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Notes</span>
                  <textarea
                    id="contract-form-notes"
                    name="notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
              </div>
            </div>
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-100 px-5 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-[#ff791a] hover:bg-[#e4640c] rounded-lg disabled:opacity-50"
              >
                {submitting ? "Saving…" : editingId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
