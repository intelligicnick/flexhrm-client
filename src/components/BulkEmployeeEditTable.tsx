/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Save, X, RotateCcw, MapPin, Briefcase, Award, ShieldAlert, MousePointerClick } from "lucide-react";
import { Employee } from "../types";
import {
  BULK_EDIT_FIELDS,
  BOOLEAN_OPTIONS,
  SKILL_OPTIONS,
  buildMergedEmployee,
  buildReviewEntries,
  collectCustomFieldNames,
  countDraftChanges,
  getCustomFieldValue,
  resolveEmployeeRecordId,
  getEmployeeFieldValue,
  isCustomFieldDirty,
  isFieldDirty,
  BulkEditFieldDef,
  BulkEditReviewEntry,
} from "../lib/employee-bulk-edit-fields";
import { normalizeSkillCategory } from "../utils";
import { inferSalaryWageMode, type SalaryWageMode } from "../lib/salary-calc";
import {
  getEmployeeWageModeRowClassName,
  getEmployeeWageModeStickyCellClassName,
  resolveEmployeeWageModeRowVariant,
} from "../lib/employee-helpers";

interface BulkEmployeeEditTableProps {
  employees: Employee[];
  draftChanges: Record<string, Partial<Employee>>;
  availableLocations?: string[];
  availableRoles?: string[];
  onDraftChange: (employeeId: string, field: keyof Employee, value: string) => void;
  onDraftChangeMany?: (
    updates: Array<{ employeeId: string; field: keyof Employee; value: string }>,
  ) => void;
  onCustomFieldChange: (employeeId: string, fieldName: string, value: string) => void;
  onCustomFieldChangeMany?: (
    updates: Array<{ employeeId: string; fieldName: string; value: string }>,
  ) => void;
  onDiscard: () => void;
  onApply: () => Promise<void>;
  isApplying?: boolean;
}

function isDropdownField(field: BulkEditFieldDef): boolean {
  return field.type === "select" || field.type === "boolean" || !!field.dynamicOptions;
}

function isTextInputColumn(
  columnId: ColumnId,
  field: BulkEditFieldDef | undefined,
): boolean {
  if (typeof columnId === "string" && columnId.startsWith("custom:")) return true;
  if (!field) return false;
  return field.type === "text" || field.type === "number";
}

function resolveColumnFillOptions(
  field: BulkEditFieldDef | undefined,
  availableLocations: string[],
  availableRoles: string[],
  employees: Employee[],
): string[] {
  if (!field) return [];
  if (field.dynamicOptions === "location") {
    return Array.from(
      new Set([...availableLocations, ...employees.map((e) => e.location)].filter(Boolean)),
    ).sort();
  }
  if (field.dynamicOptions === "role") {
    return Array.from(
      new Set([...availableRoles, ...employees.map((e) => e.role || "")].filter(Boolean)),
    ).sort();
  }
  if (field.type === "boolean") return BOOLEAN_OPTIONS;
  return field.options || [];
}

function resolveFieldOptions(
  field: BulkEditFieldDef,
  availableLocations: string[],
  availableRoles: string[],
  emp: Employee,
): string[] {
  if (field.dynamicOptions === "location") {
    const set = new Set([...availableLocations, emp.location].filter(Boolean));
    return Array.from(set).sort();
  }
  if (field.dynamicOptions === "role") {
    const set = new Set([...availableRoles, emp.role || ""].filter(Boolean));
    return Array.from(set).sort();
  }
  if (field.type === "boolean") return BOOLEAN_OPTIONS;
  return field.options || [];
}

type ColumnId = keyof Employee | `custom:${string}`;

interface ColumnSelection {
  columnId: ColumnId;
  anchorEmployeeId: string;
  focusEmployeeId: string;
}

function selectionToEmployeeIds(
  selection: ColumnSelection,
  filteredEmployees: Employee[],
): string[] {
  const anchorIdx = filteredEmployees.findIndex(
    (e) => resolveEmployeeRecordId(e) === selection.anchorEmployeeId,
  );
  const focusIdx = filteredEmployees.findIndex(
    (e) => resolveEmployeeRecordId(e) === selection.focusEmployeeId,
  );
  if (anchorIdx === -1 || focusIdx === -1) return [];
  const start = Math.min(anchorIdx, focusIdx);
  const end = Math.max(anchorIdx, focusIdx);
  return filteredEmployees.slice(start, end + 1).map((e) => resolveEmployeeRecordId(e));
}

function ReviewChangeRow({ entry }: { entry: BulkEditReviewEntry }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 text-left cursor-pointer"
      >
        <div>
          <span className="font-semibold text-slate-800 text-xs">
            {entry.employeeName}
          </span>
          <span className="text-slate-400 text-[10px] ml-2">({entry.employeeCode})</span>
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
                  <td className="px-3 py-1.5 font-medium text-slate-700 align-top">
                    {change.label}
                  </td>
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

function formatSalaryAmount(value: number | undefined): string {
  const num = Number(value) || 0;
  return num > 0 ? num.toLocaleString("en-IN") : "0";
}

function isSalaryInputEditable(
  fieldKey: keyof Employee,
  wageMode: SalaryWageMode,
): boolean {
  if (fieldKey === "basicSalary") return true;
  if (fieldKey === "grossSalary") return wageMode === "monthly";
  if (fieldKey === "dailyWage") return wageMode === "daily";
  return false;
}

function WageModeToggle({
  emp,
  draft,
  isSelected,
  onChange,
}: {
  emp: Employee;
  draft: Partial<Employee> | undefined;
  isSelected?: boolean;
  onChange: (mode: SalaryWageMode) => void;
}) {
  const dirty = isFieldDirty(emp, draft, "salaryWageMode");
  const mode = inferSalaryWageMode(buildMergedEmployee(emp, draft));
  const isMonthly = mode === "monthly";
  const selectedClass = isSelected ? "ring-2 ring-blue-500" : "";
  const dirtyClass = dirty ? "ring-1 ring-amber-300" : "";

  return (
    <div
      className={`inline-flex rounded-md border border-slate-250 overflow-hidden bg-white ${selectedClass} ${dirtyClass}`}
      data-bulk-cell="salaryWageMode"
      data-employee-id={resolveEmployeeRecordId(emp)}
    >
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => onChange("monthly")}
        className={`px-2 py-1 text-[10px] font-bold transition cursor-pointer ${
          isMonthly ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => onChange("daily")}
        className={`px-2 py-1 text-[10px] font-bold transition border-l border-slate-250 cursor-pointer ${
          !isMonthly ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Daily
      </button>
    </div>
  );
}

function CalculatedSalaryCell({
  emp,
  field,
  draft,
  wageMode,
  isSelected,
}: {
  emp: Employee;
  field: BulkEditFieldDef;
  draft: Partial<Employee> | undefined;
  wageMode: SalaryWageMode;
  isSelected?: boolean;
}) {
  const merged = buildMergedEmployee(emp, draft);
  const value =
    field.key === "grossSalary"
      ? merged.grossSalary
      : field.key === "dailyWage"
        ? merged.dailyWage
        : merged.basicSalary;
  const dirty = isFieldDirty(emp, draft, field.key);
  const selectedClass = isSelected ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50/60" : "";

  return (
    <div
      data-bulk-cell={field.key}
      data-employee-id={resolveEmployeeRecordId(emp)}
      className={`w-full min-w-0 px-1.5 py-1 text-[11px] border rounded font-mono text-slate-700 bg-slate-100/80 border-slate-200 ${
        dirty ? "border-amber-300 bg-amber-50/50" : ""
      } ${selectedClass}`}
      title={
        field.key === "basicSalary"
          ? "Auto-calculated from monthly salary and basic %"
          : wageMode === "monthly"
            ? "Auto-calculated from monthly salary and working days"
            : "Auto-calculated from daily wage and working days"
      }
    >
      {formatSalaryAmount(value)}
    </div>
  );
}

function EditableCell({
  emp,
  field,
  draft,
  selectOptions,
  isSelected,
  onKeyNavigate,
  onChange,
}: {
  emp: Employee;
  field: BulkEditFieldDef;
  draft: Partial<Employee> | undefined;
  selectOptions: string[];
  isSelected?: boolean;
  onKeyNavigate?: (e: React.KeyboardEvent) => void;
  onChange: (value: string) => void;
}) {
  const dirty = isFieldDirty(emp, draft, field.key);
  let value = getEmployeeFieldValue(emp, field.key);
  if (draft && draft[field.key] !== undefined) {
    if (field.type === "boolean") {
      value =
        draft[field.key] === true || String(draft[field.key]) === "Yes" ? "Yes" : "No";
    } else {
      value = String(draft[field.key] ?? "");
    }
  }

  const baseClass =
    "w-full min-w-0 px-1.5 py-1 text-[11px] border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";
  const dirtyClass = dirty
    ? "border-amber-400 bg-amber-50/80 ring-1 ring-amber-200"
    : "border-slate-200";
  const selectedClass = isSelected ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50/60" : "";

  const recordId = resolveEmployeeRecordId(emp);
  const fieldName = `bulk-${recordId}-${String(field.key)}`;
  const cellInputAttrs = {
    id: fieldName,
    name: fieldName,
    "aria-label": `${field.label} (${emp.employeeCode || recordId})`,
    "data-bulk-cell": field.key,
    "data-employee-id": recordId,
  };

  if (field.type === "select" || field.type === "boolean" || field.dynamicOptions) {
    return (
      <select
        value={value}
        {...cellInputAttrs}
        onKeyDown={onKeyNavigate}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseClass} ${dirtyClass} ${selectedClass} cursor-pointer`}
      >
        <option value="">—</option>
        {selectOptions.map((opt) => (
          <option key={opt} value={opt}>
            {field.key === "pfCalculationMode"
              ? opt === "gross"
                ? "Full Gross"
                : "Ceiling ₹15,000"
              : opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      value={value}
      {...cellInputAttrs}
      onKeyDown={onKeyNavigate}
      onChange={(e) => onChange(e.target.value)}
      className={`${baseClass} ${dirtyClass} ${selectedClass}`}
    />
  );
}

export default function BulkEmployeeEditTable({
  employees,
  draftChanges,
  availableLocations = [],
  availableRoles = [],
  onDraftChange,
  onDraftChangeMany,
  onCustomFieldChange,
  onCustomFieldChangeMany,
  onDiscard,
  onApply,
  isApplying = false,
}: BulkEmployeeEditTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [columnSelection, setColumnSelection] = useState<ColumnSelection | null>(null);
  const [bulkFillText, setBulkFillText] = useState("");
  const columnSelectionRef = useRef<ColumnSelection | null>(null);
  const selectedEmployeeIdsRef = useRef<string[]>([]);

  const customFieldNames = useMemo(() => collectCustomFieldNames(employees), [employees]);

  const locations = useMemo(() => {
    const locSet = new Set([
      ...availableLocations,
      ...employees.map((e) => e.location).filter(Boolean),
    ]);
    return Array.from(locSet).sort();
  }, [employees, availableLocations]);

  const roles = useMemo(() => {
    const roleSet = new Set([
      ...availableRoles,
      ...employees.map((e) => e.role).filter(Boolean),
    ]);
    return Array.from(roleSet).sort();
  }, [employees, availableRoles]);

  const skillCategories = useMemo(() => {
    const extras = new Set<string>();
    for (const emp of employees) {
      const normalized = normalizeSkillCategory(emp.skillCategory);
      if (
        normalized &&
        !SKILL_OPTIONS.includes(normalized as (typeof SKILL_OPTIONS)[number])
      ) {
        extras.add(normalized);
      }
    }
    return [...SKILL_OPTIONS, ...Array.from(extras).sort((a, b) => a.localeCompare(b))];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let result = [...employees];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.employeeCode?.toLowerCase().includes(q) ||
          e.nameAsPerAadhar?.toLowerCase().includes(q) ||
          e.aadharNo?.includes(q),
      );
    }
    if (locationFilter) {
      result = result.filter((e) => e.location === locationFilter);
    }
    if (roleFilter) {
      result = result.filter((e) => (e.role || "") === roleFilter);
    }
    if (skillFilter) {
      if (skillFilter === "__unassigned__") {
        result = result.filter((e) => !normalizeSkillCategory(e.skillCategory));
      } else {
        result = result.filter(
          (e) =>
            normalizeSkillCategory(e.skillCategory).toLowerCase() ===
            skillFilter.toLowerCase(),
        );
      }
    }
    return result.sort((a, b) => a.srNo - b.srNo);
  }, [employees, searchTerm, locationFilter, roleFilter, skillFilter]);

  const selectedEmployeeIds = useMemo(
    () =>
      columnSelection
        ? selectionToEmployeeIds(columnSelection, filteredEmployees)
        : [],
    [columnSelection, filteredEmployees],
  );

  useEffect(() => {
    columnSelectionRef.current = columnSelection;
    selectedEmployeeIdsRef.current = selectedEmployeeIds;
  }, [columnSelection, selectedEmployeeIds]);

  const selectedFieldDef = useMemo(() => {
    if (!columnSelection || typeof columnSelection.columnId !== "string") return undefined;
    if (columnSelection.columnId.startsWith("custom:")) return undefined;
    return BULK_EDIT_FIELDS.find((f) => f.key === columnSelection.columnId);
  }, [columnSelection]);

  const selectedCustomFieldName = useMemo(() => {
    if (!columnSelection || typeof columnSelection.columnId !== "string") return undefined;
    if (!columnSelection.columnId.startsWith("custom:")) return undefined;
    return columnSelection.columnId.slice("custom:".length);
  }, [columnSelection]);

  const selectedColumnLabel = selectedFieldDef?.label ?? selectedCustomFieldName;

  const isTextBulkFillColumn = useMemo(() => {
    if (!columnSelection || selectedEmployeeIds.length <= 1) return false;
    return isTextInputColumn(columnSelection.columnId, selectedFieldDef);
  }, [columnSelection, selectedEmployeeIds.length, selectedFieldDef]);

  const selectedColumnFillOptions = useMemo(
    () =>
      resolveColumnFillOptions(
        selectedFieldDef,
        availableLocations,
        availableRoles,
        employees,
      ),
    [selectedFieldDef, availableLocations, availableRoles, employees],
  );

  const syncSelectionRefs = useCallback(
    (selection: ColumnSelection | null) => {
      columnSelectionRef.current = selection;
      selectedEmployeeIdsRef.current = selection
        ? selectionToEmployeeIds(selection, filteredEmployees)
        : [];
    },
    [filteredEmployees],
  );

  const clearColumnSelection = useCallback(() => {
    syncSelectionRefs(null);
    setColumnSelection(null);
  }, [syncSelectionRefs]);

  const activateCell = useCallback(
    (employeeId: string, columnId: ColumnId, shiftKey: boolean) => {
      const selection = columnSelectionRef.current;

      if (shiftKey && selection) {
        const clickIdx = filteredEmployees.findIndex(
          (e) => resolveEmployeeRecordId(e) === employeeId,
        );
        if (clickIdx === -1) return;

        if (selection.columnId === columnId) {
          const next = {
            ...selection,
            focusEmployeeId: employeeId,
          };
          syncSelectionRefs(next);
          setColumnSelection(next);
          return;
        }

        const anchorIdx = filteredEmployees.findIndex(
          (e) => resolveEmployeeRecordId(e) === selection.anchorEmployeeId,
        );
        const focusIdx = filteredEmployees.findIndex(
          (e) => resolveEmployeeRecordId(e) === selection.focusEmployeeId,
        );
        if (anchorIdx === -1) return;
        const start = Math.min(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        const end = Math.max(anchorIdx, focusIdx === -1 ? anchorIdx : focusIdx, clickIdx);
        const next = {
          columnId,
          anchorEmployeeId: filteredEmployees[start].id,
          focusEmployeeId: filteredEmployees[end].id,
        };
        syncSelectionRefs(next);
        setColumnSelection(next);
        return;
      }

      const next = {
        columnId,
        anchorEmployeeId: employeeId,
        focusEmployeeId: employeeId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [filteredEmployees, syncSelectionRefs],
  );

  const handleTdMouseDown = useCallback(
    (
      e: React.MouseEvent,
      employeeId: string,
      columnId: ColumnId,
      isDropdownColumn: boolean,
    ) => {
      if (e.button !== 0) return;

      const selection = columnSelectionRef.current;
      const selectedIds = selectedEmployeeIdsRef.current;
      const isAlreadySelected =
        selection?.columnId === columnId && selectedIds.includes(employeeId);

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
      activateCell(employeeId, columnId, e.shiftKey);
    },
    [activateCell],
  );

  const isCellSelected = useCallback(
    (employeeId: string, columnId: ColumnId) =>
      columnSelection?.columnId === columnId &&
      selectedEmployeeIds.includes(employeeId),
    [columnSelection, selectedEmployeeIds],
  );

  const extendSelectionByArrow = useCallback(
    (employeeId: string, columnId: ColumnId, direction: "up" | "down") => {
      const currentIdx = filteredEmployees.findIndex(
        (e) => resolveEmployeeRecordId(e) === employeeId,
      );
      if (currentIdx === -1) return;

      const nextIdx = direction === "down" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= filteredEmployees.length) return;

      const nextEmployeeId = filteredEmployees[nextIdx].id;

      if (
        columnSelection?.columnId === columnId &&
        selectedEmployeeIds.includes(employeeId)
      ) {
        const next = {
          ...columnSelection,
          focusEmployeeId: nextEmployeeId,
        };
        syncSelectionRefs(next);
        setColumnSelection(next);
        return;
      }

      const next = {
        columnId,
        anchorEmployeeId: employeeId,
        focusEmployeeId: nextEmployeeId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [columnSelection, filteredEmployees, selectedEmployeeIds, syncSelectionRefs],
  );

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, employeeId: string, columnId: ColumnId) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      const currentIdx = filteredEmployees.findIndex(
        (emp) => resolveEmployeeRecordId(emp) === employeeId,
      );
      if (currentIdx === -1) return;
      const nextIdx = e.key === "ArrowDown" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= filteredEmployees.length) return;

      const nextId = filteredEmployees[nextIdx].id;
      const focusTarget = `[data-bulk-cell="${columnId}"][data-employee-id="${nextId}"]`;

      if (e.shiftKey) {
        e.preventDefault();
        extendSelectionByArrow(
          employeeId,
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
        anchorEmployeeId: nextId,
        focusEmployeeId: nextId,
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(focusTarget)?.focus();
      });
    },
    [extendSelectionByArrow, filteredEmployees, syncSelectionRefs],
  );

  const handleColumnHeaderClick = useCallback(
    (columnId: ColumnId) => {
      const allIds = filteredEmployees.map((e) => resolveEmployeeRecordId(e));
      if (allIds.length === 0) return;
      const next = {
        columnId,
        anchorEmployeeId: allIds[0],
        focusEmployeeId: allIds[allIds.length - 1],
      };
      syncSelectionRefs(next);
      setColumnSelection(next);
    },
    [filteredEmployees, syncSelectionRefs],
  );

  const applyFieldValue = useCallback(
    (employeeIds: string[], columnId: ColumnId, value: string) => {
      if (employeeIds.length === 0) return;

      if (typeof columnId === "string" && columnId.startsWith("custom:")) {
        const fieldName = columnId.slice("custom:".length);
        if (onCustomFieldChangeMany && employeeIds.length > 1) {
          onCustomFieldChangeMany(
            employeeIds.map((empId) => ({ employeeId: empId, fieldName, value })),
          );
          return;
        }
        for (const empId of employeeIds) {
          onCustomFieldChange(empId, fieldName, value);
        }
        return;
      }

      const field = columnId as keyof Employee;
      if (onDraftChangeMany && employeeIds.length > 1) {
        onDraftChangeMany(employeeIds.map((empId) => ({ employeeId: empId, field, value })));
        return;
      }
      for (const empId of employeeIds) {
        onDraftChange(empId, field, value);
      }
    },
    [onCustomFieldChange, onCustomFieldChangeMany, onDraftChange, onDraftChangeMany],
  );

  const handleFieldChange = useCallback(
    (employeeId: string, columnId: ColumnId, value: string) => {
      const selection = columnSelectionRef.current;
      const selectedIds = selectedEmployeeIdsRef.current;
      const targets =
        selection?.columnId === columnId && selectedIds.includes(employeeId)
          ? selectedIds
          : [employeeId];
      applyFieldValue(targets, columnId, value);
    },
    [applyFieldValue],
  );

  const handleBulkFillSelect = useCallback(
    (value: string) => {
      if (!columnSelection || selectedEmployeeIds.length === 0) return;
      applyFieldValue(selectedEmployeeIds, columnSelection.columnId, value);
    },
    [applyFieldValue, columnSelection, selectedEmployeeIds],
  );

  const handleBulkFillTextApply = useCallback(() => {
    if (!columnSelection || selectedEmployeeIds.length === 0) return;
    applyFieldValue(selectedEmployeeIds, columnSelection.columnId, bulkFillText);
  }, [applyFieldValue, bulkFillText, columnSelection, selectedEmployeeIds]);

  useEffect(() => {
    setBulkFillText("");
  }, [columnSelection]);

  useEffect(() => {
    clearColumnSelection();
  }, [locationFilter, roleFilter, skillFilter, searchTerm, clearColumnSelection]);

  const { employeeCount, fieldCount } = countDraftChanges(employees, draftChanges);
  const reviewEntries = useMemo(
    () => buildReviewEntries(employees, draftChanges),
    [employees, draftChanges],
  );
  const totalColumns = BULK_EDIT_FIELDS.length + customFieldNames.length;

  const fieldGroups = useMemo(() => {
    const groups: { name: string; count: number }[] = [];
    for (const field of BULK_EDIT_FIELDS) {
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

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-amber-950 text-sm">ECR Whole-Detail Bulk Edit</h3>
          <p className="text-xs text-amber-800/80 mt-0.5">
            All ECR employee fields — corporate, salary, identity, bank, nominee, custom attributes.
            Use the wage-mode toggle per row; select multiple rows to bulk-apply monthly or daily wage.
            Review old vs new values side-by-side, then apply directly to the live registry.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {employeeCount > 0 && (
            <span className="text-xs font-bold bg-amber-200 text-amber-950 px-2.5 py-1 rounded-full">
              {employeeCount} employee(s) · {fieldCount} field(s) changed
            </span>
          )}
          <button
            onClick={onDiscard}
            disabled={isApplying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Discard All
          </button>
          <button
            onClick={openReviewDialog}
            disabled={employeeCount === 0 || isApplying}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            Review Changes
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            id="bulk-edit-search"
            name="bulk-edit-search"
            type="text"
            aria-label="Search employees by code, name, or aadhar"
            placeholder="Search by code, name, or aadhar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
          <MapPin size={16} className="text-slate-400 mr-1" />
          <select
            id="bulk-edit-location-filter"
            name="bulk-edit-location-filter"
            aria-label="Filter by location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="py-2 pr-3 bg-transparent border-0 text-xs focus:outline-none cursor-pointer"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
          <Briefcase size={16} className="text-slate-400 mr-1" />
          <select
            id="bulk-edit-role-filter"
            name="bulk-edit-role-filter"
            aria-label="Filter by job role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="py-2 pr-3 bg-transparent border-0 text-xs focus:outline-none cursor-pointer"
          >
            <option value="">All Job Roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
          <Award size={16} className="text-slate-400 mr-1" />
          <select
            id="bulk-edit-skill-filter"
            name="bulk-edit-skill-filter"
            aria-label="Filter by skill category"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="py-2 pr-3 bg-transparent border-0 text-xs focus:outline-none cursor-pointer"
          >
            <option value="">All Skill Categories</option>
            <option value="__unassigned__">Unassigned</option>
            {skillCategories.map((skill) => (
              <option key={skill} value={skill}>
                {skill}
              </option>
            ))}
          </select>
        </div>
      </div>

      {columnSelection && selectedEmployeeIds.length > 0 && (
        <div className="px-4 py-2 border-b border-blue-200 bg-blue-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-blue-900">
            <MousePointerClick size={14} />
            <span>
              <strong>{selectedEmployeeIds.length}</strong> row
              {selectedEmployeeIds.length !== 1 ? "s" : ""} selected
              {selectedColumnLabel ? ` in ${selectedColumnLabel}` : ""}
            </span>
          </div>
          {selectedEmployeeIds.length > 1 && columnSelection?.columnId === "salaryWageMode" && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-blue-900 whitespace-nowrap">
                Fill all selected:
              </label>
              <button
                type="button"
                onClick={() => handleBulkFillSelect("monthly")}
                className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 cursor-pointer"
              >
                Monthly Wage
              </button>
              <button
                type="button"
                onClick={() => handleBulkFillSelect("daily")}
                className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg px-3 py-1.5 cursor-pointer"
              >
                Daily Wage
              </button>
            </div>
          )}
          {selectedEmployeeIds.length > 1 && selectedFieldDef && isDropdownField(selectedFieldDef) && (
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
                {selectedColumnFillOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {selectedFieldDef.key === "pfCalculationMode"
                      ? opt === "gross"
                        ? "Full Gross"
                        : "Ceiling ₹15,000"
                      : opt}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isTextBulkFillColumn && (
            <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-xl">
              <label
                htmlFor="bulk-fill-text-input"
                className="text-[11px] font-semibold text-blue-900 whitespace-nowrap"
              >
                Fill all selected:
              </label>
              <input
                id="bulk-fill-text-input"
                name="bulk-fill-text-input"
                type={selectedFieldDef?.type === "number" ? "number" : "text"}
                value={bulkFillText}
                onChange={(e) => setBulkFillText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleBulkFillTextApply();
                  }
                }}
                placeholder={`Type ${selectedColumnLabel ?? "value"}…`}
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

      <div className="px-4 py-1.5 border-b border-slate-100 bg-white text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>
          Select rows: click a cell · <strong>Shift+click</strong> to extend · <strong>Shift+↑/↓</strong> with
          keyboard · column header = select all · for dropdown columns, use <strong>Fill all selected</strong> or
          change any selected cell’s dropdown · for text/number columns, type once in <strong>Fill all selected</strong> and press Apply
        </span>
        <div className="flex flex-wrap items-center gap-3 font-medium shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-200" aria-hidden />
            Monthly wage
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-sky-100 border border-sky-200" aria-hidden />
            Daily wage
          </span>
        </div>
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
              {customFieldNames.length > 0 && (
                <th
                  colSpan={customFieldNames.length}
                  className="p-1 text-center border-r border-slate-300 bg-violet-100 text-violet-800"
                >
                  Custom Fields
                </th>
              )}
            </tr>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[10px] font-semibold uppercase tracking-wide">
              <th className="sticky left-0 z-20 bg-slate-100 p-2 w-12 text-center border-r border-slate-200">
                SR
              </th>
              {BULK_EDIT_FIELDS.map((field) => (
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
              {customFieldNames.map((name) => {
                const columnId: ColumnId = `custom:${name}`;
                return (
                <th
                  key={`custom-${name}`}
                  className="p-2 border-r border-violet-200 whitespace-nowrap bg-violet-50/50 text-violet-900 cursor-pointer hover:bg-violet-100 transition"
                  style={{ minWidth: "120px" }}
                  title="Click to select entire column"
                  onClick={() => handleColumnHeaderClick(columnId)}
                >
                  {name}
                </th>
              );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={totalColumns + 1} className="py-12 text-center text-slate-400">
                  <ShieldAlert className="mx-auto mb-2 opacity-50" size={24} />
                  No employees match your filters.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const recordId = resolveEmployeeRecordId(emp);
                const draft = draftChanges[recordId];
                const rowHasChanges = !!draft && Object.keys(draft).length > 0;
                const merged = buildMergedEmployee(emp, draft);
                const wageMode = inferSalaryWageMode(merged);
                const wageModeVariant = resolveEmployeeWageModeRowVariant(merged);
                const rowClassName = getEmployeeWageModeRowClassName(wageModeVariant, {
                  hasDraftChanges: rowHasChanges,
                });
                const stickyCellClassName = getEmployeeWageModeStickyCellClassName(wageModeVariant, {
                  hasDraftChanges: rowHasChanges,
                });

                return (
                  <tr
                    key={recordId}
                    className={rowClassName}
                  >
                    <td className={`sticky left-0 z-[15] ${stickyCellClassName} p-2 text-center font-bold text-slate-500 border-r border-slate-200`}>
                      {emp.srNo}
                    </td>
                    {BULK_EDIT_FIELDS.map((field) => (
                      <td
                        key={field.key}
                        onMouseDown={(e) =>
                          handleTdMouseDown(
                            e,
                            recordId,
                            field.key,
                            field.key === "salaryWageMode" || isDropdownField(field),
                          )
                        }
                        className={`p-1 border-r border-slate-100 ${
                          isCellSelected(recordId, field.key) ? "bg-blue-50/40" : ""
                        }`}
                        style={{ minWidth: field.minWidth }}
                      >
                        {field.key === "salaryWageMode" ? (
                          <WageModeToggle
                            emp={emp}
                            draft={draft}
                            isSelected={isCellSelected(recordId, field.key)}
                            onChange={(mode) => handleFieldChange(recordId, "salaryWageMode", mode)}
                          />
                        ) : (field.key === "grossSalary" ||
                            field.key === "dailyWage" ||
                            field.key === "basicSalary") &&
                          !isSalaryInputEditable(field.key, wageMode) ? (
                          <CalculatedSalaryCell
                            emp={emp}
                            field={field}
                            draft={draft}
                            wageMode={wageMode}
                            isSelected={isCellSelected(recordId, field.key)}
                          />
                        ) : (
                          <EditableCell
                            emp={emp}
                            field={field}
                            draft={draft}
                            selectOptions={resolveFieldOptions(
                              field,
                              availableLocations,
                              availableRoles,
                              emp,
                            )}
                            isSelected={isCellSelected(recordId, field.key)}
                            onKeyNavigate={(e) => handleCellKeyDown(e, recordId, field.key)}
                            onChange={(val) => handleFieldChange(recordId, field.key, val)}
                          />
                        )}
                      </td>
                    ))}
                    {customFieldNames.map((name) => {
                      const columnId: ColumnId = `custom:${name}`;
                      const dirty = isCustomFieldDirty(emp, draft, name);
                      const value = getCustomFieldValue(emp, draft, name);
                      const selected = isCellSelected(recordId, columnId);
                      const fieldInputId = `bulk-${recordId}-custom-${name}`;
                      return (
                        <td
                          key={`${recordId}-${name}`}
                          onMouseDown={(e) => handleTdMouseDown(e, recordId, columnId, false)}
                          className={`p-1 border-r border-violet-100 ${selected ? "bg-blue-50/40" : ""}`}
                        >
                          <input
                            id={fieldInputId}
                            name={fieldInputId}
                            type="text"
                            aria-label={`${name} (${emp.employeeCode || recordId})`}
                            value={value}
                            data-bulk-cell={columnId}
                            data-employee-id={recordId}
                            onKeyDown={(e) => handleCellKeyDown(e, recordId, columnId)}
                            onChange={(e) => handleFieldChange(recordId, columnId, e.target.value)}
                            className={`w-full min-w-0 px-1.5 py-1 text-[11px] border rounded bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 ${
                              dirty
                                ? "border-amber-400 bg-amber-50/80"
                                : "border-violet-200"
                            } ${selected ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50/60" : ""}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
        {BULK_EDIT_FIELDS.length} standard fields
        {customFieldNames.length > 0 && ` + ${customFieldNames.length} custom field(s)`} ·
        Showing {filteredEmployees.length} of {employees.length} employees ·{" "}
        <span className="text-amber-700 font-medium">Amber</span> = unsaved change
      </div>

      {showReviewDialog &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isApplying) {
                setShowReviewDialog(false);
              }
            }}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col cursor-default">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900">Review Changes</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {employeeCount} employee(s) · {fieldCount} field change(s) — compare old and new values before applying
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewDialog(false)}
                  disabled={isApplying}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {reviewEntries.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <p>No field differences were detected. Adjust values in the grid, then open review again.</p>
                  </div>
                ) : (
                  reviewEntries.map((entry) => (
                    <ReviewChangeRow key={entry.employeeId} entry={entry} />
                  ))
                )}
              </div>
              {applyError && (
                <div className="mx-6 mb-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  <p>{applyError}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowReviewDialog(false)}
                  disabled={isApplying}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Back to Edit
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isApplying || reviewEntries.length === 0}
                  className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isApplying ? "Applying..." : "Apply Changes"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
