import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Landmark,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  BankInstrument,
  BankInstrumentDocument,
  BankInstrumentStatus,
  BankInstrumentType,
  Contract,
  CreateBankInstrumentInput,
} from "../types";
import {
  BANK_INSTRUMENT_STATUS_LABELS,
  BANK_INSTRUMENT_TYPE_LABELS,
  deleteBankInstrumentDocument,
  fetchBankInstrumentDocuments,
  getBankInstrumentDocumentUrl,
  uploadBankInstrumentDocumentsBulk,
  type UploadBankInstrumentDocumentPayload,
} from "../lib/bank-instruments";
import { formatAppDate, parseFlexibleDateMs } from "../lib/date-helpers";
import { DateInput } from "./ui/DateInput";
import { useAuthenticatedBlobUrl } from "../hooks/useAuthenticatedBlobUrl";
import {
  compressImageDataUrl,
  formatFileSize,
  isImageFile,
  isPdfFile,
  readFileAsDataUrl,
  readPdfAsDataUrl,
} from "../lib/image-compress";

const STATUS_STYLES: Record<BankInstrumentStatus, string> = {
  submitted_to_dept: "bg-sky-50 text-sky-700 border-sky-200",
  received_from_department: "bg-emerald-50 text-emerald-700 border-emerald-200",
  returned_to_bank: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled_received_fd: "bg-violet-50 text-violet-700 border-violet-200",
  money_credited_back: "bg-slate-100 text-slate-700 border-slate-200",
};

const EMPTY_FORM: CreateBankInstrumentInput = {
  instrumentType: "bg",
  instrumentNumber: "",
  beneficiary: "",
  dateOfIssue: "",
  expiryDate: "",
  issuingBank: "",
  contractId: "",
  contractNo: "",
  status: "submitted_to_dept",
  notes: "",
  entryDate: new Date().toISOString().slice(0, 10),
};

interface BgDdPanelProps {
  instruments: BankInstrument[];
  contracts: Contract[];
  readOnly?: boolean;
  onRefresh: () => Promise<void>;
  onCreate: (payload: CreateBankInstrumentInput) => Promise<BankInstrument>;
  onUpdate: (id: string, payload: Partial<CreateBankInstrumentInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type TypeFilter = "" | BankInstrumentType;
type StatusFilter = "" | BankInstrumentStatus;
type ExpiryFilter = "all" | "active" | "expiring_soon" | "expired";

function expiryMeta(expiryDate: string): {
  label: string;
  className: string;
} {
  const ts = parseFlexibleDateMs(expiryDate);
  if (!expiryDate.trim()) {
    return { label: "—", className: "text-slate-400" };
  }
  if (ts === null) {
    return { label: expiryDate, className: "text-slate-700" };
  }
  const now = Date.now();
  const diffDays = (ts - now) / (1000 * 60 * 60 * 24);
  const formatted = formatAppDate(expiryDate);
  if (diffDays < 0) {
    return { label: formatted, className: "text-red-700 font-semibold" };
  }
  if (diffDays <= 60) {
    return { label: formatted, className: "text-amber-700 font-semibold" };
  }
  return { label: formatted, className: "text-slate-700" };
}

function dataUrlToPayloadBase64(dataUrl: string): string {
  return dataUrl.includes(",") ? dataUrl.split(",").pop()!.trim() : dataUrl;
}

function DocumentPreviewButton({
  instrumentId,
  doc,
}: {
  instrumentId: string;
  doc: BankInstrumentDocument;
}) {
  const url = getBankInstrumentDocumentUrl(instrumentId, doc.id);
  const blobUrl = useAuthenticatedBlobUrl(url);
  const isPdf = doc.mimeType === "application/pdf";

  return (
    <a
      href={blobUrl || url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100"
    >
      {isPdf ? <FileText size={11} /> : <Eye size={11} />}
      {doc.label || "Copy"}
    </a>
  );
}

export default function BgDdPanel({
  instruments,
  contracts,
  readOnly = false,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}: BgDdPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankInstrument | null>(null);
  const [form, setForm] = useState<CreateBankInstrumentInput>(EMPTY_FORM);
  const [issueDateIso, setIssueDateIso] = useState("");
  const [expiryDateIso, setExpiryDateIso] = useState("");
  const [saving, setSaving] = useState(false);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [modalDocs, setModalDocs] = useState<BankInstrumentDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<UploadBankInstrumentDocumentPayload[]>([]);
  const [uploadingCopy, setUploadingCopy] = useState(false);

  const loadDocCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    await Promise.all(
      instruments.map(async (item) => {
        try {
          const docs = await fetchBankInstrumentDocuments(item.id);
          counts[item.id] = docs.length;
        } catch {
          counts[item.id] = 0;
        }
      }),
    );
    setDocCounts(counts);
  }, [instruments]);

  useEffect(() => {
    if (instruments.length === 0) {
      setDocCounts({});
      return;
    }
    void loadDocCounts();
  }, [instruments, loadDocCounts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();
    const soonCutoff = now + 60 * 24 * 60 * 60 * 1000;

    return instruments.filter((item) => {
      if (typeFilter && item.instrumentType !== typeFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;

      if (expiryFilter !== "all") {
        const ts = parseFlexibleDateMs(item.expiryDate);
        if (ts === null) {
          if (expiryFilter !== "active") return false;
        } else if (expiryFilter === "expired" && ts >= now) return false;
        else if (expiryFilter === "expiring_soon" && (ts < now || ts > soonCutoff)) return false;
        else if (expiryFilter === "active" && ts < now) return false;
      }

      if (!term) return true;
      const haystack = [
        item.instrumentNumber,
        item.beneficiary,
        item.issuingBank,
        item.contractNo,
        item.notes,
        BANK_INSTRUMENT_TYPE_LABELS[item.instrumentType],
        BANK_INSTRUMENT_STATUS_LABELS[item.status],
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [instruments, search, typeFilter, statusFilter, expiryFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    const soonCutoff = now + 60 * 24 * 60 * 60 * 1000;
    let expiringSoon = 0;
    let expired = 0;
    let bgCount = 0;
    let ddCount = 0;

    for (const item of instruments) {
      if (item.instrumentType === "bg") bgCount += 1;
      else ddCount += 1;
      const ts = parseFlexibleDateMs(item.expiryDate);
      if (ts !== null) {
        if (ts < now) expired += 1;
        else if (ts <= soonCutoff) expiringSoon += 1;
      }
    }

    return { total: instruments.length, bgCount, ddCount, expiringSoon, expired };
  }, [instruments]);

  const contractOptions = useMemo(
    () =>
      [...contracts]
        .sort((a, b) => a.contractNo.localeCompare(b.contractNo))
        .map((c) => ({ id: c.id, label: `${c.contractNo} — ${c.companyName || c.officeName}` })),
    [contracts],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, entryDate: new Date().toISOString().slice(0, 10) });
    setIssueDateIso("");
    setExpiryDateIso("");
    setModalDocs([]);
    setPendingUploads([]);
    setModalOpen(true);
  };

  const openEdit = async (item: BankInstrument) => {
    setEditing(item);
    setForm({
      instrumentType: item.instrumentType,
      instrumentNumber: item.instrumentNumber,
      beneficiary: item.beneficiary,
      dateOfIssue: item.dateOfIssue,
      expiryDate: item.expiryDate,
      issuingBank: item.issuingBank,
      contractId: item.contractId,
      contractNo: item.contractNo,
      status: item.status,
      notes: item.notes,
      entryDate: item.entryDate,
    });
    setIssueDateIso(item.dateOfIssue);
    setExpiryDateIso(item.expiryDate);
    setPendingUploads([]);
    setModalOpen(true);
    setLoadingDocs(true);
    try {
      setModalDocs(await fetchBankInstrumentDocuments(item.id));
    } catch {
      setModalDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setPendingUploads([]);
  };

  const buildPayload = (): CreateBankInstrumentInput => ({
    ...form,
    dateOfIssue: issueDateIso || form.dateOfIssue,
    expiryDate: expiryDateIso || form.expiryDate,
  });

  const handleSave = async () => {
    if (!form.instrumentNumber.trim()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await onUpdate(editing.id, payload);
        if (pendingUploads.length > 0) {
          await uploadBankInstrumentDocumentsBulk(editing.id, pendingUploads);
        }
      } else {
        const created = await onCreate(payload);
        if (pendingUploads.length > 0) {
          await uploadBankInstrumentDocumentsBulk(created.id, pendingUploads);
        }
      }
      await onRefresh();
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this BG/DD record?")) return;
    await onDelete(id);
    await onRefresh();
  };

  const handleContractChange = (contractId: string) => {
    const match = contracts.find((c) => c.id === contractId);
    setForm({
      ...form,
      contractId,
      contractNo: match?.contractNo || "",
    });
  };

  const handleFilePick = async (files: FileList | null) => {
    if (!files?.length || readOnly) return;
    setUploadingCopy(true);
    try {
      const uploads: UploadBankInstrumentDocumentPayload[] = [];
      for (const file of Array.from(files).slice(0, 3)) {
        if (!isImageFile(file) && !isPdfFile(file)) continue;
        const originalSizeBytes = file.size;
        let mimeType = file.type;
        let dataUrl: string;

        if (isPdfFile(file)) {
          const pdf = await readPdfAsDataUrl(file);
          dataUrl = pdf.dataUrl;
          mimeType = pdf.mimeType;
        } else {
          const raw = await readFileAsDataUrl(file);
          const compressed = await compressImageDataUrl(raw, 0.82);
          dataUrl = compressed.dataUrl;
          mimeType = compressed.mimeType;
        }

        uploads.push({
          label: file.name.replace(/\.[^.]+$/, "") || "BG Copy",
          mimeType,
          fileBase64: dataUrlToPayloadBase64(dataUrl),
          originalSizeBytes,
          quality: 82,
        });
      }
      setPendingUploads((prev) => [...prev, ...uploads]);
    } finally {
      setUploadingCopy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteExistingDoc = async (docId: string) => {
    if (!editing || readOnly) return;
    if (!window.confirm("Remove this uploaded copy?")) return;
    await deleteBankInstrumentDocument(editing.id, docId);
    setModalDocs(await fetchBankInstrumentDocuments(editing.id));
    await loadDocCounts();
  };

  return (
    <section className="flex-1 flex flex-col min-h-[400px] min-w-0 bg-white border border-slate-200 rounded-xl shadow-xs">
      <div className="bg-linear-to-r from-violet-50 via-white to-slate-50 border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Landmark size={18} className="text-violet-600" />
              <h2 className="text-sm font-extrabold text-slate-800">BG & DD Register</h2>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 max-w-2xl">
              Track bank guarantees and demand drafts — link BGs to contracts, upload copies, and monitor lifecycle status.
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={openCreate}
              className="px-3 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus size={14} /> Add BG / DD
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
          {[
            { label: "Total", value: stats.total, icon: Shield, tone: "text-slate-700", bg: "bg-slate-50" },
            { label: "BG", value: stats.bgCount, icon: Shield, tone: "text-violet-600", bg: "bg-violet-50/80" },
            { label: "DD", value: stats.ddCount, icon: FileText, tone: "text-sky-600", bg: "bg-sky-50/80" },
            { label: "Expiring (60d)", value: stats.expiringSoon, icon: Clock, tone: "text-amber-600", bg: "bg-amber-50/80" },
            { label: "Expired", value: stats.expired, icon: AlertTriangle, tone: "text-red-600", bg: "bg-red-50/80" },
          ].map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className={`rounded-xl border border-slate-100 ${bg} px-3 py-2.5`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-400">{label}</span>
                <Icon size={14} className={tone} />
              </div>
              <div className={`text-lg font-black ${tone}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, beneficiary, bank, contract…"
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-100"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
        >
          <option value="">All types</option>
          <option value="bg">BG only</option>
          <option value="dd">DD only</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
        >
          <option value="">All statuses</option>
          {(Object.keys(BANK_INSTRUMENT_STATUS_LABELS) as BankInstrumentStatus[]).map((key) => (
            <option key={key} value={key}>
              {BANK_INSTRUMENT_STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value as ExpiryFilter)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
        >
          <option value="all">All expiry</option>
          <option value="active">Active</option>
          <option value="expiring_soon">Expiring soon</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto px-5 py-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No BG/DD records found.
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                <th className="py-2 pr-3 text-left font-bold">#</th>
                <th className="py-2 pr-3 text-left font-bold">Type</th>
                <th className="py-2 pr-3 text-left font-bold">BG / DD No.</th>
                <th className="py-2 pr-3 text-left font-bold">Beneficiary</th>
                <th className="py-2 pr-3 text-left font-bold">Date of Issue</th>
                <th className="py-2 pr-3 text-left font-bold">Expiry Date</th>
                <th className="py-2 pr-3 text-left font-bold">Issuing Bank</th>
                <th className="py-2 pr-3 text-left font-bold">Linked Contract</th>
                <th className="py-2 pr-3 text-left font-bold">Status</th>
                <th className="py-2 pr-3 text-left font-bold">Copy</th>
                {!readOnly && <th className="py-2 text-right font-bold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => {
                const expiry = expiryMeta(item.expiryDate);
                return (
                  <tr
                    key={item.id}
                    className="border-t border-slate-100 hover:bg-violet-50/20 cursor-pointer"
                    onClick={() => !readOnly && openEdit(item)}
                  >
                    <td className="py-2.5 pr-3 text-slate-400">{index + 1}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.instrumentType === "bg"
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                        }`}
                      >
                        {BANK_INSTRUMENT_TYPE_LABELS[item.instrumentType]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-slate-800">
                      {item.instrumentNumber}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">{item.beneficiary || "—"}</td>
                    <td className="py-2.5 pr-3 text-slate-700">
                      {formatAppDate(item.dateOfIssue) || item.dateOfIssue || "—"}
                    </td>
                    <td className={`py-2.5 pr-3 ${expiry.className}`}>{expiry.label}</td>
                    <td className="py-2.5 pr-3 text-slate-700">{item.issuingBank || "—"}</td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-600">
                      {item.contractNo || "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[item.status]}`}
                      >
                        {BANK_INSTRUMENT_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {(docCounts[item.id] ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 size={12} /> {docCounts[item.id]} file(s)
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {!readOnly && (
                      <td className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800">
                {editing ? "Edit BG / DD" : "Add BG / DD"}
              </h3>
              <button type="button" onClick={closeModal} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-3">
                {(["bg", "dd"] as BankInstrumentType[]).map((type) => (
                  <label
                    key={type}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-bold ${
                      form.instrumentType === type
                        ? "border-[#ff791a] bg-orange-50 text-[#ff791a]"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={form.instrumentType === type}
                      onChange={() => setForm({ ...form, instrumentType: type })}
                    />
                    {BANK_INSTRUMENT_TYPE_LABELS[type]}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    {form.instrumentType === "bg" ? "BG" : "DD"} Number *
                  </span>
                  <input
                    value={form.instrumentNumber}
                    onChange={(e) => setForm({ ...form, instrumentNumber: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Beneficiary</span>
                  <input
                    value={form.beneficiary}
                    onChange={(e) => setForm({ ...form, beneficiary: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Date of Issue</span>
                  <DateInput value={issueDateIso} onChange={(e) => setIssueDateIso(e.target.value)} className="mt-1" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Expiry Date</span>
                  <DateInput value={expiryDateIso} onChange={(e) => setExpiryDateIso(e.target.value)} className="mt-1" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Issuing Bank</span>
                  <input
                    value={form.issuingBank}
                    onChange={(e) => setForm({ ...form, issuingBank: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </label>
              </div>

              {form.instrumentType === "bg" && (
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Link to Existing Contract
                  </span>
                  <select
                    value={form.contractId}
                    onChange={(e) => handleContractChange(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">— No contract linked —</option>
                    {contractOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="text-[10px] font-bold uppercase text-slate-400">Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as BankInstrumentStatus })
                  }
                  className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {(Object.keys(BANK_INSTRUMENT_STATUS_LABELS) as BankInstrumentStatus[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {BANK_INSTRUMENT_STATUS_LABELS[key]}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400">BG / DD Copy</span>
                  {!readOnly && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        className="hidden"
                        onChange={(e) => void handleFilePick(e.target.files)}
                      />
                      <button
                        type="button"
                        disabled={uploadingCopy}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded flex items-center gap-1"
                      >
                        {uploadingCopy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        Upload copy
                      </button>
                    </>
                  )}
                </div>

                {loadingDocs && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Loading documents…
                  </p>
                )}

                {modalDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 py-1">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{doc.filename}</p>
                      <p className="text-[10px] text-slate-400">{formatFileSize(doc.storedSizeBytes)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {editing && <DocumentPreviewButton instrumentId={editing.id} doc={doc} />}
                      {!readOnly && editing && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteExistingDoc(doc.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {pendingUploads.map((item, idx) => (
                  <div key={`pending-${idx}`} className="flex items-center justify-between gap-2 py-1 bg-amber-50/50 rounded px-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                      <p className="text-[10px] text-amber-600">Pending upload</p>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingUploads((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}

                {!loadingDocs && modalDocs.length === 0 && pendingUploads.length === 0 && (
                  <p className="text-[11px] text-slate-400">No copy uploaded yet.</p>
                )}
              </div>

              <label className="block">
                <span className="text-[10px] font-bold uppercase text-slate-400">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </label>
            </div>

            {!readOnly && (
              <div className="sticky bottom-0 bg-slate-50 border-t border-slate-100 px-5 py-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !form.instrumentNumber.trim()}
                  onClick={() => void handleSave()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#ff791a] hover:bg-[#e4640c] rounded-lg disabled:opacity-50"
                >
                  {saving ? "Saving…" : editing ? "Save changes" : "Add record"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
