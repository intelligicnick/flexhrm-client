import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Save,
  RotateCcw,
  ShieldAlert,
  MousePointerClick,
  Building2,
  Tag,
  MapPin,
  Clock,
  Shield,
} from "lucide-react";
import { Contract, ContractStatus, ContractType, CreateContractInput } from "../types";
import SearchableMultiSelect from "./ui/SearchableMultiSelect";
import { matchesMultiSelectFilter } from "../lib/filter-helpers";
import {
  BOOLEAN_OPTIONS,
  CONTRACT_BULK_EDIT_FIELDS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_OPTIONS,
  ContractBulkEditFieldDef,
  ContractBulkEditReviewEntry,
  buildContractReviewEntries,
  collectContractCategories,
  collectContractCompanies,
  contractEffectiveEndDate,
  contractMatchesBgDueSoon,
  contractMatchesExpiryBand,
  contractMatchesLocationFilter,
  countContractDraftChanges,
  getContractFieldValue,
  isContractFieldDirty,
} from "../lib/contract-bulk-edit-fields";

type ColumnId = keyof CreateContractInput;

interface ColumnSelection {
  columnId: ColumnId;
  anchorContractId: string;
  focusContractId: string;
}

interface BulkContractEditTableProps {
  contracts: Contract[];
  draftChanges: Record<string, Partial<CreateContractInput>>;
  availableLocations?: string[];
  onDraftChange: (contractId: string, field: keyof CreateContractInput, value: string) => void;
  onDraftChangeMany?: (
    updates: Array<{ contractId: string; field: keyof CreateContractInput; value: string }>,
  ) => void;
  onDiscard: () => void;
  onApply: () => Promise<void>;
  isApplying?: boolean;
}

function isDropdownField(field: ContractBulkEditFieldDef): boolean {
  return field.type === "select" || field.type === "boolean" || !!field.dynamicOptions;
}

function isTextInputColumn(field: ContractBulkEditFieldDef | undefined): boolean {
  return !!field && field.type === "text";
}

function selectionToContractIds(
  selection: ColumnSelection,
  filteredContracts: Contract[],
): string[] {
  const anchorIdx = filteredContracts.findIndex((c) => c.id === selection.anchorContractId);
  const focusIdx = filteredContracts.findIndex((c) => c.id === selection.focusContractId);
  if (anchorIdx === -1 || focusIdx === -1) return [];
  const start = Math.min(anchorIdx, focusIdx);
  const end = Math.max(anchorIdx, focusIdx);
  return filteredContracts.slice(start, end + 1).map((c) => c.id);
}

function getFieldDef(columnId: ColumnId): ContractBulkEditFieldDef | undefined {
  return CONTRACT_BULK_EDIT_FIELDS.find((f) => f.key === columnId);
}

function getDraftValue(
  contract: Contract,
  field: keyof CreateContractInput,
  drafts: Record<string, Partial<CreateContractInput>>,
): string {
  const draft = drafts[contract.id];
  if (draft && field in draft) {
    if (field === "hasExtension" || field === "bgApplicable") {
      const val = draft[field];
      return val === true || String(val) === "Yes" ? "Yes" : "No";
    }
    return String(draft[field] ?? "");
  }
  return getContractFieldValue(contract, field);
}

function ReviewChangeRow({ entry }: { entry: ContractBulkEditReviewEntry }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 text-left cursor-pointer"
      >
        <div>
          <span className="font-semibold text-slate-800 text-xs">{entry.contractNo}</span>
          <span className="text-slate-400 text-[10px] ml-2">({entry.companyName})</span>
          <span className="text-amber-700 text-[10px] font-medium ml-2">
            {entry.fieldChanges.length} field(s)
          </span>
        </div>
        <span className="text-slate-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase tracking-wide text-[9px]">
                <th className="px-3 py-1.5 text-left font-semibold w-[28%]">Field</th>
                <th className="px-3 py-1.5 text-left font-semibold w-[36%]">Old Value</th>
                <th className="px-3 py-1.5 text-left font-semibold w-[36%]">New Value</th>
              </tr>
            </thead>
            <tbody>
              {entry.fieldChanges.map((change) => (
                <tr key={change.key} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-medium text-slate-700 align-top">{change.label}</td>
                  <td className="px-3 py-1.5 text-rose-700 bg-rose-50/40 align-top break-words">
                    {change.oldValue}
                  </td>
                  <td className="px-3 py-1.5 text-emerald-800 bg-emerald-50/40 font-medium align-top break-words">
                    {change.newValue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BulkContractEditTable({
  contracts,
  draftChanges,
  availableLocations = [],
  onDraftChange,
  onDraftChangeMany,
  onDiscard,
  onApply,
  isApplying = false,
}: BulkContractEditTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ContractType>("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [companyFilters, setCompanyFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [expiryFilter, setExpiryFilter] = useState<"all" | "active" | "expiring_soon" | "expired">("all");
  const [bgDueOnly, setBgDueOnly] = useState(false);
  const [locationFilters, setLocationFilters] = useState<string[]>([]);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [columnSelection, setColumnSelection] = useState<ColumnSelection | null>(null);
  const [bulkFillText, setBulkFillText] = useState("");
  const columnSelectionRef = useRef<ColumnSelection | null>(null);
  const selectedContractIdsRef = useRef<string[]>([]);

  const companies = useMemo(() => collectContractCompanies(contracts), [contracts]);
  const categories = useMemo(() => collectContractCategories(contracts), [contracts]);

  const locations = useMemo(() => {
    const locSet = new Set<string>(availableLocations.filter(Boolean));
    for (const contract of contracts) {
      for (const loc of contract.linkedLocations || []) {
        if (loc.trim()) locSet.add(loc.trim());
      }
      if (contract.officeName?.trim()) locSet.add(contract.officeName.trim());
    }
    return Array.from(locSet).sort((a, b) => a.localeCompare(b));
  }, [contracts, availableLocations]);

  const filteredContracts = useMemo(() => {
    let result = [...contracts];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter((c) =>
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
          .includes(q),
      );
    }
    if (typeFilter) result = result.filter((c) => c.contractType === typeFilter);
    if (statusFilters.length > 0) {
      result = result.filter((c) => matchesMultiSelectFilter(c.status, statusFilters));
    }
    if (companyFilters.length > 0) {
      result = result.filter((c) => matchesMultiSelectFilter(c.companyName, companyFilters));
    }
    if (categoryFilters.length > 0) {
      result = result.filter((c) => matchesMultiSelectFilter(c.category, categoryFilters));
    }
    if (expiryFilter !== "all") {
      result = result.filter((c) => contractMatchesExpiryBand(c, expiryFilter));
    }
    if (bgDueOnly) {
      result = result.filter((c) => contractMatchesBgDueSoon(c));
    }
    if (locationFilters.length > 0) {
      result = result.filter((c) => contractMatchesLocationFilter(c, locationFilters));
    }
    return result.sort((a, b) => {
      const aTs = Date.parse(contractEffectiveEndDate(a)) || 0;
      const bTs = Date.parse(contractEffectiveEndDate(b)) || 0;
      return bTs - aTs;
    });
  }, [
    contracts,
    searchTerm,
    typeFilter,
    statusFilters,
    companyFilters,
    categoryFilters,
    expiryFilter,
    bgDueOnly,
    locationFilters,
  ]);

  const selectedContractIds = useMemo(
    () =>
      columnSelection ? selectionToContractIds(columnSelection, filteredContracts) : [],
    [columnSelection, filteredContracts],
  );

  useEffect(() => {
    columnSelectionRef.current = columnSelection;
    selectedContractIdsRef.current = selectedContractIds;
  }, [columnSelection, selectedContractIds]);

  const selectedFieldDef = useMemo(
    () => (columnSelection ? getFieldDef(columnSelection.columnId) : undefined),
    [columnSelection],
  );

  const isTextBulkFillColumn = useMemo(() => {
    if (!columnSelection || selectedContractIds.length <= 1) return false;
    return isTextInputColumn(selectedFieldDef);
  }, [columnSelection, selectedContractIds.length, selectedFieldDef]);

  const resolveSelectOptions = useCallback(
    (field: ContractBulkEditFieldDef, contract: Contract): string[] => {
      if (field.dynamicOptions === "company") {
        const set = new Set([...companies, contract.companyName].filter(Boolean));
        return Array.from(set).sort();
      }
      if (field.dynamicOptions === "category") {
        const set = new Set([...categories, contract.category].filter(Boolean));
        return Array.from(set).sort();
      }
      if (field.type === "boolean") return BOOLEAN_OPTIONS;
      if (field.key === "status") {
        return field.options || [];
      }
      if (field.key === "contractType") {
        return field.options || [];
      }
      return field.options || [];
    },
    [categories, companies],
  );

  const resolveColumnFillOptions = useCallback(
    (columnId: ColumnId): string[] => {
      const sample = filteredContracts[0];
      const def = getFieldDef(columnId);
      if (!def || !sample) return [];
      return resolveSelectOptions(def, sample);
    },
    [filteredContracts, resolveSelectOptions],
  );

  const syncSelectionRefs = useCallback(
    (selection: ColumnSelection | null) => {
      columnSelectionRef.current = selection;
      selectedContractIdsRef.current = selection
        ? selectionToContractIds(selection, filteredContracts)
        : [];
    },
    [filteredContracts],
  );

  const clearColumnSelection = useCallback(() => {
    syncSelectionRefs(null);
    setColumnSelection(null);
  }, [syncSelectionRefs]);

  const activateCell = useCallback(
    (contractId: string, columnId: ColumnId, shiftKey: boolean) => {
      const selection = columnSelectionRef.current;

      if (shiftKey && selection) {
        const clickIdx = filteredContracts.findIndex((c) => c.id === contractId);
        if (clickIdx === -1) return;

        if (selection.columnId === columnId) {
          const next = { ...selection, focusContractId: contractId };
          syncSelectionRefs(next);
          setColumnSelection(next);
          return;
        }

        const anchorIdx = filteredContracts.findIndex((c) => c.id === selection.anchorContractId);
        const focusIdx = filteredContracts.findIndex((c) => c.id === selection.focusContractId);
        if (anchorIdx === -1) return;
        const start = Math.min(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        const end = Math.max(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        const next = {
          columnId,
          anchorContractId: filteredContracts[start].id,
          focusContractId: filteredContracts[end].id,
        };
        syncSelectionRefs(next);
        setColumnSelection(next);
        return;
      }

      const next = {
        columnId,
        anchorContractId: contractId,
        focusContractId: contractId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [filteredContracts, syncSelectionRefs],
  );

  const handleTdMouseDown = useCallback(
    (
      e: React.MouseEvent,
      contractId: string,
      columnId: ColumnId,
      isDropdownColumn: boolean,
    ) => {
      if (e.button !== 0) return;

      const selection = columnSelectionRef.current;
      const selectedIds = selectedContractIdsRef.current;
      const isAlreadySelected =
        selection?.columnId === columnId && selectedIds.includes(contractId);

      if (
        isDropdownColumn &&
        !e.shiftKey &&
        isAlreadySelected &&
        selectedIds.length > 1 &&
        (e.target as HTMLElement).matches("select, option")
      ) {
        return;
      }

      if (e.shiftKey) e.preventDefault();
      activateCell(contractId, columnId, e.shiftKey);
    },
    [activateCell],
  );

  const isCellSelected = useCallback(
    (contractId: string, columnId: ColumnId) =>
      columnSelection?.columnId === columnId && selectedContractIds.includes(contractId),
    [columnSelection, selectedContractIds],
  );

  const extendSelectionByArrow = useCallback(
    (contractId: string, columnId: ColumnId, direction: "up" | "down") => {
      const currentIdx = filteredContracts.findIndex((c) => c.id === contractId);
      if (currentIdx === -1) return;

      const nextIdx = direction === "down" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= filteredContracts.length) return;

      const nextContractId = filteredContracts[nextIdx].id;

      if (columnSelection?.columnId === columnId && selectedContractIds.includes(contractId)) {
        const next = { ...columnSelection, focusContractId: nextContractId };
        syncSelectionRefs(next);
        setColumnSelection(next);
        return;
      }

      const next = {
        columnId,
        anchorContractId: contractId,
        focusContractId: nextContractId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [columnSelection, filteredContracts, selectedContractIds, syncSelectionRefs],
  );

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, contractId: string, columnId: ColumnId) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      const currentIdx = filteredContracts.findIndex((c) => c.id === contractId);
      if (currentIdx === -1) return;
      const nextIdx = e.key === "ArrowDown" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= filteredContracts.length) return;

      const nextId = filteredContracts[nextIdx].id;
      const focusTarget = `[data-bulk-cell="${columnId}"][data-contract-id="${nextId}"]`;

      if (e.shiftKey) {
        e.preventDefault();
        extendSelectionByArrow(
          contractId,
          columnId,
          e.key === "ArrowDown" ? "down" : "up",
        );
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(focusTarget)?.focus();
        });
        return;
      }

      e.preventDefault();
      const next = {
        columnId,
        anchorContractId: nextId,
        focusContractId: nextId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(focusTarget)?.focus();
      });
    },
    [extendSelectionByArrow, filteredContracts, syncSelectionRefs],
  );

  const handleColumnHeaderClick = useCallback(
    (columnId: ColumnId) => {
      const allIds = filteredContracts.map((c) => c.id);
      if (allIds.length === 0) return;
      const next = {
        columnId,
        anchorContractId: allIds[0],
        focusContractId: allIds[allIds.length - 1],
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [filteredContracts, syncSelectionRefs],
  );

  const applyFieldValue = useCallback(
    (contractIds: string[], columnId: ColumnId, value: string) => {
      if (contractIds.length === 0) return;

      if (columnId === "hasExtension" && value === "No") {
        const updates: Array<{ contractId: string; field: keyof CreateContractInput; value: string }> =
          contractIds.flatMap((contractId) => [
            { contractId, field: "hasExtension" as const, value: "No" },
            { contractId, field: "extensionEndDate" as const, value: "" },
          ]);
        if (onDraftChangeMany) {
          onDraftChangeMany(updates);
          return;
        }
        for (const update of updates) {
          onDraftChange(update.contractId, update.field, update.value);
        }
        return;
      }

      if (onDraftChangeMany && contractIds.length > 1) {
        onDraftChangeMany(
          contractIds.map((contractId) => ({ contractId, field: columnId, value })),
        );
        return;
      }
      for (const contractId of contractIds) {
        onDraftChange(contractId, columnId, value);
      }
    },
    [onDraftChange, onDraftChangeMany],
  );

  const handleFieldChange = useCallback(
    (contractId: string, columnId: ColumnId, value: string) => {
      const selection = columnSelectionRef.current;
      const selectedIds = selectedContractIdsRef.current;
      const targets =
        selection?.columnId === columnId && selectedIds.includes(contractId)
          ? selectedIds
          : [contractId];
      applyFieldValue(targets, columnId, value);
    },
    [applyFieldValue],
  );

  const handleBulkFillSelect = useCallback(
    (value: string) => {
      if (!columnSelection || selectedContractIds.length === 0) return;
      applyFieldValue(selectedContractIds, columnSelection.columnId, value);
    },
    [applyFieldValue, columnSelection, selectedContractIds],
  );

  const handleBulkFillTextApply = useCallback(() => {
    if (!columnSelection || selectedContractIds.length === 0) return;
    applyFieldValue(selectedContractIds, columnSelection.columnId, bulkFillText);
  }, [applyFieldValue, bulkFillText, columnSelection, selectedContractIds]);

  useEffect(() => {
    setBulkFillText("");
  }, [columnSelection]);

  useEffect(() => {
    clearColumnSelection();
  }, [
    searchTerm,
    typeFilter,
    statusFilters,
    companyFilters,
    categoryFilters,
    expiryFilter,
    bgDueOnly,
    locationFilters,
    clearColumnSelection,
  ]);

  const { contractCount, fieldCount } = countContractDraftChanges(contracts, draftChanges);
  const reviewEntries = useMemo(
    () => buildContractReviewEntries(contracts, draftChanges),
    [contracts, draftChanges],
  );
  const totalColumns = CONTRACT_BULK_EDIT_FIELDS.length;

  const fieldGroups = useMemo(() => {
    const groups: { name: string; count: number }[] = [];
    for (const field of CONTRACT_BULK_EDIT_FIELDS) {
      const g = field.group || "Other";
      const last = groups[groups.length - 1];
      if (last && last.name === g) last.count += 1;
      else groups.push({ name: g, count: 1 });
    }
    return groups;
  }, []);

  const handleApply = async () => {
    setApplyError(null);
    try {
      await onApply();
      setShowReviewDialog(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to apply bulk changes.";
      setApplyError(message);
    }
  };

  const openReviewDialog = () => {
    setApplyError(null);
    setShowReviewDialog(true);
  };

  const renderCell = (contract: Contract, field: ContractBulkEditFieldDef) => {
    const value = getDraftValue(contract, field.key, draftChanges);
    const draft = draftChanges[contract.id];
    const isDirty = isContractFieldDirty(contract, draft, field.key);
    const selected = isCellSelected(contract.id, field.key);
    const dirtyClass = isDirty
      ? "border-amber-400 bg-amber-50/80 ring-1 ring-amber-200"
      : "border-slate-200";
    const selectedClass = selected ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50/60" : "";
    const cellDataAttrs = {
      "data-bulk-cell": field.key,
      "data-contract-id": contract.id,
    };

    const extensionDisabled =
      field.key === "extensionEndDate" &&
      getDraftValue(contract, "hasExtension", draftChanges) !== "Yes";

    if (field.type === "select" || field.type === "boolean" || field.dynamicOptions) {
      const options = resolveSelectOptions(field, contract);
      return (
        <select
          value={value}
          {...cellDataAttrs}
          disabled={extensionDisabled}
          onKeyDown={(e) => handleCellKeyDown(e, contract.id, field.key)}
          onChange={(e) => handleFieldChange(contract.id, field.key, e.target.value)}
          className={`w-full min-w-0 px-1.5 py-1 text-[11px] border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${dirtyClass} ${selectedClass}`}
        >
          <option value="">
            {extensionDisabled ? "No extension" : "—"}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {field.key === "status"
                ? CONTRACT_STATUS_LABELS[opt as ContractStatus] || opt
                : field.key === "contractType"
                  ? opt === "travel"
                    ? "Travel Plus"
                    : "Manpower"
                  : opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={value}
        {...cellDataAttrs}
        disabled={extensionDisabled}
        onKeyDown={(e) => handleCellKeyDown(e, contract.id, field.key)}
        onChange={(e) => handleFieldChange(contract.id, field.key, e.target.value)}
        className={`w-full min-w-0 px-1.5 py-1 text-[11px] border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed ${dirtyClass} ${selectedClass}`}
      />
    );
  };

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-amber-950 text-sm">Contract Bulk Edit</h3>
          <p className="text-xs text-amber-800/80 mt-0.5">
            Edit contract fields in spreadsheet mode — parties, period, BG, DDO, and status.
            Select multiple rows in a column to bulk-fill. Review changes before applying.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {contractCount > 0 && (
            <span className="text-xs font-bold bg-amber-200 text-amber-950 px-2.5 py-1 rounded-full">
              {contractCount} contract(s) · {fieldCount} field(s) changed
            </span>
          )}
          <button
            type="button"
            onClick={onDiscard}
            disabled={isApplying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Discard All
          </button>
          <button
            type="button"
            onClick={openReviewDialog}
            disabled={contractCount === 0 || isApplying}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            Review Changes
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              id="contract-bulk-edit-search"
              name="contract-bulk-edit-search"
              type="text"
              aria-label="Search contracts"
              placeholder="Search contract no, company, officer, office, DDO, BG…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <select
            id="contract-bulk-type-filter"
            name="contract-bulk-type-filter"
            aria-label="Filter by contract type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | ContractType)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="">All types</option>
            <option value="manpower">Manpower</option>
            <option value="travel">Travel Plus</option>
          </select>
          <select
            id="contract-bulk-expiry-filter"
            name="contract-bulk-expiry-filter"
            aria-label="Filter by expiry"
            value={expiryFilter}
            onChange={(e) =>
              setExpiryFilter(e.target.value as typeof expiryFilter)
            }
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="all">All expiry</option>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring in 60 days</option>
            <option value="expired">Expired</option>
          </select>
          <label className="flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white cursor-pointer whitespace-nowrap">
            <input
              id="contract-bulk-bg-due-filter"
              name="contract-bulk-bg-due-filter"
              type="checkbox"
              aria-label="Show contracts with bank guarantee due soon"
              checked={bgDueOnly}
              onChange={(e) => setBgDueOnly(e.target.checked)}
              className="rounded"
            />
            <Shield size={14} className="text-violet-500" />
            BG due soon
          </label>
        </div>

        <div className="flex flex-col lg:flex-row gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 min-w-[150px] flex-1">
            <Building2 size={16} className="text-slate-400 mr-1 shrink-0" />
            <SearchableMultiSelect
              compact
              placeholder="All Companies"
              options={companies}
              selected={companyFilters}
              onChange={setCompanyFilters}
              className="flex-1 min-w-0"
              containerId="contract-bulk-company-filter"
            />
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 min-w-[150px] flex-1">
            <Tag size={16} className="text-slate-400 mr-1 shrink-0" />
            <SearchableMultiSelect
              compact
              placeholder="All Categories"
              options={categories}
              selected={categoryFilters}
              onChange={setCategoryFilters}
              className="flex-1 min-w-0"
              containerId="contract-bulk-category-filter"
            />
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 min-w-[150px] flex-1">
            <MapPin size={16} className="text-slate-400 mr-1 shrink-0" />
            <SearchableMultiSelect
              compact
              placeholder="All Locations"
              options={locations}
              selected={locationFilters}
              onChange={setLocationFilters}
              className="flex-1 min-w-0"
              containerId="contract-bulk-location-filter"
            />
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 min-w-[150px] flex-1">
            <Clock size={16} className="text-slate-400 mr-1 shrink-0" />
            <SearchableMultiSelect
              compact
              placeholder="All Statuses"
              options={CONTRACT_STATUS_OPTIONS.map(
                (status) => CONTRACT_STATUS_LABELS[status],
              )}
              selected={statusFilters.map(
                (status) => CONTRACT_STATUS_LABELS[status as ContractStatus] || status,
              )}
              onChange={(labels) => {
                const keys = labels.map(
                  (label) =>
                    (Object.entries(CONTRACT_STATUS_LABELS).find(
                      ([, value]) => value === label,
                    )?.[0] as ContractStatus | undefined) || label,
                );
                setStatusFilters(keys);
              }}
              className="flex-1 min-w-0"
              containerId="contract-bulk-status-filter"
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Showing {filteredContracts.length} of {contracts.length} contracts
        </p>
      </div>

      {columnSelection && selectedContractIds.length > 0 && (
        <div className="px-4 py-2 border-b border-blue-200 bg-blue-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-blue-900">
            <MousePointerClick size={14} />
            <span>
              <strong>{selectedContractIds.length}</strong> row
              {selectedContractIds.length !== 1 ? "s" : ""} selected
              {selectedFieldDef ? ` in ${selectedFieldDef.label}` : ""}
            </span>
          </div>
          {selectedContractIds.length > 1 &&
            selectedFieldDef &&
            isDropdownField(selectedFieldDef) && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-blue-900 whitespace-nowrap">
                  Fill all selected:
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleBulkFillSelect(e.target.value);
                    e.target.value = "";
                  }}
                  className="text-xs border border-blue-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-[160px]"
                >
                  <option value="">Choose value…</option>
                  {resolveColumnFillOptions(columnSelection.columnId).map((opt) => (
                    <option key={opt} value={opt}>
                      {selectedFieldDef.key === "status"
                        ? CONTRACT_STATUS_LABELS[opt as ContractStatus] || opt
                        : selectedFieldDef.key === "contractType"
                          ? opt === "travel"
                            ? "Travel Plus"
                            : "Manpower"
                          : opt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          {isTextBulkFillColumn && (
            <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-xl">
              <label
                htmlFor="contract-bulk-fill-text"
                className="text-[11px] font-semibold text-blue-900 whitespace-nowrap"
              >
                Fill all selected:
              </label>
              <input
                id="contract-bulk-fill-text"
                name="contract-bulk-fill-text"
                type="text"
                value={bulkFillText}
                onChange={(e) => setBulkFillText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleBulkFillTextApply();
                  }
                }}
                placeholder={`Type ${selectedFieldDef?.label ?? "value"}…`}
                className="flex-1 min-w-0 text-xs border border-blue-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleBulkFillTextApply}
                className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 cursor-pointer whitespace-nowrap"
              >
                Apply
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={clearColumnSelection}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="px-4 py-1.5 border-b border-slate-100 bg-white text-[10px] text-slate-500">
        Select rows: click a cell · <strong>Shift+click</strong> to extend · <strong>Shift+↑/↓</strong> with
        keyboard · column header = select all · for dropdown columns, use <strong>Fill all selected</strong> or
        change any selected cell’s dropdown · for text columns, type once in <strong>Fill all selected</strong> and press Apply
      </div>

      <div className="overflow-auto max-h-[620px]">
        <table className="w-full text-left border-collapse min-w-max">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-200 border-b border-slate-300 text-slate-600 text-[9px] font-bold uppercase tracking-wider">
              <th className="sticky left-0 z-20 bg-slate-200 p-1 w-12 border-r border-slate-300" />
              {fieldGroups.map((g) => (
                <th
                  key={g.name}
                  colSpan={g.count}
                  className="p-1 text-center border-r border-slate-300"
                >
                  {g.name}
                </th>
              ))}
            </tr>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[10px] font-semibold uppercase tracking-wide">
              <th className="sticky left-0 z-20 bg-slate-100 p-2 w-12 text-center border-r border-slate-200">
                #
              </th>
              {CONTRACT_BULK_EDIT_FIELDS.map((field) => (
                <th
                  key={field.key}
                  className="p-2 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-blue-100/60 transition"
                  style={{ minWidth: field.minWidth }}
                  title={`${field.group} — Click to select entire column`}
                  onClick={() => handleColumnHeaderClick(field.key)}
                >
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredContracts.length === 0 ? (
              <tr>
                <td colSpan={totalColumns + 1} className="py-12 text-center text-slate-400">
                  <ShieldAlert className="mx-auto mb-2 opacity-50" size={24} />
                  No contracts match your filters.
                </td>
              </tr>
            ) : (
              filteredContracts.map((contract, index) => {
                const draft = draftChanges[contract.id];
                const rowHasChanges = !!draft && Object.keys(draft).length > 0;

                return (
                  <tr
                    key={contract.id}
                    className={rowHasChanges ? "bg-amber-50/30" : "hover:bg-slate-50/70"}
                  >
                    <td className="sticky left-0 z-[15] bg-inherit p-2 text-center font-bold text-slate-500 border-r border-slate-200">
                      {index + 1}
                    </td>
                    {CONTRACT_BULK_EDIT_FIELDS.map((field) => (
                      <td
                        key={field.key}
                        onMouseDown={(e) =>
                          handleTdMouseDown(e, contract.id, field.key, isDropdownField(field))
                        }
                        className={`p-1 border-r border-slate-100 ${
                          isCellSelected(contract.id, field.key) ? "bg-blue-50/40" : ""
                        }`}
                        style={{ minWidth: field.minWidth }}
                      >
                        {renderCell(contract, field)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-500">
        {CONTRACT_BULK_EDIT_FIELDS.length} editable fields · Showing {filteredContracts.length} of{" "}
        {contracts.length} contracts ·{" "}
        <span className="text-amber-700 font-medium">Amber</span> = unsaved change
      </div>

      {showReviewDialog &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-base">Review Contract Changes</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reviewEntries.length} contract(s) with {fieldCount} total field change(s)
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {reviewEntries.map((entry) => (
                  <ReviewChangeRow key={entry.contractId} entry={entry} />
                ))}
              </div>
              {applyError && (
                <div className="px-5 py-2 bg-red-50 text-red-700 text-xs border-t border-red-100">
                  {applyError}
                </div>
              )}
              <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReviewDialog(false)}
                  disabled={isApplying}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={isApplying}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isApplying ? "Applying…" : "Apply Changes"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
