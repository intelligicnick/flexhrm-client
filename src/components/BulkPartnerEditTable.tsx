import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Save, Search, ShieldAlert, MousePointerClick } from "lucide-react";
import { SchoolPartner } from "../types";
import { getPartnerPerToiletPay } from "../lib/school-work-helpers";

type PartnerBulkEditFieldDef = {
  key: keyof SchoolPartner;
  label: string;
  type: "text" | "number" | "select";
};

const EDITABLE_FIELDS: PartnerBulkEditFieldDef[] = [
  { key: "schoolName", label: "School Name", type: "text" },
  { key: "partnerName", label: "Partner Name", type: "text" },
  { key: "accountHolderName", label: "Account Holder", type: "text" },
  { key: "accountNumber", label: "Account Number", type: "text" },
  { key: "ifscCode", label: "IFSC Code", type: "text" },
  { key: "monthlyPay", label: "Monthly Pay (₹)", type: "number" },
  { key: "perToiletPay", label: "Per toilet pay (₹)", type: "number" },
  { key: "noOfToilets", label: "No of Toilets", type: "number" },
  { key: "block", label: "Block", type: "select" },
  { key: "district", label: "District", type: "select" },
];

type ColumnId = keyof SchoolPartner;

interface ColumnSelection {
  columnId: ColumnId;
  anchorPartnerId: string;
  focusPartnerId: string;
}

interface BulkPartnerEditTableProps {
  partners: SchoolPartner[];
  draftChanges: Record<string, Partial<SchoolPartner>>;
  onDraftChange: (partnerId: string, field: keyof SchoolPartner, value: string) => void;
  onDraftChangeMany?: (
    updates: Array<{ partnerId: string; field: keyof SchoolPartner; value: string }>,
  ) => void;
  onDiscard: () => void;
  onApply: () => Promise<void>;
  isApplying?: boolean;
  readOnly?: boolean;
}

function getDraftValue(
  partner: SchoolPartner,
  field: keyof SchoolPartner,
  drafts: Record<string, Partial<SchoolPartner>>,
): string {
  const draft = drafts[partner.id];
  if (draft && field in draft) return String(draft[field] ?? "");
  if (field === "perToiletPay") return String(getPartnerPerToiletPay(partner));
  return String(partner[field] ?? "");
}

function countDraftChanges(drafts: Record<string, Partial<SchoolPartner>>): number {
  return Object.values(drafts).reduce((sum, changes) => sum + Object.keys(changes).length, 0);
}

function isDropdownField(field: PartnerBulkEditFieldDef): boolean {
  return field.type === "select";
}

function selectionToPartnerIds(
  selection: ColumnSelection,
  filteredPartners: SchoolPartner[],
): string[] {
  const anchorIdx = filteredPartners.findIndex((p) => p.id === selection.anchorPartnerId);
  const focusIdx = filteredPartners.findIndex((p) => p.id === selection.focusPartnerId);
  if (anchorIdx === -1 || focusIdx === -1) return [];
  const start = Math.min(anchorIdx, focusIdx);
  const end = Math.max(anchorIdx, focusIdx);
  return filteredPartners.slice(start, end + 1).map((p) => p.id);
}

export default function BulkPartnerEditTable({
  partners,
  draftChanges,
  onDraftChange,
  onDraftChangeMany,
  onDiscard,
  onApply,
  isApplying = false,
  readOnly = false,
}: BulkPartnerEditTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [columnSelection, setColumnSelection] = useState<ColumnSelection | null>(null);
  const columnSelectionRef = useRef<ColumnSelection | null>(null);
  const selectedPartnerIdsRef = useRef<string[]>([]);

  const blocks = useMemo(
    () => Array.from(new Set(partners.map((p) => p.block).filter(Boolean))).sort(),
    [partners],
  );

  const districts = useMemo(
    () => Array.from(new Set(partners.map((p) => p.district).filter(Boolean))).sort(),
    [partners],
  );

  const filteredPartners = useMemo(() => {
    let result = [...partners];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.schoolName?.toLowerCase().includes(q) ||
          p.partnerName?.toLowerCase().includes(q) ||
          p.accountNumber?.toLowerCase().includes(q),
      );
    }
    if (blockFilter) result = result.filter((p) => p.block === blockFilter);
    if (districtFilter) result = result.filter((p) => p.district === districtFilter);
    return result.sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [partners, searchTerm, blockFilter, districtFilter]);

  const selectedPartnerIds = useMemo(
    () =>
      columnSelection ? selectionToPartnerIds(columnSelection, filteredPartners) : [],
    [columnSelection, filteredPartners],
  );

  useEffect(() => {
    columnSelectionRef.current = columnSelection;
    selectedPartnerIdsRef.current = selectedPartnerIds;
  }, [columnSelection, selectedPartnerIds]);

  const selectedFieldDef = useMemo(
    () =>
      columnSelection
        ? EDITABLE_FIELDS.find((f) => f.key === columnSelection.columnId)
        : undefined,
    [columnSelection],
  );

  const resolveSelectOptions = useCallback(
    (field: keyof SchoolPartner, partner: SchoolPartner): string[] => {
      if (field === "block") {
        return Array.from(new Set([...blocks, partner.block].filter(Boolean))).sort();
      }
      if (field === "district") {
        return Array.from(new Set([...districts, partner.district].filter(Boolean))).sort();
      }
      return [];
    },
    [blocks, districts],
  );

  const resolveColumnFillOptions = useCallback(
    (columnId: ColumnId): string[] => {
      const sample = filteredPartners[0];
      if (!sample) return [];
      return resolveSelectOptions(columnId, sample);
    },
    [filteredPartners, resolveSelectOptions],
  );

  const syncSelectionRefs = useCallback(
    (selection: ColumnSelection | null) => {
      columnSelectionRef.current = selection;
      selectedPartnerIdsRef.current = selection
        ? selectionToPartnerIds(selection, filteredPartners)
        : [];
    },
    [filteredPartners],
  );

  const clearColumnSelection = useCallback(() => {
    syncSelectionRefs(null);
    setColumnSelection(null);
  }, [syncSelectionRefs]);

  const activateCell = useCallback(
    (partnerId: string, columnId: ColumnId, shiftKey: boolean) => {
      const selection = columnSelectionRef.current;

      if (shiftKey && selection) {
        const clickIdx = filteredPartners.findIndex((p) => p.id === partnerId);
        if (clickIdx === -1) return;

        if (selection.columnId === columnId) {
          const next = { ...selection, focusPartnerId: partnerId };
          syncSelectionRefs(next);
          setColumnSelection(next);
          return;
        }

        const anchorIdx = filteredPartners.findIndex((p) => p.id === selection.anchorPartnerId);
        const focusIdx = filteredPartners.findIndex((p) => p.id === selection.focusPartnerId);
        if (anchorIdx === -1) return;
        const start = Math.min(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        const end = Math.max(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        const next = {
          columnId,
          anchorPartnerId: filteredPartners[start].id,
          focusPartnerId: filteredPartners[end].id,
        };
        syncSelectionRefs(next);
        setColumnSelection(next);
        return;
      }

      const next = {
        columnId,
        anchorPartnerId: partnerId,
        focusPartnerId: partnerId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [filteredPartners, syncSelectionRefs],
  );

  const handleTdMouseDown = useCallback(
    (
      e: React.MouseEvent,
      partnerId: string,
      columnId: ColumnId,
      isDropdownColumn: boolean,
    ) => {
      if (e.button !== 0) return;

      const selection = columnSelectionRef.current;
      const selectedIds = selectedPartnerIdsRef.current;
      const isAlreadySelected =
        selection?.columnId === columnId && selectedIds.includes(partnerId);

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
      activateCell(partnerId, columnId, e.shiftKey);
    },
    [activateCell],
  );

  const isCellSelected = useCallback(
    (partnerId: string, columnId: ColumnId) =>
      columnSelection?.columnId === columnId && selectedPartnerIds.includes(partnerId),
    [columnSelection, selectedPartnerIds],
  );

  const extendSelectionByArrow = useCallback(
    (partnerId: string, columnId: ColumnId, direction: "up" | "down") => {
      const currentIdx = filteredPartners.findIndex((p) => p.id === partnerId);
      if (currentIdx === -1) return;

      const nextIdx = direction === "down" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= filteredPartners.length) return;

      const nextPartnerId = filteredPartners[nextIdx].id;

      if (columnSelection?.columnId === columnId && selectedPartnerIds.includes(partnerId)) {
        const next = { ...columnSelection, focusPartnerId: nextPartnerId };
        syncSelectionRefs(next);
        setColumnSelection(next);
        return;
      }

      const next = {
        columnId,
        anchorPartnerId: partnerId,
        focusPartnerId: nextPartnerId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [columnSelection, filteredPartners, selectedPartnerIds, syncSelectionRefs],
  );

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, partnerId: string, columnId: ColumnId) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      const currentIdx = filteredPartners.findIndex((p) => p.id === partnerId);
      if (currentIdx === -1) return;
      const nextIdx = e.key === "ArrowDown" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= filteredPartners.length) return;

      const nextId = filteredPartners[nextIdx].id;
      const focusTarget = `[data-bulk-cell="${columnId}"][data-partner-id="${nextId}"]`;

      if (e.shiftKey) {
        e.preventDefault();
        extendSelectionByArrow(
          partnerId,
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
        anchorPartnerId: nextId,
        focusPartnerId: nextId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(focusTarget)?.focus();
      });
    },
    [extendSelectionByArrow, filteredPartners, syncSelectionRefs],
  );

  const handleColumnHeaderClick = useCallback(
    (columnId: ColumnId) => {
      const allIds = filteredPartners.map((p) => p.id);
      if (allIds.length === 0) return;
      const next = {
        columnId,
        anchorPartnerId: allIds[0],
        focusPartnerId: allIds[allIds.length - 1],
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [filteredPartners, syncSelectionRefs],
  );

  const applyFieldValue = useCallback(
    (partnerIds: string[], columnId: ColumnId, value: string) => {
      if (partnerIds.length === 0) return;

      if (onDraftChangeMany && partnerIds.length > 1) {
        onDraftChangeMany(
          partnerIds.map((partnerId) => ({ partnerId, field: columnId, value })),
        );
        return;
      }
      for (const partnerId of partnerIds) {
        onDraftChange(partnerId, columnId, value);
      }
    },
    [onDraftChange, onDraftChangeMany],
  );

  const handleFieldChange = useCallback(
    (partnerId: string, columnId: ColumnId, value: string) => {
      const selection = columnSelectionRef.current;
      const selectedIds = selectedPartnerIdsRef.current;
      const targets =
        selection?.columnId === columnId && selectedIds.includes(partnerId)
          ? selectedIds
          : [partnerId];
      applyFieldValue(targets, columnId, value);
    },
    [applyFieldValue],
  );

  const handleBulkFillSelect = useCallback(
    (value: string) => {
      if (!columnSelection || selectedPartnerIds.length === 0) return;
      applyFieldValue(selectedPartnerIds, columnSelection.columnId, value);
    },
    [applyFieldValue, columnSelection, selectedPartnerIds],
  );

  useEffect(() => {
    clearColumnSelection();
  }, [districtFilter, blockFilter, searchTerm, clearColumnSelection]);

  const changeCount = countDraftChanges(draftChanges);

  const renderCell = (partner: SchoolPartner, field: PartnerBulkEditFieldDef) => {
    const value = getDraftValue(partner, field.key, draftChanges);
    const isDirty = draftChanges[partner.id] && field.key in draftChanges[partner.id];
    const selected = isCellSelected(partner.id, field.key);
    const dirtyClass = isDirty ? "border-orange-400 bg-orange-50/80 ring-1 ring-orange-200" : "border-slate-200";
    const selectedClass = selected ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50/60" : "";
    const cellDataAttrs = {
      "data-bulk-cell": field.key,
      "data-partner-id": partner.id,
    };

    if (field.type === "select") {
      const options = resolveSelectOptions(field.key, partner);
      return (
        <select
          value={value}
          {...cellDataAttrs}
          onKeyDown={(e) => handleCellKeyDown(e, partner.id, field.key)}
          onChange={(e) => handleFieldChange(partner.id, field.key, e.target.value)}
          className={`w-full px-2 py-1.5 border rounded text-xs cursor-pointer bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 ${dirtyClass} ${selectedClass}`}
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.type}
        value={value}
        {...cellDataAttrs}
        onKeyDown={(e) => handleCellKeyDown(e, partner.id, field.key)}
        onChange={(e) => handleFieldChange(partner.id, field.key, e.target.value)}
        className={`w-full px-2 py-1.5 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 ${dirtyClass} ${selectedClass}`}
      />
    );
  };

  if (readOnly) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
        Bulk edit requires edit permission on School Work.
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div className="pb-4 border-b border-slate-100 space-y-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Edit partner bank and payment details inline, then save all changes at once
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={changeCount === 0 || isApplying}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw size={14} /> Discard
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={changeCount === 0 || isApplying}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-40 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              <Save size={14} /> {isApplying ? "Saving..." : `Save ${changeCount || ""} change${changeCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search partners..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
            />
          </div>
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="">All Blocks</option>
            {blocks.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-400">
          Showing {filteredPartners.length} of {partners.length} partners
        </span>
      </div>

      {columnSelection && selectedPartnerIds.length > 0 && (
        <div className="px-4 py-2 border-b border-blue-200 bg-blue-50/70 flex flex-wrap items-center justify-between gap-3 mb-0">
          <div className="flex items-center gap-2 text-xs text-blue-900">
            <MousePointerClick size={14} />
            <span>
              <strong>{selectedPartnerIds.length}</strong> row
              {selectedPartnerIds.length !== 1 ? "s" : ""} selected
              {selectedFieldDef ? ` in ${selectedFieldDef.label}` : ""}
            </span>
          </div>
          {selectedPartnerIds.length > 1 &&
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
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
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
        change any selected cell’s dropdown
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[620px] border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse min-w-[1400px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[11px] font-bold">
              <th className="p-2 w-8 text-center sticky left-0 z-10 bg-slate-100">#</th>
              {EDITABLE_FIELDS.map((field) => (
                <th
                  key={field.key}
                  className="p-2 whitespace-nowrap min-w-[120px] cursor-pointer hover:bg-blue-100/60 transition"
                  title="Click to select entire column"
                  onClick={() => handleColumnHeaderClick(field.key)}
                >
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredPartners.length === 0 ? (
              <tr>
                <td colSpan={EDITABLE_FIELDS.length + 1} className="py-12 text-center text-slate-400">
                  <ShieldAlert className="mx-auto mb-2" size={24} />
                  No partners matched the current filters.
                </td>
              </tr>
            ) : (
              filteredPartners.map((partner, index) => {
                const rowHasChanges =
                  !!draftChanges[partner.id] && Object.keys(draftChanges[partner.id]).length > 0;

                return (
                  <tr
                    key={partner.id}
                    className={rowHasChanges ? "bg-orange-50/30" : "hover:bg-slate-50/70"}
                  >
                    <td className="p-2 text-center font-bold sticky left-0 z-10 bg-inherit border-r border-slate-100">
                      {index + 1}
                    </td>
                    {EDITABLE_FIELDS.map((field) => (
                      <td
                        key={field.key}
                        onMouseDown={(e) =>
                          handleTdMouseDown(e, partner.id, field.key, isDropdownField(field))
                        }
                        className={`p-1 ${
                          isCellSelected(partner.id, field.key) ? "bg-blue-50/40" : ""
                        }`}
                      >
                        {renderCell(partner, field)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-500 mt-2">
        {EDITABLE_FIELDS.length} editable fields · Showing {filteredPartners.length} of {partners.length} partners ·{" "}
        <span className="text-orange-700 font-medium">Orange</span> = unsaved change
      </div>
    </div>
  );
}
