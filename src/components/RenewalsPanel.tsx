import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Server,
  Shield,
  Upload,
} from "lucide-react";
import {
  CreateRenewalInput,
  Renewal,
  RenewalCategory,
  RenewalOwnerType,
  RenewalPeriod,
} from "../types";
import {
  CAR_PAPER_SUBTYPE_LABELS,
  fetchRenewalDocuments,
  getSubtypeLabels,
  IT_RENEWAL_SUBTYPE_LABELS,
  LICENSE_SUBTYPE_LABELS,
  uploadRenewalDocumentsBulk,
} from "../lib/renewals";
import {
  compareRenewalUrgency,
  computeNextExpiryDate,
  isNearingRenewal,
  renewalPeriodLabel,
} from "../lib/renewal-helpers";
import { formatAppDate, matchesIsoDateRange, parseFlexibleDateMs } from "../lib/date-helpers";
import { DateInput } from "./ui/DateInput";
import RenewalDocumentsPanel, {
  type RenewalDocumentsPanelHandle,
} from "./RenewalDocumentsPanel";
import RenewalBulkUploadModal from "./RenewalBulkUploadModal";
import RenewalRenewModal from "./RenewalRenewModal";

interface RenewalsPanelProps {
  category: RenewalCategory;
  tabLabel: string;
  renewals: Renewal[];
  readOnly?: boolean;
  onRefresh: () => Promise<void>;
  onCreate: (payload: CreateRenewalInput) => Promise<Renewal>;
  onUpdate: (id: string, payload: Partial<CreateRenewalInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type ExpiryFilter = "all" | "active" | "expiring_soon" | "expired" | "no_expiry";
type DocsFilter = "" | "has_docs" | "missing_docs";
type HasAmountFilter = "" | "with_amount" | "without_amount";

function expiryMeta(item: Pick<Renewal, "hasExpiry" | "expiresOn" | "expiryDate">): {
  label: string;
  className: string;
  band: "passed" | "soon" | "ok" | "none" | "no_expiry";
} {
  if (item.hasExpiry === false) {
    return { label: "No expiry", className: "text-slate-500 font-medium", band: "no_expiry" };
  }
  const endDate = item.expiresOn || item.expiryDate || "";
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

function emptyForm(category: RenewalCategory): CreateRenewalInput {
  const subtypeLabels = getSubtypeLabels(category);
  const firstSubType = Object.keys(subtypeLabels)[0] || "";
  return {
    category,
    subType: firstSubType,
    title: "",
    clientName: "",
    ownerType: "mine",
    amount: "",
    hasExpiry: true,
    issuedOn: "",
    expiresOn: "",
    renewalDate: "",
    expiryDate: "",
    notes: "",
    entryDate: new Date().toISOString().slice(0, 10),
    renewalPeriod: "yearly",
  };
}

function categoryIcon(category: RenewalCategory) {
  if (category === "car_papers") return Car;
  if (category === "it_renewals") return Server;
  return Shield;
}

function categoryDescription(category: RenewalCategory): string {
  if (category === "car_papers") {
    return "Track RC Book, Insurance, Road Tax, Permit, and PUC renewals with document uploads.";
  }
  if (category === "it_renewals") {
    return "Manage domain and server renewals for your own assets and client accounts.";
  }
  return "Track Travel Plus, Intelligic, Rent Agreements, and related license renewals.";
}

function titleLabel(category: RenewalCategory): string {
  if (category === "car_papers") return "Vehicle Registration";
  if (category === "it_renewals") return "Name";
  return "Description";
}

function normalizeRenewal(item: Renewal): Renewal {
  return {
    ...item,
    hasExpiry: item.hasExpiry !== false,
    issuedOn: item.issuedOn || item.renewalDate || "",
    expiresOn: item.expiresOn || item.expiryDate || "",
    renewalPeriod: item.renewalPeriod === "monthly" ? "monthly" : "yearly",
  };
}

function applyAutoExpiry(form: CreateRenewalInput): CreateRenewalInput {
  if (form.hasExpiry === false || !form.issuedOn.trim()) return form;
  const expiresOn = computeNextExpiryDate(
    form.issuedOn,
    form.renewalPeriod === "monthly" ? "monthly" : "yearly",
  );
  return { ...form, expiresOn, expiryDate: expiresOn };
}

export default function RenewalsPanel({
  category,
  tabLabel,
  renewals,
  readOnly = false,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}: RenewalsPanelProps) {
  const subtypeLabels = getSubtypeLabels(category);
  const Icon = categoryIcon(category);
  const docsPanelRef = useRef<RenewalDocumentsPanelHandle>(null);

  const patchForm = (
    prev: CreateRenewalInput,
    updates: Partial<CreateRenewalInput>,
  ): CreateRenewalInput => {
    let next: CreateRenewalInput = { ...prev, ...updates };
    if (category === "car_papers" && updates.title !== undefined) {
      next = { ...next, title: updates.title.toUpperCase() };
    }
    const autoExpiry =
      updates.issuedOn !== undefined ||
      updates.renewalPeriod !== undefined ||
      updates.hasExpiry === true;
    if (autoExpiry) next = applyAutoExpiry(next);
    return next;
  };

  const [search, setSearch] = useState("");
  const [subTypeFilter, setSubTypeFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<"" | RenewalOwnerType>("");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [docsFilter, setDocsFilter] = useState<DocsFilter>("");
  const [issuedFrom, setIssuedFrom] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [expiresFrom, setExpiresFrom] = useState("");
  const [expiresTo, setExpiresTo] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [hasAmountFilter, setHasAmountFilter] = useState<HasAmountFilter>("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [renewingItem, setRenewingItem] = useState<Renewal | null>(null);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateRenewalInput>(() => emptyForm(category));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const normalizedRenewals = useMemo(() => renewals.map(normalizeRenewal), [renewals]);

  const loadDocCounts = useCallback(async () => {
    const entries = await Promise.all(
      normalizedRenewals.map(async (item) => {
        try {
          const docs = await fetchRenewalDocuments(item.id);
          return [item.id, docs.length] as const;
        } catch {
          return [item.id, 0] as const;
        }
      }),
    );
    setDocCounts(Object.fromEntries(entries));
  }, [normalizedRenewals]);

  useEffect(() => {
    void loadDocCounts();
  }, [loadDocCounts]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (search.trim()) n += 1;
    if (subTypeFilter) n += 1;
    if (ownerFilter) n += 1;
    if (expiryFilter !== "all") n += 1;
    if (docsFilter) n += 1;
    if (issuedFrom || issuedTo) n += 1;
    if (expiresFrom || expiresTo) n += 1;
    if (clientFilter.trim()) n += 1;
    if (titleFilter.trim()) n += 1;
    if (hasAmountFilter) n += 1;
    return n;
  }, [
    search, subTypeFilter, ownerFilter, expiryFilter, docsFilter,
    issuedFrom, issuedTo, expiresFrom, expiresTo, clientFilter, titleFilter, hasAmountFilter,
  ]);

  const resetFilters = () => {
    setSearch("");
    setSubTypeFilter("");
    setOwnerFilter("");
    setExpiryFilter("all");
    setDocsFilter("");
    setIssuedFrom("");
    setIssuedTo("");
    setExpiresFrom("");
    setExpiresTo("");
    setClientFilter("");
    setTitleFilter("");
    setHasAmountFilter("");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const clientQ = clientFilter.trim().toLowerCase();
    const titleQ = titleFilter.trim().toLowerCase();

    const items = normalizedRenewals.filter((item) => {
      if (subTypeFilter && item.subType !== subTypeFilter) return false;
      if (category === "it_renewals" && ownerFilter && item.ownerType !== ownerFilter) {
        return false;
      }
      if (titleQ && !item.title.toLowerCase().includes(titleQ)) return false;
      if (category === "it_renewals" && clientQ && !item.clientName.toLowerCase().includes(clientQ)) {
        return false;
      }
      if (category === "it_renewals" && hasAmountFilter === "with_amount" && !item.amount.trim()) {
        return false;
      }
      if (category === "it_renewals" && hasAmountFilter === "without_amount" && item.amount.trim()) {
        return false;
      }
      if (q) {
        const hay = `${item.title} ${item.clientName} ${item.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const issuedTs = parseFlexibleDateMs(item.issuedOn);
      if (!matchesIsoDateRange(issuedTs, issuedFrom, issuedTo)) return false;
      const expiresTs = parseFlexibleDateMs(item.expiresOn || item.expiryDate);
      if (!matchesIsoDateRange(expiresTs, expiresFrom, expiresTo)) return false;
      const docCount = docCounts[item.id] ?? 0;
      if (docsFilter === "has_docs" && docCount === 0) return false;
      if (docsFilter === "missing_docs" && docCount > 0) return false;
      const meta = expiryMeta(item);
      if (expiryFilter === "no_expiry" && meta.band !== "no_expiry") return false;
      if (expiryFilter === "expired" && meta.band !== "passed") return false;
      if (expiryFilter === "expiring_soon" && meta.band !== "soon") return false;
      if (expiryFilter === "active" && (meta.band === "passed" || meta.band === "soon" || meta.band === "no_expiry")) {
        return false;
      }
      return true;
    });

    return [...items].sort(compareRenewalUrgency);
  }, [
    normalizedRenewals, search, subTypeFilter, ownerFilter, expiryFilter, category,
    docsFilter, docCounts, issuedFrom, issuedTo, expiresFrom, expiresTo,
    clientFilter, titleFilter, hasAmountFilter,
  ]);

  const nearingRenewals = useMemo(
    () => filtered.filter(isNearingRenewal),
    [filtered],
  );

  const stats = useMemo(() => {
    let expired = 0;
    let soon = 0;
    for (const item of normalizedRenewals) {
      const band = expiryMeta(item).band;
      if (band === "passed") expired += 1;
      else if (band === "soon") soon += 1;
    }
    return { total: normalizedRenewals.length, expired, soon };
  }, [normalizedRenewals]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(category));
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (item: Renewal) => {
    const n = normalizeRenewal(item);
    setEditingId(n.id);
    setForm({
      category: n.category,
      subType: n.subType,
      title: n.title,
      clientName: n.clientName,
      ownerType: n.ownerType,
      amount: n.amount,
      hasExpiry: n.hasExpiry,
      issuedOn: n.issuedOn,
      expiresOn: n.expiresOn,
      renewalDate: n.issuedOn,
      expiryDate: n.expiresOn,
      notes: n.notes,
      entryDate: n.entryDate,
      renewalPeriod: n.renewalPeriod,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    docsPanelRef.current?.clearPending();
    setFormError(null);
  };

  const buildPayload = (): CreateRenewalInput => ({
    ...form,
    title: category === "car_papers" ? form.title.toUpperCase() : form.title,
    issuedOn: form.issuedOn,
    expiresOn: form.hasExpiry ? form.expiresOn : "",
    renewalDate: form.issuedOn,
    expiryDate: form.hasExpiry ? form.expiresOn : "",
  });

  const handleSave = async () => {
    if (!form.subType.trim()) {
      setFormError("Please select a type.");
      return;
    }
    if (category === "car_papers" && !form.title.trim()) {
      setFormError("Vehicle registration is required.");
      return;
    }
    if (category === "it_renewals" && !form.title.trim()) {
      setFormError("Domain or server name is required.");
      return;
    }
    if (category === "it_renewals" && form.ownerType === "client" && !form.clientName.trim()) {
      setFormError("Client name is required for client renewals.");
      return;
    }
    if (form.hasExpiry && !form.expiresOn.trim()) {
      setFormError("Expires on date is required when expiry is enabled.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = buildPayload();
      let renewalId = editingId;
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        const created = await onCreate(payload);
        renewalId = created.id;
      }

      const pending = docsPanelRef.current?.getPendingUploads() ?? [];
      if (renewalId && pending.length > 0) {
        await uploadRenewalDocumentsBulk(renewalId, pending);
      }

      closeForm();
      await onRefresh();
      await loadDocCounts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save renewal.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (item: Renewal) => {
    if (!window.confirm(`Delete this ${tabLabel} renewal record?`)) return;
    await onDelete(item.id);
    await onRefresh();
    await loadDocCounts();
  };

  const handleRenew = async (payload: {
    issuedOn: string;
    expiresOn: string;
    renewalPeriod: RenewalPeriod;
  }) => {
    if (!renewingItem) return;
    await onUpdate(renewingItem.id, {
      hasExpiry: true,
      issuedOn: payload.issuedOn,
      expiresOn: payload.expiresOn,
      renewalDate: payload.issuedOn,
      expiryDate: payload.expiresOn,
      renewalPeriod: payload.renewalPeriod,
    });
    setRenewingItem(null);
    await onRefresh();
    await loadDocCounts();
  };

  useEffect(() => {
    setSearch("");
    setSubTypeFilter("");
    setOwnerFilter("");
    setExpiryFilter("all");
    setDocsFilter("");
    setIssuedFrom("");
    setIssuedTo("");
    setExpiresFrom("");
    setExpiresTo("");
    setClientFilter("");
    setTitleFilter("");
    setHasAmountFilter("");
    setShowAdvancedFilters(false);
  }, [category]);

  const defaultDocLabel = subtypeLabels[form.subType] || form.subType || tabLabel;

  const handleBulkComplete = async () => {
    await onRefresh();
    await loadDocCounts();
  };

  return (
    <div className="space-y-5" id={`renewals-panel-${category}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-orange-50 text-[#ff791a]">
              <Icon size={18} />
            </span>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">{tabLabel}</h2>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">{categoryDescription(category)}</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsBulkUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#ff791a] text-[#ff791a] hover:bg-orange-50 text-xs font-bold rounded-lg shadow-sm transition"
            >
              <Upload size={14} />
              Upload
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg shadow transition"
            >
              <Plus size={14} />
              Add Renewal
            </button>
          </div>
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

      {nearingRenewals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-700" />
            <h3 className="text-sm font-extrabold text-amber-900">
              Nearing Renewal ({nearingRenewals.length})
            </h3>
          </div>
          <p className="text-[11px] text-amber-800">
            Expired or expiring within 60 days — shown first in the list below.
          </p>
          <div className="overflow-x-auto rounded-lg border border-amber-100 bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-amber-50 text-slate-500 uppercase tracking-wide">
                  <th className="py-2 px-3 font-bold">Type</th>
                  <th className="py-2 px-3 font-bold">
                    {category === "car_papers" ? "Vehicle" : "Name / Details"}
                  </th>
                  <th className="py-2 px-3 font-bold">Expires On</th>
                  <th className="py-2 px-3 font-bold">Period</th>
                  <th className="py-2 px-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {nearingRenewals.map((item) => {
                  const expiry = expiryMeta(item);
                  return (
                    <tr key={`near-${item.id}`} className="border-b border-slate-50 hover:bg-amber-50/40">
                      <td className="py-2 px-3 font-semibold text-slate-700">
                        {subtypeLabels[item.subType] || item.subType}
                      </td>
                      <td className="py-2 px-3 text-slate-800">{item.title || "—"}</td>
                      <td className={`py-2 px-3 ${expiry.className}`}>{expiry.label}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {renewalPeriodLabel(item.renewalPeriod)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex gap-1">
                          {!readOnly && item.hasExpiry !== false && (
                            <button
                              type="button"
                              onClick={() => setRenewingItem(item)}
                              className="px-2 py-1 rounded bg-orange-50 hover:bg-orange-100 text-[#ff791a] font-bold"
                            >
                              Renew
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold"
                          >
                            {readOnly ? "View" : "Edit"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#ff791a] text-white text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              {showAdvancedFilters ? "Hide" : "More"} filters
            </button>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw size={11} />
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, client, notes..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <select
            value={subTypeFilter}
            onChange={(e) => setSubTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[140px]"
          >
            <option value="">All Types</option>
            {Object.entries(subtypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value as ExpiryFilter)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[140px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
            <option value="no_expiry">No Expiry</option>
          </select>
          <select
            value={docsFilter}
            onChange={(e) => setDocsFilter(e.target.value as DocsFilter)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[140px]"
          >
            <option value="">All Documents</option>
            <option value="has_docs">Has Documents</option>
            <option value="missing_docs">Missing Documents</option>
          </select>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-600">
              {category === "car_papers" ? "Vehicle" : "Name / Details"}
              <input
                value={titleFilter}
                onChange={(e) => setTitleFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                placeholder="Filter by name..."
              />
            </label>
            {category === "it_renewals" && (
              <>
                <label className="block text-[11px] font-bold text-slate-600">
                  Owner
                  <select
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value as "" | RenewalOwnerType)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Mine & Client</option>
                    <option value="mine">Mine</option>
                    <option value="client">Client</option>
                  </select>
                </label>
                <label className="block text-[11px] font-bold text-slate-600">
                  Client Name
                  <input
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="Filter client..."
                  />
                </label>
                <label className="block text-[11px] font-bold text-slate-600">
                  Amount
                  <select
                    value={hasAmountFilter}
                    onChange={(e) => setHasAmountFilter(e.target.value as HasAmountFilter)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Any</option>
                    <option value="with_amount">With Amount</option>
                    <option value="without_amount">Without Amount</option>
                  </select>
                </label>
              </>
            )}
            <label className="block text-[11px] font-bold text-slate-600">
              Issued From
              <DateInput
                value={issuedFrom}
                onChange={(e) => setIssuedFrom(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-[11px] font-bold text-slate-600">
              Issued To
              <DateInput
                value={issuedTo}
                onChange={(e) => setIssuedTo(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-[11px] font-bold text-slate-600">
              Expires From
              <DateInput
                value={expiresFrom}
                onChange={(e) => setExpiresFrom(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-[11px] font-bold text-slate-600">
              Expires To
              <DateInput
                value={expiresTo}
                onChange={(e) => setExpiresTo(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          Showing {filtered.length} of {normalizedRenewals.length} records
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No renewals yet</p>
            <p className="text-xs mt-1">Add your first {tabLabel.toLowerCase()} record to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wide">
                  <th className="py-2 pr-3 font-bold">Type</th>
                  <th className="py-2 pr-3 font-bold">
                    {category === "car_papers" ? "Vehicle" : "Name / Details"}
                  </th>
                  {category === "it_renewals" && (
                    <>
                      <th className="py-2 pr-3 font-bold">Owner</th>
                      <th className="py-2 pr-3 font-bold">Client</th>
                      <th className="py-2 pr-3 font-bold">Amount</th>
                    </>
                  )}
                  <th className="py-2 pr-3 font-bold">Issued On</th>
                  <th className="py-2 pr-3 font-bold">Expires On</th>
                  <th className="py-2 pr-3 font-bold">Period</th>
                  <th className="py-2 pr-3 font-bold">Docs</th>
                  <th className="py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const expiry = expiryMeta(item);
                  return (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3 font-semibold text-slate-700">
                        {subtypeLabels[item.subType] || item.subType}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-800">{item.title || "—"}</td>
                      {category === "it_renewals" && (
                        <>
                          <td className="py-2.5 pr-3 capitalize">{item.ownerType}</td>
                          <td className="py-2.5 pr-3">{item.clientName || "—"}</td>
                          <td className="py-2.5 pr-3">
                            {item.ownerType === "client" && item.amount ? `₹${item.amount}` : "—"}
                          </td>
                        </>
                      )}
                      <td className="py-2.5 pr-3 text-slate-600">
                        {item.issuedOn ? formatAppDate(item.issuedOn) : "—"}
                      </td>
                      <td className={`py-2.5 pr-3 ${expiry.className}`}>{expiry.label}</td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {item.hasExpiry === false ? "—" : renewalPeriodLabel(item.renewalPeriod)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <DocCount count={docCounts[item.id]} />
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          {!readOnly && item.hasExpiry !== false && (
                            <button
                              type="button"
                              onClick={() => setRenewingItem(item)}
                              className="px-2 py-1 rounded bg-orange-50 hover:bg-orange-100 text-[#ff791a] font-bold"
                            >
                              Renew
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                          >
                            {readOnly ? "View" : "Edit"}
                          </button>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteItem(item)}
                              className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-bold"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-800">
                {editingId ? "Edit Renewal" : "Add Renewal"}
              </h3>
              <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-600 text-lg">
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <label className="block text-xs font-bold text-slate-600">
                Type
                <select
                  value={form.subType}
                  onChange={(e) => setForm((prev) => ({ ...prev, subType: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  {Object.entries(subtypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <div className="rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                <div>
                  <p className="text-xs font-bold text-slate-700">Renewal required?</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Choose whether this item needs periodic renewal tracking.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => patchForm(prev, { hasExpiry: true }))
                    }
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition ${
                      form.hasExpiry
                        ? "bg-[#ff791a] border-[#ff791a] text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        hasExpiry: false,
                        expiresOn: "",
                        expiryDate: "",
                      }))
                    }
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition ${
                      !form.hasExpiry
                        ? "bg-slate-700 border-slate-700 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    No
                  </button>
                </div>

                {form.hasExpiry && (
                  <>
                    <label className="block text-xs font-bold text-slate-600">
                      Renewal Period
                      <select
                        value={form.renewalPeriod}
                        onChange={(e) =>
                          setForm((prev) =>
                            patchForm(prev, {
                              renewalPeriod: e.target.value as RenewalPeriod,
                            }),
                          )
                        }
                        className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="monthly">Monthly Renewal</option>
                        <option value="yearly">Yearly Renewal</option>
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-slate-600">
                      Issued On
                      <DateInput
                        value={form.issuedOn}
                        onChange={(e) =>
                          setForm((prev) => patchForm(prev, { issuedOn: e.target.value }))
                        }
                        className="mt-1 w-full"
                      />
                    </label>

                    <label className="block text-xs font-bold text-slate-600">
                      Expires On
                      <DateInput
                        value={form.expiresOn}
                        onChange={(e) => setForm((prev) => ({ ...prev, expiresOn: e.target.value }))}
                        className="mt-1 w-full"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 font-normal">
                        Auto-filled from Issued On + {renewalPeriodLabel(form.renewalPeriod)}. Override if needed.
                      </p>
                    </label>
                  </>
                )}
              </div>

              <label className="block text-xs font-bold text-slate-600">
                {titleLabel(category)}
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) =>
                      patchForm(prev, {
                        title:
                          category === "car_papers"
                            ? e.target.value.toUpperCase()
                            : e.target.value,
                      }),
                    )
                  }
                  className={`mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg${
                    category === "car_papers" ? " uppercase" : ""
                  }`}
                  placeholder={
                    category === "car_papers"
                      ? "e.g. KA-01-AB-1234"
                      : category === "it_renewals"
                        ? "e.g. example.com or prod-server-01"
                        : "Optional details"
                  }
                />
              </label>

              {category === "it_renewals" && (
                <>
                  <label className="block text-xs font-bold text-slate-600">
                    Owner
                    <select
                      value={form.ownerType}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          ownerType: e.target.value as RenewalOwnerType,
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    >
                      <option value="mine">Mine</option>
                      <option value="client">Client</option>
                    </select>
                  </label>
                  {form.ownerType === "client" && (
                    <>
                      <label className="block text-xs font-bold text-slate-600">
                        Client Name
                        <input
                          value={form.clientName}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, clientName: e.target.value }))
                          }
                          className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                        />
                      </label>
                      <label className="block text-xs font-bold text-slate-600">
                        Amount (₹)
                        <input
                          value={form.amount}
                          onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                          placeholder="Renewal amount for client"
                        />
                      </label>
                    </>
                  )}
                </>
              )}

              <label className="block text-xs font-bold text-slate-600">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </label>

              <RenewalDocumentsPanel
                ref={docsPanelRef}
                renewalId={editingId}
                defaultLabel={defaultDocLabel}
                readOnly={readOnly}
                hideSaveAll
              />

              {formError && (
                <p className="text-xs text-red-600 font-medium">{formError}</p>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              {!readOnly && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#ff791a] hover:bg-[#e4640c] rounded-lg disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isBulkUploadOpen && (
        <RenewalBulkUploadModal
          category={category}
          tabLabel={tabLabel}
          renewals={normalizedRenewals}
          subtypeLabels={subtypeLabels}
          readOnly={readOnly}
          onCreate={onCreate}
          onClose={() => setIsBulkUploadOpen(false)}
          onComplete={handleBulkComplete}
        />
      )}

      {renewingItem && (
        <RenewalRenewModal
          item={renewingItem}
          subtypeLabel={subtypeLabels[renewingItem.subType] || renewingItem.subType}
          readOnly={readOnly}
          onClose={() => setRenewingItem(null)}
          onRenew={handleRenew}
        />
      )}
    </div>
  );
}

function DocCount({ count }: { count?: number }) {
  if (count === undefined) return <span className="text-slate-300">…</span>;
  if (count === 0) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
      <CheckCircle2 size={12} />
      {count}
    </span>
  );
}

export {
  CAR_PAPER_SUBTYPE_LABELS,
  IT_RENEWAL_SUBTYPE_LABELS,
  LICENSE_SUBTYPE_LABELS,
};
