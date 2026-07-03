import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckSquare,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Server,
  Shield,
  Trash2,
  Upload,
  X,
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
  deleteRenewal as deleteRenewalRecord,
  fetchRenewalDocuments,
  getSubtypeLabels,
  IT_RENEWAL_SUBTYPE_LABELS,
  LICENSE_SUBTYPE_LABELS,
  updateRenewal as updateRenewalRecord,
  uploadRenewalDocumentsBulk,
} from "../lib/renewals";
import {
  compareRenewalUrgency,
  computeNextExpiryDate,
  isNearingRenewal,
  renewalPeriodLabel,
} from "../lib/renewal-helpers";
import { formatAppDate, matchesIsoDateRange, parseFlexibleDateMs } from "../lib/date-helpers";
import { validateOptionalAmountString } from "../lib/number-validation";
import { DateInput } from "./ui/DateInput";
import RenewalDocumentsPanel, {
  type RenewalDocumentsPanelHandle,
} from "./RenewalDocumentsPanel";
import RenewalBulkUploadModal from "./RenewalBulkUploadModal";
import RenewalRenewModal from "./RenewalRenewModal";
import {
  downloadRenewalExcelTemplate,
  parseRenewalsWorkbook,
  validateRenewalImportRow,
} from "../lib/renewal-excel";

const RENEWAL_FORM_FIELD =
  "mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#ff791a] focus:ring-2 focus:ring-[#ff791a]/20 transition";
const RENEWAL_FORM_TEXTAREA =
  "w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#ff791a] focus:ring-2 focus:ring-[#ff791a]/20 transition";

interface RenewalsPanelProps {
  category: RenewalCategory;
  tabLabel: string;
  renewals: Renewal[];
  readOnly?: boolean;
  initialExpiryFilter?: "all" | "active" | "expiring_soon" | "expired" | "no_expiry" | "alert";
  onRefresh: () => Promise<void>;
  onCreate: (payload: CreateRenewalInput) => Promise<Renewal>;
  onUpdate: (id: string, payload: Partial<CreateRenewalInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport?: (items: CreateRenewalInput[]) => Promise<{ created: number; updated: number; skipped: number }>;
}

type ExpiryFilter = "all" | "active" | "expiring_soon" | "expired" | "no_expiry";
type DocsFilter = "" | "has_docs" | "missing_docs";
type HasAmountFilter = "" | "with_amount" | "without_amount";
type RenewalBulkEditableField = Exclude<keyof RenewalBulkEditRowDraft, "id">;

interface RenewalBulkEditRowDraft {
  id: string;
  subType: string;
  title: string;
  ownerType: RenewalOwnerType;
  clientName: string;
  amount: string;
  hasExpiry: boolean;
  renewalPeriod: RenewalPeriod;
  issuedOn: string;
  expiresOn: string;
  notes: string;
}

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

function categorySupportsDocuments(category: RenewalCategory): boolean {
  return category !== "it_renewals";
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

function renewalToForm(item: Renewal): CreateRenewalInput {
  const n = normalizeRenewal(item);
  return {
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

function toBulkEditRowDraft(item: Renewal): RenewalBulkEditRowDraft {
  const base = renewalToForm(item);
  return {
    id: item.id,
    subType: base.subType,
    title: base.title,
    ownerType: base.ownerType,
    clientName: base.clientName,
    amount: base.amount,
    hasExpiry: base.hasExpiry,
    renewalPeriod: base.renewalPeriod,
    issuedOn: base.issuedOn,
    expiresOn: base.expiresOn,
    notes: base.notes,
  };
}

function patchBulkEditRowDraft(
  category: RenewalCategory,
  prev: RenewalBulkEditRowDraft,
  updates: Partial<Pick<RenewalBulkEditRowDraft, RenewalBulkEditableField>>,
): RenewalBulkEditRowDraft {
  let next = { ...prev, ...updates };
  if (category === "car_papers" && updates.title !== undefined) {
    next = { ...next, title: updates.title.toUpperCase() };
  }
  if (!next.hasExpiry) {
    return { ...next, expiresOn: "" };
  }
  const shouldAutoExpiry =
    updates.issuedOn !== undefined ||
    updates.renewalPeriod !== undefined ||
    updates.hasExpiry === true;
  if (shouldAutoExpiry && updates.expiresOn === undefined && next.issuedOn.trim()) {
    next = {
      ...next,
      expiresOn: computeNextExpiryDate(
        next.issuedOn,
        next.renewalPeriod === "monthly" ? "monthly" : "yearly",
      ),
    };
  }
  return next;
}

function buildBulkEditDraftMap(items: Renewal[]): Record<string, RenewalBulkEditRowDraft> {
  return Object.fromEntries(items.map((item) => [item.id, toBulkEditRowDraft(item)]));
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
  onImport,
}: RenewalsPanelProps) {
  const subtypeLabels = getSubtypeLabels(category);
  const Icon = categoryIcon(category);
  const supportsDocuments = categorySupportsDocuments(category);
  const docsPanelRef = useRef<RenewalDocumentsPanelHandle>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

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
  const [importing, setImporting] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditRows, setBulkEditRows] = useState<Record<string, RenewalBulkEditRowDraft>>({});
  const [bulkEditError, setBulkEditError] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<"edit" | "delete" | null>(null);

  const normalizedRenewals = useMemo(() => renewals.map(normalizeRenewal), [renewals]);
  const selectedRenewals = useMemo(
    () => normalizedRenewals.filter((item) => selectedIds.includes(item.id)),
    [normalizedRenewals, selectedIds],
  );
  const selectedRenewalMap = useMemo(
    () => new Map(selectedRenewals.map((item) => [item.id, item])),
    [selectedRenewals],
  );
  const bulkEditRowsList = useMemo(
    () => selectedRenewals.map((item) => bulkEditRows[item.id] ?? toBulkEditRowDraft(item)),
    [selectedRenewals, bulkEditRows],
  );

  const loadDocCounts = useCallback(async () => {
    if (!supportsDocuments) {
      setDocCounts({});
      return;
    }
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
  }, [normalizedRenewals, supportsDocuments]);

  useEffect(() => {
    void loadDocCounts();
  }, [loadDocCounts]);

  useEffect(() => {
    const validIds = new Set(normalizedRenewals.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [normalizedRenewals]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (search.trim()) n += 1;
    if (subTypeFilter) n += 1;
    if (ownerFilter) n += 1;
    if (expiryFilter !== "all") n += 1;
    if (supportsDocuments && docsFilter) n += 1;
    if (issuedFrom || issuedTo) n += 1;
    if (expiresFrom || expiresTo) n += 1;
    if (clientFilter.trim()) n += 1;
    if (titleFilter.trim()) n += 1;
    if (hasAmountFilter) n += 1;
    return n;
  }, [
    search, subTypeFilter, ownerFilter, expiryFilter, docsFilter, supportsDocuments,
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
      if (supportsDocuments) {
        const docCount = docCounts[item.id] ?? 0;
        if (docsFilter === "has_docs" && docCount === 0) return false;
        if (docsFilter === "missing_docs" && docCount > 0) return false;
      }
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
    docsFilter, docCounts, supportsDocuments, issuedFrom, issuedTo, expiresFrom, expiresTo,
    clientFilter, titleFilter, hasAmountFilter,
  ]);

  const isAllFilteredSelected = useMemo(() => {
    if (filtered.length === 0) return false;
    return filtered.every((item) => selectedIds.includes(item.id));
  }, [filtered, selectedIds]);

  const bulkEditChangeStats = useMemo(() => {
    let rows = 0;
    let fields = 0;
    const changedIds: string[] = [];

    for (const item of selectedRenewals) {
      const original = toBulkEditRowDraft(item);
      const draft = bulkEditRows[item.id] ?? original;
      let rowFieldCount = 0;

      if (original.subType !== draft.subType) rowFieldCount += 1;
      if (original.title !== draft.title) rowFieldCount += 1;
      if (category === "it_renewals" && original.ownerType !== draft.ownerType) rowFieldCount += 1;
      if (category === "it_renewals" && original.clientName !== draft.clientName) rowFieldCount += 1;
      if (category === "it_renewals" && original.amount !== draft.amount) rowFieldCount += 1;
      if (original.hasExpiry !== draft.hasExpiry) rowFieldCount += 1;
      if (original.renewalPeriod !== draft.renewalPeriod) rowFieldCount += 1;
      if (original.issuedOn !== draft.issuedOn) rowFieldCount += 1;
      if (original.expiresOn !== draft.expiresOn) rowFieldCount += 1;
      if (original.notes !== draft.notes) rowFieldCount += 1;

      if (rowFieldCount > 0) {
        rows += 1;
        fields += rowFieldCount;
        changedIds.push(item.id);
      }
    }

    return { rows, fields, changedIds };
  }, [selectedRenewals, bulkEditRows, category]);

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
    setForm(renewalToForm(item));
    setFormError(null);
    setIsFormOpen(true);
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filtered.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((item) => item.id)])));
  };

  const openBulkEdit = () => {
    if (selectedRenewals.length === 0) return;
    setBulkEditRows(buildBulkEditDraftMap(selectedRenewals));
    setBulkEditError(null);
    setIsBulkEditOpen(true);
  };

  const closeBulkEdit = () => {
    if (bulkAction === "edit") return;
    if (bulkEditChangeStats.fields > 0) {
      const ok = window.confirm("Close bulk edit? Unsaved changes will be lost.");
      if (!ok) return;
    }
    setIsBulkEditOpen(false);
    setBulkEditRows({});
    setBulkEditError(null);
  };

  const resetBulkEditRows = () => {
    setBulkEditRows(buildBulkEditDraftMap(selectedRenewals));
    setBulkEditError(null);
  };

  const handleBulkRowChange = (
    id: string,
    updates: Partial<Pick<RenewalBulkEditRowDraft, RenewalBulkEditableField>>,
  ) => {
    const source = selectedRenewalMap.get(id);
    if (!source) return;
    setBulkEditRows((prev) => {
      const current = prev[id] ?? toBulkEditRowDraft(source);
      return {
        ...prev,
        [id]: patchBulkEditRowDraft(category, current, updates),
      };
    });
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    docsPanelRef.current?.clearPending();
    setFormError(null);
    setSaving(false);
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

    const amountError = validateOptionalAmountString(form.amount, "Amount");
    if (amountError) {
      setFormError(amountError);
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

      if (supportsDocuments) {
        const pending = docsPanelRef.current?.getPendingUploads() ?? [];
        if (renewalId && pending.length > 0) {
          await uploadRenewalDocumentsBulk(renewalId, pending);
        }
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

  const handleBulkDelete = async () => {
    if (selectedRenewals.length === 0) return;
    const label = `${selectedRenewals.length} ${tabLabel} renewal record${
      selectedRenewals.length === 1 ? "" : "s"
    }`;
    if (!window.confirm(`Delete ${label}?`)) return;

    setBulkAction("delete");
    try {
      const results = await Promise.allSettled(
        selectedRenewals.map((item) => deleteRenewalRecord(item.id)),
      );
      const failed = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      const succeeded = results.length - failed.length;

      await onRefresh();
      await loadDocCounts();

      if (failed.length === 0) {
        setSelectedIds([]);
        setImportToast(`Deleted ${succeeded} renewal record${succeeded === 1 ? "" : "s"}.`);
        return;
      }

      const firstError =
        failed[0]?.reason instanceof Error
          ? failed[0].reason.message
          : "Failed to delete some renewal records.";
      setImportToast(
        succeeded > 0
          ? `Deleted ${succeeded} renewal record${succeeded === 1 ? "" : "s"}. ${failed.length} failed: ${firstError}`
          : firstError,
      );
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkSave = async () => {
    if (selectedRenewals.length === 0) {
      setBulkEditError("Select at least one renewal to update.");
      return;
    }
    const updates = selectedRenewals
      .map((item) => {
        const original = renewalToForm(item);
        const draft = bulkEditRows[item.id] ?? toBulkEditRowDraft(item);
        const title = category === "car_papers" ? draft.title.toUpperCase() : draft.title;
        const expiresOn = draft.hasExpiry ? draft.expiresOn : "";
        const label = title.trim() || subtypeLabels[draft.subType] || draft.subType || "Renewal";

        if (!draft.subType.trim()) {
          throw new Error(`Please select a type for ${label}.`);
        }
        if (category === "car_papers" && !title.trim()) {
          throw new Error(`Vehicle registration is required for ${label}.`);
        }
        if (category === "it_renewals" && !title.trim()) {
          throw new Error(`Domain or server name is required for ${label}.`);
        }
        if (category === "it_renewals" && draft.ownerType === "client" && !draft.clientName.trim()) {
          throw new Error(`Client name is required for ${label}.`);
        }
        if (draft.hasExpiry && !expiresOn.trim()) {
          throw new Error(`Expires on date is required for ${label}.`);
        }

        const amountError = validateOptionalAmountString(draft.amount, "Amount");
        if (amountError) {
          throw new Error(`${label}: ${amountError}`);
        }

        const payload: Partial<CreateRenewalInput> = {};
        if (original.subType !== draft.subType) payload.subType = draft.subType;
        if (original.title !== title) payload.title = title;
        if (category === "it_renewals" && original.ownerType !== draft.ownerType) {
          payload.ownerType = draft.ownerType;
        }
        if (category === "it_renewals" && original.clientName !== draft.clientName) {
          payload.clientName = draft.clientName;
        }
        if (category === "it_renewals" && original.amount !== draft.amount) {
          payload.amount = draft.amount;
        }
        if (original.hasExpiry !== draft.hasExpiry) payload.hasExpiry = draft.hasExpiry;
        if (original.renewalPeriod !== draft.renewalPeriod) {
          payload.renewalPeriod = draft.renewalPeriod;
        }
        if (original.issuedOn !== draft.issuedOn) {
          payload.issuedOn = draft.issuedOn;
          payload.renewalDate = draft.issuedOn;
        }
        if (original.expiresOn !== expiresOn) {
          payload.expiresOn = expiresOn;
          payload.expiryDate = expiresOn;
        }
        if (original.notes !== draft.notes) payload.notes = draft.notes;

        if (Object.keys(payload).length === 0) {
          return null;
        }

        return { id: item.id, payload };
      })
      .filter((entry): entry is { id: string; payload: Partial<CreateRenewalInput> } => entry !== null);

    if (updates.length === 0) {
      setBulkEditError("No changes to save.");
      return;
    }

    setBulkAction("edit");
    setBulkEditError(null);
    try {
      const results = await Promise.allSettled(
        updates.map(({ id, payload }) => updateRenewalRecord(id, payload)),
      );
      const failed = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      const succeeded = results.length - failed.length;

      await onRefresh();
      await loadDocCounts();

      if (failed.length === 0) {
        setImportToast(`Updated ${succeeded} renewal record${succeeded === 1 ? "" : "s"}.`);
        setSelectedIds([]);
        setIsBulkEditOpen(false);
        setBulkEditRows({});
        return;
      }

      const firstError =
        failed[0]?.reason instanceof Error
          ? failed[0].reason.message
          : "Failed to update some renewal records.";
      setBulkEditError(
        succeeded > 0
          ? `Updated ${succeeded} renewal record${succeeded === 1 ? "" : "s"}, but ${failed.length} failed. ${firstError}`
          : firstError,
      );
    } catch (err) {
      setBulkEditError(err instanceof Error ? err.message : "Failed to update renewals.");
    } finally {
      setBulkAction(null);
    }
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
    setSelectedIds([]);
    setIsBulkEditOpen(false);
    setBulkEditRows({});
    setBulkEditError(null);
  }, [category]);

  const defaultDocLabel = subtypeLabels[form.subType] || form.subType || tabLabel;

  const handleBulkComplete = async () => {
    await onRefresh();
    await loadDocCounts();
  };

  const handleImportFile = async (file: File) => {
    if (!onImport) return;
    setImporting(true);
    setImportToast(null);
    try {
      const buffer = await file.arrayBuffer();
      const items = await parseRenewalsWorkbook(buffer, category);
      if (items.length === 0) {
        setImportToast("No renewal rows found in the spreadsheet.");
        return;
      }

      const valid: CreateRenewalInput[] = [];
      let invalidCount = 0;
      items.forEach((item) => {
        const errors = validateRenewalImportRow(item, category, subtypeLabels);
        if (Object.keys(errors).length > 0) invalidCount += 1;
        else valid.push(item);
      });

      if (valid.length === 0) {
        setImportToast(`All ${items.length} row(s) had validation errors. Check the template columns and required fields.`);
        return;
      }

      const result = await onImport(valid);
      const skippedMsg =
        invalidCount > 0 ? ` ${invalidCount} row(s) skipped due to validation errors.` : "";
      setImportToast(
        `Import complete: ${result.created} added, ${result.updated} updated, ${result.skipped} skipped.${skippedMsg}`,
      );
      await onRefresh();
      await loadDocCounts();
    } catch (err) {
      setImportToast(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
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
            {onImport && (
              <>
                <input
                  ref={excelInputRef}
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
                  onClick={() => void downloadRenewalExcelTemplate(category, false)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition"
                  title="Download blank Excel template with column headers"
                >
                  <Download size={14} />
                  Blank Template
                </button>
                <button
                  type="button"
                  onClick={() => void downloadRenewalExcelTemplate(category, true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-lg shadow-sm transition"
                  title="Download sample-filled Excel with example data"
                >
                  <FileSpreadsheet size={14} />
                  Sample Excel
                </button>
                <button
                  type="button"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={importing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  <Upload size={14} />
                  {importing ? "Importing…" : "Bulk Upload"}
                </button>
              </>
            )}
            {supportsDocuments && (
              <button
                type="button"
                onClick={() => setIsBulkUploadOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#ff791a] text-[#ff791a] hover:bg-orange-50 text-xs font-bold rounded-lg shadow-sm transition"
              >
                <Upload size={14} />
                Upload Docs
              </button>
            )}
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

      {importToast && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
          <span>{importToast}</span>
          <button
            type="button"
            onClick={() => setImportToast(null)}
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
          {supportsDocuments && (
            <select
              value={docsFilter}
              onChange={(e) => setDocsFilter(e.target.value as DocsFilter)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[140px]"
            >
              <option value="">All Documents</option>
              <option value="has_docs">Has Documents</option>
              <option value="missing_docs">Missing Documents</option>
            </select>
          )}
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

        {!readOnly && selectedRenewals.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ff791a] px-2.5 py-1 text-[11px] font-black text-white">
                <CheckSquare size={12} />
                {selectedRenewals.length}
              </span>
              <span className="text-xs font-semibold text-slate-200">
                renewal{selectedRenewals.length === 1 ? "" : "s"} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openBulkEdit}
                disabled={bulkAction !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-100 transition hover:bg-slate-700 disabled:opacity-50"
              >
                <Pencil size={14} />
                Bulk Edit
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={bulkAction !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-700 bg-rose-900/80 px-3 py-2 text-xs font-bold text-rose-100 transition hover:bg-rose-900 disabled:opacity-50"
              >
                <Trash2 size={14} />
                {bulkAction === "delete"
                  ? "Deleting..."
                  : `Delete Selected (${selectedRenewals.length})`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                disabled={bulkAction !== null}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}

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
                  {!readOnly && (
                    <th className="py-2 pr-3 font-bold">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        className="h-4 w-4 rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a]"
                        aria-label="Select all filtered renewals"
                      />
                    </th>
                  )}
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
                  {supportsDocuments && (
                    <th className="py-2 pr-3 font-bold">Docs</th>
                  )}
                  <th className="py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const expiry = expiryMeta(item);
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-50 ${
                        isSelected ? "bg-orange-50/60 hover:bg-orange-50" : "hover:bg-slate-50/70"
                      }`}
                    >
                      {!readOnly && (
                        <td className="py-2.5 pr-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(item.id)}
                            className="h-4 w-4 rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a]"
                            aria-label={`Select ${item.title || subtypeLabels[item.subType] || item.subType}`}
                          />
                        </td>
                      )}
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
                      {supportsDocuments && (
                        <td className="py-2.5 pr-3">
                          <DocCount count={docCounts[item.id]} />
                        </td>
                      )}
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
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={closeForm}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-orange-100 bg-orange-50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="p-2 rounded-lg bg-white text-[#ff791a] shadow-sm shrink-0">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-800">
                    {editingId ? "Edit Renewal" : "Add Renewal"}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{tabLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-orange-100 transition shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Record Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-[11px] font-bold text-slate-500">
                    Type
                    <select
                      value={form.subType}
                      onChange={(e) => setForm((prev) => ({ ...prev, subType: e.target.value }))}
                      className={RENEWAL_FORM_FIELD}
                    >
                      {Object.entries(subtypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>

                  <label className={`block text-[11px] font-bold text-slate-500 ${category === "car_papers" ? "sm:col-span-2" : ""}`}>
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
                      className={`${RENEWAL_FORM_FIELD}${
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
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Renewal Schedule</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Track expiry dates for periodic renewals.
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => patchForm(prev, { hasExpiry: true }))}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                        form.hasExpiry
                          ? "bg-[#ff791a] text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50"
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
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                        !form.hasExpiry
                          ? "bg-slate-700 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {form.hasExpiry && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className="block text-[11px] font-bold text-slate-500 sm:col-span-2">
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
                        className={RENEWAL_FORM_FIELD}
                      >
                        <option value="monthly">Monthly Renewal</option>
                        <option value="yearly">Yearly Renewal</option>
                      </select>
                    </label>

                    <label className="block text-[11px] font-bold text-slate-500">
                      Issued On
                      <DateInput
                        value={form.issuedOn}
                        onChange={(e) =>
                          setForm((prev) => patchForm(prev, { issuedOn: e.target.value }))
                        }
                        className="mt-1 w-full"
                      />
                    </label>

                    <label className="block text-[11px] font-bold text-slate-500">
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
                  </div>
                )}
              </section>

              {category === "it_renewals" && (
                <section>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Ownership
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-[11px] font-bold text-slate-500">
                      Owner
                      <select
                        value={form.ownerType}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            ownerType: e.target.value as RenewalOwnerType,
                          }))
                        }
                        className={RENEWAL_FORM_FIELD}
                      >
                        <option value="mine">Mine</option>
                        <option value="client">Client</option>
                      </select>
                    </label>
                    {form.ownerType === "client" && (
                      <>
                        <label className="block text-[11px] font-bold text-slate-500">
                          Client Name
                          <input
                            value={form.clientName}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, clientName: e.target.value }))
                            }
                            className={RENEWAL_FORM_FIELD}
                          />
                        </label>
                        <label className="block text-[11px] font-bold text-slate-500 sm:col-span-2">
                          Amount (₹)
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={form.amount}
                            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                            className={RENEWAL_FORM_FIELD}
                            placeholder="Renewal amount for client"
                          />
                        </label>
                      </>
                    )}
                  </div>
                </section>
              )}

              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Notes
                </h4>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Optional comments or reminders"
                  className={RENEWAL_FORM_TEXTAREA}
                />
              </section>

              {supportsDocuments && (
                <section>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Documents
                  </h4>
                  <RenewalDocumentsPanel
                    ref={docsPanelRef}
                    renewalId={editingId}
                    defaultLabel={defaultDocLabel}
                    readOnly={readOnly}
                    hideSaveAll
                    embedded
                  />
                </section>
              )}

              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
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
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Renewal"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!readOnly && isBulkEditOpen && (
        <RenewalBulkEditModal
          count={selectedRenewals.length}
          category={category}
          subtypeLabels={subtypeLabels}
          rows={bulkEditRowsList}
          changedRowCount={bulkEditChangeStats.rows}
          changeCount={bulkEditChangeStats.fields}
          changedIds={bulkEditChangeStats.changedIds}
          saving={bulkAction === "edit"}
          error={bulkEditError}
          onClose={closeBulkEdit}
          onReset={resetBulkEditRows}
          onRowChange={handleBulkRowChange}
          onSave={() => void handleBulkSave()}
        />
      )}

      {supportsDocuments && isBulkUploadOpen && (
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

interface RenewalBulkEditModalProps {
  count: number;
  category: RenewalCategory;
  subtypeLabels: Record<string, string>;
  rows: RenewalBulkEditRowDraft[];
  changedRowCount: number;
  changeCount: number;
  changedIds: string[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onReset: () => void;
  onRowChange: (id: string, updates: Partial<Pick<RenewalBulkEditRowDraft, RenewalBulkEditableField>>) => void;
  onSave: () => void;
}

function RenewalBulkEditModal({
  count,
  category,
  subtypeLabels,
  rows,
  changedRowCount,
  changeCount,
  changedIds,
  saving,
  error,
  onClose,
  onReset,
  onRowChange,
  onSave,
}: RenewalBulkEditModalProps) {
  const titleFieldLabel = titleLabel(category);
  const changedIdSet = useMemo(() => new Set(changedIds), [changedIds]);
  const cellInputClass =
    "w-full min-w-[120px] rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20";

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[95vw] max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-orange-100 bg-orange-50 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Pencil size={16} className="text-[#ff791a]" />
              Bulk Edit Renewals
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Update {count} selected renewal{count === 1 ? "" : "s"} in tabular format, then save all changes at once.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onReset}
              disabled={changeCount === 0 || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={changeCount === 0 || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-40 text-white text-xs font-bold rounded-lg"
            >
              <Pencil size={14} />
              {saving
                ? "Saving..."
                : `Save ${changeCount} change${changeCount === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-orange-100 transition disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="font-semibold">
              {count} selected
            </span>
            <span className="text-slate-300">|</span>
            <span>
              {changedRowCount} row{changedRowCount === 1 ? "" : "s"} changed
            </span>
            <span className="text-slate-300">|</span>
            <span>
              {changeCount} field change{changeCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Orange rows have unsaved changes. Schedule fields auto-fill expiry from issued date + period.
          </p>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/60 p-4">
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[1300px] text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-600 uppercase tracking-wide">
                  <th className="px-3 py-2 font-bold">#</th>
                  <th className="px-3 py-2 font-bold">Type</th>
                  <th className="px-3 py-2 font-bold">{titleFieldLabel}</th>
                  {category === "it_renewals" && (
                    <>
                      <th className="px-3 py-2 font-bold">Owner</th>
                      <th className="px-3 py-2 font-bold">Client</th>
                      <th className="px-3 py-2 font-bold">Amount</th>
                    </>
                  )}
                  <th className="px-3 py-2 font-bold">Has Expiry</th>
                  <th className="px-3 py-2 font-bold">Period</th>
                  <th className="px-3 py-2 font-bold">Issued On</th>
                  <th className="px-3 py-2 font-bold">Expires On</th>
                  <th className="px-3 py-2 font-bold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const autoScheduleLabel = renewalPeriodLabel(row.renewalPeriod);
                  const rowChanged = changedIdSet.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 align-top ${
                        rowChanged ? "bg-orange-50/35 hover:bg-orange-50/55" : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="px-3 py-2 font-bold text-slate-500">{index + 1}</td>
                      <td className="p-2">
                        <select
                          value={row.subType}
                          onChange={(e) => onRowChange(row.id, { subType: e.target.value })}
                          className={cellInputClass}
                        >
                          {Object.entries(subtypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          value={row.title}
                          onChange={(e) => onRowChange(row.id, { title: e.target.value })}
                          className={`${cellInputClass}${category === "car_papers" ? " uppercase" : ""}`}
                          placeholder={titleFieldLabel}
                        />
                      </td>
                      {category === "it_renewals" && (
                        <>
                          <td className="p-2">
                            <select
                              value={row.ownerType}
                              onChange={(e) =>
                                onRowChange(row.id, {
                                  ownerType: e.target.value as RenewalOwnerType,
                                })
                              }
                              className={cellInputClass}
                            >
                              <option value="mine">Mine</option>
                              <option value="client">Client</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              value={row.clientName}
                              onChange={(e) => onRowChange(row.id, { clientName: e.target.value })}
                              disabled={row.ownerType !== "client"}
                              className={`${cellInputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                              placeholder="Client name"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={row.amount}
                              onChange={(e) => onRowChange(row.id, { amount: e.target.value })}
                              disabled={row.ownerType !== "client"}
                              className={`${cellInputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                              placeholder="Amount"
                            />
                          </td>
                        </>
                      )}
                      <td className="p-2">
                        <select
                          value={row.hasExpiry ? "yes" : "no"}
                          onChange={(e) => onRowChange(row.id, { hasExpiry: e.target.value === "yes" })}
                          className={`${cellInputClass} min-w-[110px]`}
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={row.renewalPeriod}
                          onChange={(e) =>
                            onRowChange(row.id, { renewalPeriod: e.target.value as RenewalPeriod })
                          }
                          disabled={!row.hasExpiry}
                          className={`${cellInputClass} min-w-[150px] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                        >
                          <option value="monthly">Monthly Renewal</option>
                          <option value="yearly">Yearly Renewal</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <DateInput
                          value={row.issuedOn}
                          onChange={(e) => onRowChange(row.id, { issuedOn: e.target.value })}
                          className="w-full min-w-[140px]"
                        />
                      </td>
                      <td className="p-2">
                        <div className="min-w-[150px]">
                          <DateInput
                            value={row.expiresOn}
                            onChange={(e) => onRowChange(row.id, { expiresOn: e.target.value })}
                            className="w-full"
                          />
                          <p className="mt-1 text-[10px] text-slate-400">
                            {row.hasExpiry ? `Auto: ${autoScheduleLabel}` : "No expiry"}
                          </p>
                        </div>
                      </td>
                      <td className="p-2">
                        <textarea
                          value={row.notes}
                          onChange={(e) => onRowChange(row.id, { notes: e.target.value })}
                          rows={2}
                          className="min-w-[220px] rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#ff791a] focus:ring-1 focus:ring-[#ff791a]/20"
                          placeholder="Notes"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}
        </div>
      </div>
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
