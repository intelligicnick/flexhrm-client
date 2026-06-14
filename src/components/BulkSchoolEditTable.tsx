import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Save, Search, ShieldAlert, MousePointerClick } from "lucide-react";
import { SchoolBlock, SchoolDistrict, SchoolWork, SCHOOL_CATEGORIES } from "../types";

type SchoolBulkEditFieldDef = {
  key: keyof SchoolWork;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
};

const EDITABLE_FIELDS: SchoolBulkEditFieldDef[] = [
  { key: "schoolName", label: "School Name", type: "text" },
  { key: "udise", label: "UDISE", type: "text" },
  { key: "schoolCategory", label: "Category", type: "select", options: SCHOOL_CATEGORIES },
  { key: "headmasterName", label: "Headmaster", type: "text" },
  { key: "headmasterNumber", label: "HM Phone", type: "text" },
  { key: "sweeperName", label: "Partner", type: "text" },
  { key: "block", label: "Block", type: "select" },
  { key: "district", label: "District", type: "select" },
  { key: "noOfToilets", label: "Toilets", type: "number" },
  { key: "govtUnitRate", label: "Govt Rate", type: "number" },
  { key: "remarks", label: "Remarks", type: "text" },
];

type ColumnId = keyof SchoolWork;

interface ColumnSelection {
  columnId: ColumnId;
  anchorSchoolId: string;
  focusSchoolId: string;
}

interface BulkSchoolEditTableProps {
  schools: SchoolWork[];
  districts: SchoolDistrict[];
  blocks: SchoolBlock[];
  draftChanges: Record<string, Partial<SchoolWork>>;
  onDraftChange: (schoolId: string, field: keyof SchoolWork, value: string) => void;
  onDraftChangeMany?: (
    updates: Array<{ schoolId: string; field: keyof SchoolWork; value: string }>,
  ) => void;
  onDiscard: () => void;
  onApply: () => Promise<void>;
  isApplying?: boolean;
  readOnly?: boolean;
  embedded?: boolean;
}

function getDraftValue(
  school: SchoolWork,
  field: keyof SchoolWork,
  drafts: Record<string, Partial<SchoolWork>>,
): string {
  const draft = drafts[school.id];
  if (draft && field in draft) return String(draft[field] ?? "");
  return String(school[field] ?? "");
}

function countDraftChanges(drafts: Record<string, Partial<SchoolWork>>): number {
  return Object.values(drafts).reduce((sum, changes) => sum + Object.keys(changes).length, 0);
}

function isDropdownField(field: SchoolBulkEditFieldDef): boolean {
  return field.type === "select";
}

function selectionToSchoolIds(
  selection: ColumnSelection,
  filteredSchools: SchoolWork[],
): string[] {
  const anchorIdx = filteredSchools.findIndex((s) => s.id === selection.anchorSchoolId);
  const focusIdx = filteredSchools.findIndex((s) => s.id === selection.focusSchoolId);
  if (anchorIdx === -1 || focusIdx === -1) return [];
  const start = Math.min(anchorIdx, focusIdx);
  const end = Math.max(anchorIdx, focusIdx);
  return filteredSchools.slice(start, end + 1).map((s) => s.id);
}

function getFieldDef(columnId: ColumnId): SchoolBulkEditFieldDef | undefined {
  return EDITABLE_FIELDS.find((f) => f.key === columnId);
}

export default function BulkSchoolEditTable({
  schools,
  districts,
  blocks,
  draftChanges,
  onDraftChange,
  onDraftChangeMany,
  onDiscard,
  onApply,
  isApplying = false,
  readOnly = false,
  embedded = false,
}: BulkSchoolEditTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [columnSelection, setColumnSelection] = useState<ColumnSelection | null>(null);
  const columnSelectionRef = useRef<ColumnSelection | null>(null);
  const selectedSchoolIdsRef = useRef<string[]>([]);

  const districtNames = useMemo(
    () => districts.map((d) => d.name).sort(),
    [districts],
  );

  const blockNames = useMemo(() => {
    if (districtFilter) {
      const district = districts.find((d) => d.name === districtFilter);
      if (district) {
        return blocks.filter((b) => b.districtId === district.id).map((b) => b.name).sort();
      }
    }
    return Array.from(new Set(blocks.map((b) => b.name))).sort();
  }, [blocks, districts, districtFilter]);

  const filteredSchools = useMemo(() => {
    let result = [...schools];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) =>
          s.schoolName?.toLowerCase().includes(q) ||
          s.udise?.toLowerCase().includes(q) ||
          s.sweeperName?.toLowerCase().includes(q),
      );
    }
    if (districtFilter) result = result.filter((s) => s.district === districtFilter);
    if (blockFilter) result = result.filter((s) => s.block === blockFilter);
    if (categoryFilter) result = result.filter((s) => s.schoolCategory === categoryFilter);
    return result.sort((a, b) => a.srNo - b.srNo);
  }, [schools, searchTerm, districtFilter, blockFilter, categoryFilter]);

  const selectedSchoolIds = useMemo(
    () =>
      columnSelection ? selectionToSchoolIds(columnSelection, filteredSchools) : [],
    [columnSelection, filteredSchools],
  );

  useEffect(() => {
    columnSelectionRef.current = columnSelection;
    selectedSchoolIdsRef.current = selectedSchoolIds;
  }, [columnSelection, selectedSchoolIds]);

  const selectedFieldDef = useMemo(
    () => (columnSelection ? getFieldDef(columnSelection.columnId) : undefined),
    [columnSelection],
  );

  const resolveSelectOptions = useCallback(
    (field: keyof SchoolWork, school: SchoolWork): string[] => {
      if (field === "district") {
        const set = new Set([...districtNames, school.district].filter(Boolean));
        return Array.from(set).sort();
      }
      if (field === "block") {
        const districtName = getDraftValue(school, "district", draftChanges) || school.district;
        const district = districts.find((d) => d.name === districtName);
        const configured = district
          ? blocks.filter((b) => b.districtId === district.id).map((b) => b.name)
          : blocks.map((b) => b.name);
        const set = new Set([...configured, school.block].filter(Boolean));
        return Array.from(set).sort();
      }
      const def = EDITABLE_FIELDS.find((f) => f.key === field);
      return def?.options || [];
    },
    [blocks, districtNames, districts, draftChanges],
  );

  const resolveColumnFillOptions = useCallback(
    (columnId: ColumnId): string[] => {
      const sampleSchool = filteredSchools[0];
      if (!sampleSchool) return [];
      return resolveSelectOptions(columnId, sampleSchool);
    },
    [filteredSchools, resolveSelectOptions],
  );

  const syncSelectionRefs = useCallback(
    (selection: ColumnSelection | null) => {
      columnSelectionRef.current = selection;
      selectedSchoolIdsRef.current = selection
        ? selectionToSchoolIds(selection, filteredSchools)
        : [];
    },
    [filteredSchools],
  );

  const clearColumnSelection = useCallback(() => {
    syncSelectionRefs(null);
    setColumnSelection(null);
  }, [syncSelectionRefs]);

  const activateCell = useCallback(
    (schoolId: string, columnId: ColumnId, shiftKey: boolean) => {
      const selection = columnSelectionRef.current;

      if (shiftKey && selection) {
        const clickIdx = filteredSchools.findIndex((s) => s.id === schoolId);
        if (clickIdx === -1) return;

        if (selection.columnId === columnId) {
          const next = { ...selection, focusSchoolId: schoolId };
          syncSelectionRefs(next);
          setColumnSelection(next);
          return;
        }

        const anchorIdx = filteredSchools.findIndex((s) => s.id === selection.anchorSchoolId);
        const focusIdx = filteredSchools.findIndex((s) => s.id === selection.focusSchoolId);
        if (anchorIdx === -1) return;
        const start = Math.min(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        const end = Math.max(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        const next = {
          columnId,
          anchorSchoolId: filteredSchools[start].id,
          focusSchoolId: filteredSchools[end].id,
        };
        syncSelectionRefs(next);
        setColumnSelection(next);
        return;
      }

      const next = {
        columnId,
        anchorSchoolId: schoolId,
        focusSchoolId: schoolId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [filteredSchools, syncSelectionRefs],
  );

  const handleTdMouseDown = useCallback(
    (
      e: React.MouseEvent,
      schoolId: string,
      columnId: ColumnId,
      isDropdownColumn: boolean,
    ) => {
      if (e.button !== 0) return;

      const selection = columnSelectionRef.current;
      const selectedIds = selectedSchoolIdsRef.current;
      const isAlreadySelected =
        selection?.columnId === columnId && selectedIds.includes(schoolId);

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
      activateCell(schoolId, columnId, e.shiftKey);
    },
    [activateCell],
  );

  const isCellSelected = useCallback(
    (schoolId: string, columnId: ColumnId) =>
      columnSelection?.columnId === columnId && selectedSchoolIds.includes(schoolId),
    [columnSelection, selectedSchoolIds],
  );

  const extendSelectionByArrow = useCallback(
    (schoolId: string, columnId: ColumnId, direction: "up" | "down") => {
      const currentIdx = filteredSchools.findIndex((s) => s.id === schoolId);
      if (currentIdx === -1) return;

      const nextIdx = direction === "down" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= filteredSchools.length) return;

      const nextSchoolId = filteredSchools[nextIdx].id;

      if (columnSelection?.columnId === columnId && selectedSchoolIds.includes(schoolId)) {
        const next = { ...columnSelection, focusSchoolId: nextSchoolId };
        syncSelectionRefs(next);
        setColumnSelection(next);
        return;
      }

      const next = {
        columnId,
        anchorSchoolId: schoolId,
        focusSchoolId: nextSchoolId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [columnSelection, filteredSchools, selectedSchoolIds, syncSelectionRefs],
  );

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, schoolId: string, columnId: ColumnId) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      const currentIdx = filteredSchools.findIndex((s) => s.id === schoolId);
      if (currentIdx === -1) return;
      const nextIdx = e.key === "ArrowDown" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= filteredSchools.length) return;

      const nextId = filteredSchools[nextIdx].id;
      const focusTarget = `[data-bulk-cell="${columnId}"][data-school-id="${nextId}"]`;

      if (e.shiftKey) {
        e.preventDefault();
        extendSelectionByArrow(
          schoolId,
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
        anchorSchoolId: nextId,
        focusSchoolId: nextId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(focusTarget)?.focus();
      });
    },
    [extendSelectionByArrow, filteredSchools, syncSelectionRefs],
  );

  const handleColumnHeaderClick = useCallback(
    (columnId: ColumnId) => {
      const allIds = filteredSchools.map((s) => s.id);
      if (allIds.length === 0) return;
      const next = {
        columnId,
        anchorSchoolId: allIds[0],
        focusSchoolId: allIds[allIds.length - 1],
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [filteredSchools, syncSelectionRefs],
  );

  const applyFieldValue = useCallback(
    (schoolIds: string[], columnId: ColumnId, value: string) => {
      if (schoolIds.length === 0) return;

      if (onDraftChangeMany && schoolIds.length > 1) {
        onDraftChangeMany(
          schoolIds.map((schoolId) => ({ schoolId, field: columnId, value })),
        );
        return;
      }
      for (const schoolId of schoolIds) {
        onDraftChange(schoolId, columnId, value);
      }
    },
    [onDraftChange, onDraftChangeMany],
  );

  const handleFieldChange = useCallback(
    (schoolId: string, columnId: ColumnId, value: string) => {
      const selection = columnSelectionRef.current;
      const selectedIds = selectedSchoolIdsRef.current;
      const targets =
        selection?.columnId === columnId && selectedIds.includes(schoolId)
          ? selectedIds
          : [schoolId];
      applyFieldValue(targets, columnId, value);
    },
    [applyFieldValue],
  );

  const handleBulkFillSelect = useCallback(
    (value: string) => {
      if (!columnSelection || selectedSchoolIds.length === 0) return;
      applyFieldValue(selectedSchoolIds, columnSelection.columnId, value);
    },
    [applyFieldValue, columnSelection, selectedSchoolIds],
  );

  useEffect(() => {
    clearColumnSelection();
  }, [districtFilter, blockFilter, categoryFilter, searchTerm, clearColumnSelection]);

  const changeCount = countDraftChanges(draftChanges);
  const totalColumns = EDITABLE_FIELDS.length;

  const renderCell = (
    school: SchoolWork,
    field: SchoolBulkEditFieldDef,
  ) => {
    const value = getDraftValue(school, field.key, draftChanges);
    const isDirty = draftChanges[school.id] && field.key in draftChanges[school.id];
    const selected = isCellSelected(school.id, field.key);
    const dirtyClass = isDirty ? "border-orange-400 bg-orange-50/80 ring-1 ring-orange-200" : "border-slate-200";
    const selectedClass = selected ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50/60" : "";
    const cellDataAttrs = {
      "data-bulk-cell": field.key,
      "data-school-id": school.id,
    };

    if (field.type === "select") {
      const options = resolveSelectOptions(field.key, school);
      return (
        <select
          value={value}
          {...cellDataAttrs}
          onKeyDown={(e) => handleCellKeyDown(e, school.id, field.key)}
          onChange={(e) => handleFieldChange(school.id, field.key, e.target.value)}
          className={`w-full px-2 py-1.5 border rounded text-xs cursor-pointer bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 ${dirtyClass} ${selectedClass}`}
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.type}
        value={value}
        {...cellDataAttrs}
        onKeyDown={(e) => handleCellKeyDown(e, school.id, field.key)}
        onChange={(e) => handleFieldChange(school.id, field.key, e.target.value)}
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
    <div className={embedded ? "overflow-hidden" : "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"}>
      <div className={`${embedded ? "pb-4 border-b border-slate-100 space-y-4 mb-4" : "p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white space-y-4"}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {!embedded && (
            <div>
              <h2 className="font-extrabold text-slate-900 text-base">Bulk Edit Schools</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Edit multiple school records inline, then save all changes at once
              </p>
            </div>
          )}
          {embedded && (
            <p className="text-xs text-slate-400">
              Edit multiple school records inline, then save all changes at once
            </p>
          )}
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
              placeholder="Search schools..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
            />
          </div>
          <select
            value={districtFilter}
            onChange={(e) => {
              setDistrictFilter(e.target.value);
              setBlockFilter("");
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="">All Districts</option>
            {districtNames.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="">All Blocks</option>
            {blockNames.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <option value="">All Categories</option>
            {SCHOOL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400">
            Showing {filteredSchools.length} of {schools.length} schools
          </span>
        </div>
      </div>

      {columnSelection && selectedSchoolIds.length > 0 && (
        <div className="px-4 py-2 border-b border-blue-200 bg-blue-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-blue-900">
            <MousePointerClick size={14} />
            <span>
              <strong>{selectedSchoolIds.length}</strong> row
              {selectedSchoolIds.length !== 1 ? "s" : ""} selected
              {selectedFieldDef ? ` in ${selectedFieldDef.label}` : ""}
            </span>
          </div>
          {selectedSchoolIds.length > 1 &&
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
                      {opt}
                    </option>
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

      <div className={`overflow-x-auto overflow-y-auto max-h-[620px]${embedded ? " border border-slate-200 rounded-lg" : ""}`}>
        <table className="w-full text-left border-collapse min-w-[1800px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[11px] font-bold">
              <th className="p-2 w-14 text-center sticky left-0 z-10 bg-slate-100">SR NO</th>
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
            {filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={totalColumns + 1} className="py-12 text-center text-slate-400">
                  <ShieldAlert className="mx-auto mb-2" size={24} />
                  No schools matched the current filters.
                </td>
              </tr>
            ) : (
              filteredSchools.map((school) => {
                const rowHasChanges =
                  !!draftChanges[school.id] && Object.keys(draftChanges[school.id]).length > 0;

                return (
                  <tr
                    key={school.id}
                    className={rowHasChanges ? "bg-orange-50/30" : "hover:bg-slate-50/70"}
                  >
                    <td className="p-2 text-center font-bold sticky left-0 z-10 bg-inherit border-r border-slate-100">
                      {school.srNo}
                    </td>
                    {EDITABLE_FIELDS.map((field) => (
                      <td
                        key={field.key}
                        onMouseDown={(e) =>
                          handleTdMouseDown(e, school.id, field.key, isDropdownField(field))
                        }
                        className={`p-1 ${
                          isCellSelected(school.id, field.key) ? "bg-blue-50/40" : ""
                        }`}
                      >
                        {renderCell(school, field)}
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
        {EDITABLE_FIELDS.length} editable fields · Showing {filteredSchools.length} of {schools.length} schools ·{" "}
        <span className="text-orange-700 font-medium">Orange</span> = unsaved change
      </div>
    </div>
  );
}
