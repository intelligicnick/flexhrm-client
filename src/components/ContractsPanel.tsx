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
  Shield,
} from "lucide-react";
import {
  Contract,
  ContractType,
  ContractStatus,
  CreateContractInput,
  Tender,
} from "../types";
import {
  parseFlexibleDateMs,
  matchesIsoDateRange,
  formatAppDate,
} from "../lib/date-helpers";
import DateRangeField from "./ui/DateRangeField";
import { DateInput } from "./ui/DateInput";

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
};

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

function ContractExpandedDetails({ contract }: { contract: Contract }) {
  const rows = [
    { label: "Corresponding office", value: contract.correspondingOffice },
    { label: "Contract value", value: contract.contractValue },
    { label: "Linked tender", value: contract.tenderBidNo },
    { label: "Extension end date", value: contract.extensionEndDate },
    { label: "BG number", value: contract.bgNumber },
    { label: "BG amount", value: contract.bgAmount },
    { label: "BG issuing bank", value: contract.bgIssuingBank },
    { label: "BG expiry", value: contract.bgExpiryDate },
    { label: "BG details", value: contract.bgDetails },
    { label: "DDO name", value: contract.ddoName },
    { label: "DDO issuing details", value: contract.ddoIssuingDetails },
    { label: "Notes", value: contract.notes },
  ].filter((r) => r.value?.trim());

  if (rows.length === 0) {
    return <p className="text-xs text-slate-400 italic px-2 py-1">No additional details.</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 px-2 py-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="bg-slate-50 rounded-lg border border-slate-100 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">{value}</p>
        </div>
      ))}
    </div>
  );
}

interface ContractsPanelProps {
  contracts: Contract[];
  tenders?: Tender[];
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
  const [importing, setImporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    setModalOpen(true);
  };

  const openEdit = (contract: Contract) => {
    setEditingId(contract.id);
    setForm({
      contractNo: contract.contractNo,
      officerName: contract.officerName,
      officeName: contract.officeName,
      correspondingOffice: contract.correspondingOffice,
      fromDate: contract.fromDate,
      toDate: contract.toDate,
      companyName: contract.companyName,
      category: contract.category,
      contractType: contract.contractType,
      hasExtension: contract.hasExtension,
      extensionEndDate: contract.extensionEndDate,
      bgApplicable: contract.bgApplicable,
      bgNumber: contract.bgNumber,
      bgAmount: contract.bgAmount,
      bgIssuingBank: contract.bgIssuingBank,
      bgExpiryDate: contract.bgExpiryDate,
      bgDetails: contract.bgDetails,
      ddoName: contract.ddoName,
      ddoIssuingDetails: contract.ddoIssuingDetails,
      tenderBidNo: contract.tenderBidNo,
      contractValue: contract.contractValue,
      status: contract.status,
      notes: contract.notes,
      entryDate: contract.entryDate,
    });
    setFromDateIso("");
    setToDateIso("");
    setExtensionEndIso("");
    setBgExpiryIso("");
    setModalOpen(true);
  };

  const buildPayload = (): CreateContractInput => ({
    ...form,
    fromDate: fromDateIso || form.fromDate,
    toDate: toDateIso || form.toDate,
    extensionEndDate: form.hasExtension ? extensionEndIso || form.extensionEndDate : "",
    bgExpiryDate: form.bgApplicable ? bgExpiryIso || form.bgExpiryDate : "",
    entryDate: form.entryDate || new Date().toISOString().slice(0, 10),
  });

  const handleSubmit = async () => {
    if (!form.contractNo.trim()) {
      setToast("Contract number is required.");
      return;
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
      correspondingOffice: tender.address || prev.correspondingOffice,
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contract no, company, officer, DDO, BG…"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | ContractType)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All types</option>
            <option value="manpower">Manpower</option>
            <option value="travel">Travel Plus</option>
          </select>
          <select
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
              type="checkbox"
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
            <table className="w-full text-xs min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                  <th className="px-2 py-2 text-left w-8" />
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Contract No</th>
                  <th className="px-2 py-2 text-left">Officer</th>
                  <th className="px-2 py-2 text-left">Office</th>
                  <th className="px-2 py-2 text-left">From</th>
                  <th className="px-2 py-2 text-left">To / Extended</th>
                  <th className="px-2 py-2 text-left">Company</th>
                  <th className="px-2 py-2 text-left">Category</th>
                  <th className="px-2 py-2 text-center">Ext</th>
                  <th className="px-2 py-2 text-center">BG</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  {!readOnly && <th className="px-2 py-2 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((contract, index) => {
                  const end = effectiveEndDate(contract);
                  const endMeta = endDateMeta(end);
                  const isExpanded = expandedId === contract.id;
                  return (
                    <React.Fragment key={contract.id}>
                      <tr className="border-t border-slate-100 hover:bg-orange-50/30">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : contract.id)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-slate-400 font-mono">{index + 1}</td>
                        <td className="px-2 py-2 font-semibold text-slate-800">{contract.contractNo}</td>
                        <td className="px-2 py-2 text-slate-700">{contract.officerName || "—"}</td>
                        <td className="px-2 py-2 text-slate-700">{contract.officeName || "—"}</td>
                        <td className="px-2 py-2 text-slate-600">{formatAppDate(contract.fromDate) || "—"}</td>
                        <td className={`px-2 py-2 ${endMeta.className}`}>
                          {endMeta.label}
                          {contract.hasExtension && contract.extensionEndDate && (
                            <span className="ml-1 text-[10px] text-violet-600 font-bold">EXT</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-slate-700">{contract.companyName || "—"}</td>
                        <td className="px-2 py-2 text-slate-600">{contract.category || "—"}</td>
                        <td className="px-2 py-2 text-center">
                          {contract.hasExtension ? (
                            <span className="text-emerald-600 font-bold">Yes</span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {contract.bgApplicable ? (
                            <span className="text-violet-600 font-bold">Yes</span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[contract.status]}`}>
                            {STATUS_LABELS[contract.status]}
                          </span>
                        </td>
                        {!readOnly && (
                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEdit(contract)}
                              className="text-sky-600 hover:text-sky-800 font-bold mr-2"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(contract)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 size={14} className="inline" />
                            </button>
                          </td>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={readOnly ? 12 : 13}>
                            <ContractExpandedDetails contract={contract} />
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
                  <label className="text-[10px] font-bold uppercase text-slate-400">Fill from won tender</label>
                  <select
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
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Contract No *</span>
                  <input
                    value={form.contractNo}
                    onChange={(e) => setForm({ ...form, contractNo: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Company Name</span>
                  <input
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    placeholder="Travel Plus / Intelligic"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Officer Name</span>
                  <input
                    value={form.officerName}
                    onChange={(e) => setForm({ ...form, officerName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Office Name</span>
                  <input
                    value={form.officeName}
                    onChange={(e) => setForm({ ...form, officeName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Corresponding Office</span>
                  <input
                    value={form.correspondingOffice}
                    onChange={(e) => setForm({ ...form, correspondingOffice: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">From Date</span>
                  <DateInput value={fromDateIso} onChange={(e) => setFromDateIso(e.target.value)} className="mt-1" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">To Date</span>
                  <DateInput value={toDateIso} onChange={(e) => setToDateIso(e.target.value)} className="mt-1" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Category</span>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Contract Type</span>
                  <select
                    value={form.contractType}
                    onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  >
                    <option value="manpower">Manpower</option>
                    <option value="travel">Travel Plus</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Contract Value</span>
                  <input
                    value={form.contractValue}
                    onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Tender Bid No</span>
                  <input
                    value={form.tenderBidNo}
                    onChange={(e) => setForm({ ...form, tenderBidNo: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
              </div>

              <div className="border border-slate-100 rounded-xl p-3 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.hasExtension}
                    onChange={(e) => setForm({ ...form, hasExtension: e.target.checked })}
                  />
                  Extension granted
                </label>
                {form.hasExtension && (
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Extension End Date</span>
                    <DateInput value={extensionEndIso} onChange={(e) => setExtensionEndIso(e.target.value)} className="mt-1" />
                  </label>
                )}
              </div>

              <div className="border border-slate-100 rounded-xl p-3 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.bgApplicable}
                    onChange={(e) => setForm({ ...form, bgApplicable: e.target.checked })}
                  />
                  Bank Guarantee applicable
                </label>
                {form.bgApplicable && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-slate-400">BG Number</span>
                      <input
                        value={form.bgNumber}
                        onChange={(e) => setForm({ ...form, bgNumber: e.target.value })}
                        className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-slate-400">BG Amount</span>
                      <input
                        value={form.bgAmount}
                        onChange={(e) => setForm({ ...form, bgAmount: e.target.value })}
                        className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Issuing Bank</span>
                      <input
                        value={form.bgIssuingBank}
                        onChange={(e) => setForm({ ...form, bgIssuingBank: e.target.value })}
                        className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-slate-400">BG Expiry</span>
                      <DateInput value={bgExpiryIso} onChange={(e) => setBgExpiryIso(e.target.value)} className="mt-1" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">BG Details</span>
                      <textarea
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
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">DDO Name</span>
                  <input
                    value={form.ddoName}
                    onChange={(e) => setForm({ ...form, ddoName: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  >
                    {(Object.keys(STATUS_LABELS) as ContractStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">DDO Issuing Details</span>
                  <textarea
                    value={form.ddoIssuingDetails}
                    onChange={(e) => setForm({ ...form, ddoIssuingDetails: e.target.value })}
                    rows={2}
                    className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    placeholder="Issuing authority, bank, etc."
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Notes</span>
                  <textarea
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
