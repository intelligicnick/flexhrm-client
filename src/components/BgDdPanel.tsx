import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  Landmark,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import {
  BgDdInstrumentType,
  BgDdRecord,
  BgDdStatus,
  Contract,
  CreateBgDdInput,
} from "../types";
import {
  BG_DD_INSTRUMENT_LABELS,
  BG_DD_STATUS_LABELS,
  BG_DD_STATUS_STYLES,
  uploadBgDdDocumentsBulk,
} from "../lib/bg-dd";
import { formatAppDate, matchesIsoDateRange, parseFlexibleDateMs } from "../lib/date-helpers";
import { validateOptionalAmountString } from "../lib/number-validation";
import { DateInput } from "./ui/DateInput";
import BgDdDocumentsPanel, { type BgDdDocumentsPanelHandle } from "./BgDdDocumentsPanel";

const FORM_FIELD =
  "mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#ff791a] focus:ring-2 focus:ring-[#ff791a]/20 transition";

interface BgDdPanelProps {
  records: BgDdRecord[];
  contracts: Contract[];
  readOnly?: boolean;
  initialExpiryFilter?: "all" | "active" | "expiring_soon" | "expired" | "alert";
  initialTypeFilter?: "" | "bg" | "dd";
  onRefresh: () => Promise<void>;
  onCreate: (payload: CreateBgDdInput) => Promise<BgDdRecord>;
  onUpdate: (id: string, payload: Partial<CreateBgDdInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type ExpiryFilter = "all" | "active" | "expiring_soon" | "expired";

function emptyForm(): CreateBgDdInput {
  return {
    instrumentType: "bg",
    number: "",
    beneficiary: "",
    dateOfIssue: "",
    expiryDate: "",
    issuingBank: "",
    contractId: "",
    status: "submitted_to_dept",
    amount: "",
    notes: "",
    entryDate: new Date().toISOString().slice(0, 10),
  };
}

function expiryMeta(expiryDate: string): {
  label: string;
  className: string;
  band: "passed" | "soon" | "ok" | "none";
} {
  const ts = parseFlexibleDateMs(expiryDate);
  if (!expiryDate.trim()) {
    return { label: "—", className: "text-slate-400", band: "none" };
  }
  if (ts === null) {
    return { label: expiryDate, className: "text-slate-700", band: "ok" };
  }
  const now = Date.now();
  const diffDays = (ts - now) / (1000 * 60 * 60 * 24);
  const formatted = formatAppDate(expiryDate);
  if (diffDays < 0) {
    return { label: formatted, className: "text-red-700 font-semibold", band: "passed" };
  }
  if (diffDays <= 60) {
    return { label: formatted, className: "text-amber-700 font-semibold", band: "soon" };
  }
  return { label: formatted, className: "text-slate-700", band: "ok" };
}

function contractLocationLabel(contract: Contract): string {
  const linkedLocations = (contract.linkedLocations || [])
    .map((location) => location.trim())
    .filter(Boolean);
  if (linkedLocations.length > 0) return linkedLocations.join(", ");
  return contract.correspondingOffice.trim();
}

function contractDepartmentLabel(contract: Contract): string {
  return contract.officeName.trim();
}

function contractMetaLabel(contract: Contract): string {
  const parts = [
    contract.officerName.trim(),
    contractLocationLabel(contract),
    contractDepartmentLabel(contract),
  ].filter(Boolean);
  return parts.join(" · ");
}

function contractSearchText(contract: Contract): string {
  return [
    contract.contractNo,
    contract.companyName,
    contract.officerName,
    contract.officeName,
    contract.correspondingOffice,
    contract.linkedLocations?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function BgDdPanel({
  records,
  contracts,
  readOnly = false,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}: BgDdPanelProps) {
  const docsPanelRef = useRef<BgDdDocumentsPanelHandle>(null);
  const contractSelectRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | BgDdInstrumentType>("");
  const [statusFilter, setStatusFilter] = useState<"" | BgDdStatus>("");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [issueFrom, setIssueFrom] = useState("");
  const [issueTo, setIssueTo] = useState("");
  const [expiryFrom, setExpiryFrom] = useState("");
  const [expiryTo, setExpiryTo] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [selectedDocsRecord, setSelectedDocsRecord] = useState<BgDdRecord | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateBgDdInput>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [contractDropdownOpen, setContractDropdownOpen] = useState(false);
  const [contractSearch, setContractSearch] = useState("");

  const contractById = useMemo(() => {
    const map = new Map<string, Contract>();
    contracts.forEach((c) => map.set(c.id, c));
    return map;
  }, [contracts]);

  const contractOptions = useMemo(
    () =>
      [...contracts].sort((a, b) =>
        (a.contractNo || "").localeCompare(b.contractNo || "", undefined, { numeric: true }),
      ),
    [contracts],
  );

  const selectedContract = useMemo(
    () => (form.contractId ? contractById.get(form.contractId) : undefined),
    [form.contractId, contractById],
  );

  const filteredContractOptions = useMemo(() => {
    const query = contractSearch.trim().toLowerCase();
    if (!query) return contractOptions;
    return contractOptions.filter((contract) => contractSearchText(contract).includes(query));
  }, [contractOptions, contractSearch]);

  const loadDocCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    await Promise.all(
      records.map(async (record) => {
        try {
          const res = await fetch(`/api/bg-dd/${encodeURIComponent(record.id)}/documents`);
          if (res.ok) {
            const docs = await res.json();
            counts[record.id] = Array.isArray(docs) ? docs.length : 0;
          }
        } catch {
          counts[record.id] = 0;
        }
      }),
    );
    setDocCounts(counts);
  }, [records]);

  useEffect(() => {
    void loadDocCounts();
  }, [loadDocCounts]);

  useEffect(() => {
    if (!contractDropdownOpen) {
      setContractSearch("");
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (contractSelectRef.current && !contractSelectRef.current.contains(event.target as Node)) {
        setContractDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [contractDropdownOpen]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((item) => {
      if (typeFilter && item.instrumentType !== typeFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (q) {
        const contract = item.contractId ? contractById.get(item.contractId) : undefined;
        const haystack = [
          item.number,
          item.beneficiary,
          item.issuingBank,
          item.notes,
          contract?.contractNo,
          contract?.companyName,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (!matchesIsoDateRange(parseFlexibleDateMs(item.dateOfIssue), issueFrom, issueTo)) return false;
      if (!matchesIsoDateRange(parseFlexibleDateMs(item.expiryDate), expiryFrom, expiryTo)) return false;

      const band = expiryMeta(item.expiryDate).band;
      if (expiryFilter === "expired" && band !== "passed") return false;
      if (expiryFilter === "expiring_soon" && band !== "soon") return false;
      if (expiryFilter === "active" && (band === "passed" || band === "none")) return false;
      return true;
    });
  }, [
    records,
    search,
    typeFilter,
    statusFilter,
    expiryFilter,
    issueFrom,
    issueTo,
    expiryFrom,
    expiryTo,
    contractById,
  ]);

  const stats = useMemo(() => {
    let soon = 0;
    let expired = 0;
    records.forEach((item) => {
      const band = expiryMeta(item.expiryDate).band;
      if (band === "soon") soon += 1;
      if (band === "passed") expired += 1;
    });
    return { total: records.length, soon, expired };
  }, [records]);

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setExpiryFilter("all");
    setIssueFrom("");
    setIssueTo("");
    setExpiryFrom("");
    setExpiryTo("");
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setContractDropdownOpen(false);
    setContractSearch("");
    docsPanelRef.current?.clearPending();
    setIsFormOpen(true);
  };

  const openEdit = (item: BgDdRecord) => {
    setEditingId(item.id);
    setForm({
      instrumentType: item.instrumentType,
      number: item.number,
      beneficiary: item.beneficiary,
      dateOfIssue: item.dateOfIssue,
      expiryDate: item.expiryDate,
      issuingBank: item.issuingBank,
      contractId: item.contractId,
      status: item.status,
      amount: item.amount,
      notes: item.notes,
      entryDate: item.entryDate,
    });
    setFormError(null);
    setContractDropdownOpen(false);
    setContractSearch("");
    docsPanelRef.current?.clearPending();
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormError(null);
    setSaving(false);
    setContractDropdownOpen(false);
    setContractSearch("");
    docsPanelRef.current?.clearPending();
  };

  const handleSave = async () => {
    if (!form.number.trim()) {
      setFormError("BG/DD number is required.");
      return;
    }

    const amountError = validateOptionalAmountString(form.amount, "Amount");
    if (amountError) {
      setFormError(amountError);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      let recordId = editingId;
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        const created = await onCreate(form);
        recordId = created.id;
      }

      const pending = docsPanelRef.current?.getPendingUploads() ?? [];
      if (recordId && pending.length > 0) {
        await uploadBgDdDocumentsBulk(recordId, pending);
      }

      closeForm();
      await onRefresh();
      await loadDocCounts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save record.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (item: BgDdRecord) => {
    if (!window.confirm(`Delete ${BG_DD_INSTRUMENT_LABELS[item.instrumentType]} ${item.number}?`)) return;
    await onDelete(item.id);
    await onRefresh();
    await loadDocCounts();
  };

  const openDocsViewer = (item: BgDdRecord) => {
    if ((docCounts[item.id] ?? 0) === 0) return;
    setSelectedDocsRecord(item);
  };

  const closeDocsViewer = () => setSelectedDocsRecord(null);

  return (
    <div className="space-y-5" id="bg-dd-panel">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-orange-50 text-[#ff791a]">
              <Shield size={18} />
            </span>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">BG & DD</h2>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Track bank guarantees and demand drafts with beneficiary details, expiry dates, contract links, status workflow, and document copies.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg shadow transition shrink-0"
          >
            <Plus size={14} />
            Add BG / DD
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => { resetFilters(); setExpiryFilter("all"); }}
          className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 transition"
        >
          <span className="text-xs text-slate-500 font-medium">Total Records</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </button>
        <button
          type="button"
          onClick={() => { resetFilters(); setExpiryFilter("expiring_soon"); }}
          className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-left hover:border-amber-200 transition"
        >
          <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
            <Clock size={12} /> Expiring Soon
          </span>
          <p className="text-2xl font-bold text-amber-800 mt-1">{stats.soon}</p>
        </button>
        <button
          type="button"
          onClick={() => { resetFilters(); setExpiryFilter("expired"); }}
          className="bg-red-50 border border-red-100 rounded-xl p-4 text-left hover:border-red-200 transition"
        >
          <span className="text-xs text-red-700 font-medium flex items-center gap-1">
            <AlertTriangle size={12} /> Expired
          </span>
          <p className="text-2xl font-bold text-red-800 mt-1">{stats.expired}</p>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number, beneficiary, bank, contract…"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#ff791a] focus:ring-2 focus:ring-[#ff791a]/20"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | BgDdInstrumentType)}
            className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All Types</option>
            <option value="bg">Bank Guarantee</option>
            <option value="dd">Demand Draft</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | BgDdStatus)}
            className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white min-w-[180px]"
          >
            <option value="">All Statuses</option>
            {(Object.keys(BG_DD_STATUS_LABELS) as BgDdStatus[]).map((key) => (
              <option key={key} value={key}>
                {BG_DD_STATUS_LABELS[key]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Filter size={12} />
            Filters
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400">Date of Issue</label>
              <div className="flex gap-2 mt-1">
                <DateInput value={issueFrom} onChange={(e) => setIssueFrom(e.target.value)} className={FORM_FIELD} />
                <DateInput value={issueTo} onChange={(e) => setIssueTo(e.target.value)} className={FORM_FIELD} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400">Expiry Date</label>
              <div className="flex gap-2 mt-1">
                <DateInput value={expiryFrom} onChange={(e) => setExpiryFrom(e.target.value)} className={FORM_FIELD} />
                <DateInput value={expiryTo} onChange={(e) => setExpiryTo(e.target.value)} className={FORM_FIELD} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Number</th>
                <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Beneficiary</th>
                <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Date of Issue</th>
                <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Expiry Date</th>
                <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Issuing Bank</th>
                <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Linked Contract</th>
                <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Docs</th>
                {!readOnly && (
                  <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wide w-20">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 9 : 10} className="px-4 py-10 text-center text-slate-400">
                    No BG/DD records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => {
                  const expiry = expiryMeta(item.expiryDate);
                  const contract = item.contractId ? contractById.get(item.contractId) : undefined;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-100 hover:bg-slate-50/80 ${readOnly ? "" : "cursor-pointer"}`}
                      onClick={() => !readOnly && openEdit(item)}
                    >
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                          {item.instrumentType === "bg" ? (
                            <Shield size={12} className="text-violet-500" />
                          ) : (
                            <Landmark size={12} className="text-blue-500" />
                          )}
                          {item.instrumentType === "bg" ? "BG" : "DD"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{item.number || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-700">{item.beneficiary || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {item.dateOfIssue ? formatAppDate(item.dateOfIssue) : "—"}
                      </td>
                      <td className={`px-3 py-2.5 ${expiry.className}`}>{expiry.label}</td>
                      <td className="px-3 py-2.5 text-slate-700">{item.issuingBank || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {contract ? (
                          <span className="font-medium">{contract.contractNo}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${BG_DD_STATUS_STYLES[item.status]}`}
                        >
                          {BG_DD_STATUS_LABELS[item.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDocsViewer(item);
                          }}
                          disabled={(docCounts[item.id] ?? 0) === 0}
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition ${
                            (docCounts[item.id] ?? 0) > 0
                              ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              : "cursor-not-allowed text-slate-300"
                          }`}
                          title={(docCounts[item.id] ?? 0) > 0 ? "View documents" : "No documents uploaded"}
                        >
                          <FileText size={12} />
                          {docCounts[item.id] ?? 0}
                        </button>
                      </td>
                      {!readOnly && (
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => void handleDeleteItem(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-500">
          Showing {filteredRecords.length} of {records.length} records
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={closeForm} aria-hidden />
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingId ? "Edit BG / DD" : "Add BG / DD"}
              </h3>
              <button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Type</label>
                  <select
                    value={form.instrumentType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        instrumentType: e.target.value as BgDdInstrumentType,
                      }))
                    }
                    className={FORM_FIELD}
                  >
                    <option value="bg">Bank Guarantee (BG)</option>
                    <option value="dd">Demand Draft (DD)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">
                    {form.instrumentType === "bg" ? "BG Number" : "DD Number"}
                  </label>
                  <input
                    type="text"
                    value={form.number}
                    onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
                    className={FORM_FIELD}
                    placeholder="Enter number"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Beneficiary</label>
                  <input
                    type="text"
                    value={form.beneficiary}
                    onChange={(e) => setForm((prev) => ({ ...prev, beneficiary: e.target.value }))}
                    className={FORM_FIELD}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Amount</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className={FORM_FIELD}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Date of Issue</label>
                  <DateInput
                    value={form.dateOfIssue}
                    onChange={(e) => setForm((prev) => ({ ...prev, dateOfIssue: e.target.value }))}
                    className={FORM_FIELD}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Expiry Date</label>
                  <DateInput
                    value={form.expiryDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    className={FORM_FIELD}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Issuing Bank</label>
                  <input
                    type="text"
                    value={form.issuingBank}
                    onChange={(e) => setForm((prev) => ({ ...prev, issuingBank: e.target.value }))}
                    className={FORM_FIELD}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Link to Contract</label>
                  <div ref={contractSelectRef} className="relative mt-1">
                    <button
                      type="button"
                      onClick={() => setContractDropdownOpen((open) => !open)}
                      className={`w-full rounded-lg border bg-white px-2.5 py-2 text-left transition ${
                        contractDropdownOpen
                          ? "border-[#ff791a] ring-2 ring-[#ff791a]/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span
                            className={`block truncate text-xs font-medium ${
                              selectedContract ? "text-slate-800" : "text-slate-500"
                            }`}
                          >
                            {selectedContract?.contractNo || "— No contract linked —"}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                            {selectedContract
                              ? contractMetaLabel(selectedContract) ||
                                selectedContract.companyName ||
                                "No extra contract details"
                              : "Search by contract no, officer, location, or department"}
                          </span>
                        </span>
                        <ChevronDown
                          size={14}
                          className={`shrink-0 text-slate-400 transition ${
                            contractDropdownOpen ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </button>

                    {contractDropdownOpen && (
                      <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                        <div className="border-b border-slate-100 p-2">
                          <div className="relative">
                            <Search
                              size={12}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                              type="text"
                              value={contractSearch}
                              onChange={(e) => setContractSearch(e.target.value)}
                              placeholder="Search contract no, officer, location, department..."
                              className="w-full rounded-md border border-slate-200 py-1.5 pl-7 pr-2 text-xs text-slate-700 focus:outline-none focus:border-[#ff791a]"
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto py-1">
                          <button
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, contractId: "" }));
                              setContractDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left transition hover:bg-slate-50 ${
                              !form.contractId ? "bg-orange-50/70" : ""
                            }`}
                          >
                            <div className={`text-xs font-semibold ${!form.contractId ? "text-[#ff791a]" : "text-slate-700"}`}>
                              — No contract linked —
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-400">Clear the selected contract link</div>
                          </button>

                          {filteredContractOptions.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-slate-400">
                              No contracts match your search.
                            </p>
                          ) : (
                            filteredContractOptions.map((contract) => {
                              const meta = contractMetaLabel(contract);
                              const isSelected = form.contractId === contract.id;
                              return (
                                <button
                                  key={contract.id}
                                  type="button"
                                  onClick={() => {
                                    setForm((prev) => ({ ...prev, contractId: contract.id }));
                                    setContractDropdownOpen(false);
                                  }}
                                  className={`w-full border-t border-slate-50 px-3 py-2 text-left transition first:border-t-0 hover:bg-slate-50 ${
                                    isSelected ? "bg-orange-50/70" : ""
                                  }`}
                                >
                                  <div className={`text-xs font-semibold ${isSelected ? "text-[#ff791a]" : "text-slate-800"}`}>
                                    {contract.contractNo || "Untitled contract"}
                                  </div>
                                  <div className="mt-0.5 text-[10px] text-slate-500">
                                    {meta || contract.companyName || "No extra contract details"}
                                  </div>
                                  {contract.companyName.trim() ? (
                                    <div className="mt-0.5 truncate text-[10px] text-slate-400">
                                      {contract.companyName}
                                    </div>
                                  ) : null}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, status: e.target.value as BgDdStatus }))
                    }
                    className={FORM_FIELD}
                  >
                    {(Object.keys(BG_DD_STATUS_LABELS) as BgDdStatus[]).map((key) => (
                      <option key={key} value={key}>
                        {BG_DD_STATUS_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className={FORM_FIELD}
                  />
                </div>
              </div>

              <BgDdDocumentsPanel
                ref={docsPanelRef}
                bgDdId={editingId}
                readOnly={readOnly}
                embedded
              />
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold bg-[#ff791a] hover:bg-[#e4640c] text-white rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Update" : "Add Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDocsRecord && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={closeDocsViewer} aria-hidden />
          <div
            className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {selectedDocsRecord.instrumentType === "bg" ? "BG" : "DD"} Documents
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDocsRecord.number || "Untitled record"}
                  {selectedDocsRecord.beneficiary ? ` · ${selectedDocsRecord.beneficiary}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDocsViewer}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <BgDdDocumentsPanel bgDdId={selectedDocsRecord.id} readOnly embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
