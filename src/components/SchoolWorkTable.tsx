import React, { useMemo, useState } from "react";
import {
  Search,
  ShieldAlert,
  Edit,
  Trash2,
  DownloadCloud,
  FileSpreadsheet,
  Eye,
  MapPin,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  Building2,
  Tag,
  Users,
  School,
} from "lucide-react";
import { getSupervisorsForBlock, supervisorCoversBlock } from "../lib/school-work-helpers";
import { SchoolBlock, SchoolDistrict, SchoolSupervisor, SchoolWork, SCHOOL_CATEGORIES } from "../types";
import BulkSchoolEditTable from "./BulkSchoolEditTable";
import SchoolWorkViewModal from "./SchoolWorkViewModal";

interface SchoolWorkTableProps {
  schools: SchoolWork[];
  districts?: SchoolDistrict[];
  blocks?: SchoolBlock[];
  supervisors?: SchoolSupervisor[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEditClick: (school: SchoolWork) => void;
  onDeleteClick: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onExportSelected: (type: "csv" | "excel", ids: string[]) => void;
  readOnly?: boolean;
  bulkEditMode?: boolean;
  draftChanges?: Record<string, Partial<SchoolWork>>;
  onDraftChange?: (schoolId: string, field: keyof SchoolWork, value: string) => void;
  onDraftChangeMany?: (
    updates: Array<{ schoolId: string; field: keyof SchoolWork; value: string }>,
  ) => void;
  onDiscardBulkEdit?: () => void;
  onApplyBulkEdit?: () => Promise<void>;
  isApplyingBulkEdit?: boolean;
}

const COLUMNS: { key: keyof SchoolWork; label: string }[] = [
  { key: "schoolName", label: "School Name" },
  { key: "udise", label: "UDISE" },
  { key: "schoolCategory", label: "Category" },
  { key: "headmasterName", label: "Headmaster Name" },
  { key: "headmasterNumber", label: "Headmaster Number" },
  { key: "sweeperName", label: "Cleaning Partner" },
  { key: "noOfToilets", label: "No of Toilets" },
  { key: "block", label: "Block" },
  { key: "district", label: "District" },
  { key: "remarks", label: "Remarks" },
];

const FILTER_SELECT_CLASS =
  "py-2 pr-6 pl-1 bg-transparent border-0 text-xs font-semibold text-slate-700 focus:ring-0 focus:outline-none cursor-pointer max-w-[140px] truncate";

function renderSchoolWorkCell(school: SchoolWork, key: keyof SchoolWork): React.ReactNode {
  const value = school[key];
  if (key === "schoolCategory" && typeof value === "string" && value) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100 text-[10px] font-bold">
        {value}
      </span>
    );
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return "";
}

export default function SchoolWorkTable({
  schools,
  districts = [],
  blocks = [],
  supervisors = [],
  selectedIds,
  onSelectionChange,
  onEditClick,
  onDeleteClick,
  onBulkDelete,
  onExportSelected,
  readOnly = false,
  bulkEditMode = false,
  draftChanges = {},
  onDraftChange,
  onDraftChangeMany,
  onDiscardBulkEdit,
  onApplyBulkEdit,
  isApplyingBulkEdit = false,
}: SchoolWorkTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [supervisorFilter, setSupervisorFilter] = useState("");
  const [viewSchool, setViewSchool] = useState<SchoolWork | null>(null);
  const [sortField, setSortField] = useState<keyof SchoolWork>("srNo");
  const [sortAsc, setSortAsc] = useState(true);

  const districtOptions = useMemo(() => {
    const configured = districts.map((d) => d.name);
    const fromSchools = schools.map((s) => s.district).filter(Boolean);
    return Array.from(new Set([...configured, ...fromSchools])).sort();
  }, [districts, schools]);

  const blockOptions = useMemo(() => {
    let source = blocks;
    if (districtFilter) {
      const district = districts.find((d) => d.name === districtFilter);
      if (district) source = blocks.filter((b) => b.districtId === district.id);
    }
    const configured = source.map((b) => b.name);
    const fromSchools = schools
      .filter((s) => !districtFilter || s.district === districtFilter)
      .map((s) => s.block)
      .filter(Boolean);
    return Array.from(new Set([...configured, ...fromSchools])).sort();
  }, [blocks, districts, districtFilter, schools]);

  const activeFilterCount = [districtFilter, blockFilter, categoryFilter, supervisorFilter].filter(Boolean).length;

  const filteredSchools = useMemo(() => {
    let result = [...schools];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.schoolName?.toLowerCase().includes(q) ||
          s.udise?.toLowerCase().includes(q) ||
          s.headmasterName?.toLowerCase().includes(q) ||
          s.sweeperName?.toLowerCase().includes(q) ||
          s.block?.toLowerCase().includes(q) ||
          s.district?.toLowerCase().includes(q),
      );
    }
    if (districtFilter) result = result.filter((s) => s.district === districtFilter);
    if (blockFilter) result = result.filter((s) => s.block === blockFilter);
    if (categoryFilter) result = result.filter((s) => s.schoolCategory === categoryFilter);
    if (supervisorFilter) {
      if (supervisorFilter === "__none__") {
        result = result.filter((s) => getSupervisorsForBlock(supervisors, s.block || "").length === 0);
      } else {
        const supervisor = supervisors.find((s) => s.id === supervisorFilter);
        if (supervisor) {
          result = result.filter((s) => supervisorCoversBlock(supervisor, s.block || ""));
        }
      }
    }

    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();
      return sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
    return result;
  }, [schools, searchTerm, districtFilter, blockFilter, categoryFilter, supervisorFilter, supervisors, sortField, sortAsc]);

  const clearFilters = () => {
    setSearchTerm("");
    setDistrictFilter("");
    setBlockFilter("");
    setCategoryFilter("");
    setSupervisorFilter("");
  };

  const isAllSelected =
    filteredSchools.length > 0 && filteredSchools.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const filteredIds = filteredSchools.map((s) => s.id);
      onSelectionChange(selectedIds.filter((id) => !filteredIds.includes(id)));
    } else {
      onSelectionChange(Array.from(new Set([...selectedIds, ...filteredSchools.map((s) => s.id)])));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSort = (field: keyof SchoolWork) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ field }: { field: keyof SchoolWork }) => {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp size={12} className="inline ml-0.5 text-orange-600" />
    ) : (
      <ChevronDown size={12} className="inline ml-0.5 text-orange-600" />
    );
  };

  const stickyCellBg = (selected: boolean) => (selected ? "bg-orange-50/80" : "bg-white");

  if (bulkEditMode && onDraftChange && onDiscardBulkEdit && onApplyBulkEdit) {
    return (
      <BulkSchoolEditTable
        schools={schools}
        districts={districts}
        blocks={blocks}
        draftChanges={draftChanges}
        onDraftChange={onDraftChange}
        onDraftChangeMany={onDraftChangeMany}
        onDiscard={onDiscardBulkEdit}
        onApply={onApplyBulkEdit}
        isApplying={isApplyingBulkEdit}
        readOnly={readOnly}
        embedded
      />
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="school-work-table">
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search school, UDISE, headmaster, partner, block, district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 rounded-lg text-sm text-slate-700 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 text-slate-600 hover:border-slate-300 transition">
              <MapPin size={15} className="text-slate-400 mr-1 shrink-0" />
              <select
                value={districtFilter}
                onChange={(e) => {
                  setDistrictFilter(e.target.value);
                  setBlockFilter("");
                }}
                className={FILTER_SELECT_CLASS}
              >
                <option value="">All Districts</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 text-slate-600 hover:border-slate-300 transition">
              <Building2 size={15} className="text-slate-400 mr-1 shrink-0" />
              <select
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="">All Blocks</option>
                {blockOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 text-slate-600 hover:border-slate-300 transition">
              <Tag size={15} className="text-slate-400 mr-1 shrink-0" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="">All Categories</option>
                {SCHOOL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 text-slate-600 hover:border-slate-300 transition">
              <Users size={15} className="text-slate-400 mr-1 shrink-0" />
              <select
                value={supervisorFilter}
                onChange={(e) => setSupervisorFilter(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="">All Supervisors</option>
                <option value="__none__">No supervisor for block</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {(activeFilterCount > 0 || searchTerm) && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-3 py-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 cursor-pointer transition"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
            <School size={14} className="text-[#ff791a]" />
            Showing{" "}
            <span className="font-bold text-slate-800">{filteredSchools.length}</span> of{" "}
            <span className="font-bold text-slate-800">{schools.length}</span> schools
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-full text-[10px] font-bold">
                <Filter size={10} />
                {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
              </span>
            )}
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-700">
          <span className="inline-flex items-center gap-2">
            <span className="px-2.5 py-1 bg-[#ff791a] text-white font-black text-xs rounded-full">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold text-slate-300">schools selected</span>
          </span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onExportSelected("csv", selectedIds)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition"
            >
              <DownloadCloud size={14} /> CSV
            </button>
            <button
              onClick={() => onExportSelected("excel", selectedIds)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            {!readOnly && (
              <button
                onClick={() => onBulkDelete(selectedIds)}
                className="flex items-center gap-1.5 bg-rose-600/90 hover:bg-rose-600 border border-rose-500/50 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition"
              >
                <Trash2 size={14} /> Delete ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-auto max-h-[580px] w-full">
        <table className="w-full text-left border-collapse min-w-[1700px]" id="schools-grid-table">
          <thead className="sticky top-0 z-30">
            <tr className="bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wide">
              <th className="sticky left-0 z-40 bg-slate-100 p-3 w-[48px] text-center border-r border-slate-200">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-orange-600 cursor-pointer w-4 h-4"
                />
              </th>
              <th
                onClick={() => handleSort("srNo")}
                className="sticky left-[48px] z-40 bg-slate-100 p-3 w-[60px] text-center cursor-pointer hover:bg-slate-200/70 transition border-r border-slate-200"
              >
                SR NO
                <SortIcon field="srNo" />
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="p-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition"
                >
                  {col.label}
                  <SortIcon field={col.key} />
                </th>
              ))}
              <th className="p-3 w-[110px] text-center sticky right-0 z-40 bg-slate-100 border-l border-slate-200">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 text-xs bg-white">
            {filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <ShieldAlert size={32} className="text-slate-300" />
                    <p className="font-semibold text-slate-500">No schools matched the current filters</p>
                    {(activeFilterCount > 0 || searchTerm) && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredSchools.map((school) => {
                const isSelected = selectedIds.includes(school.id);
                const rowBg = isSelected ? "bg-orange-50/60" : "hover:bg-slate-50/80";
                return (
                  <tr key={school.id} className={`transition-colors ${rowBg}`}>
                    <td
                      className={`sticky left-0 z-10 p-3 text-center border-r border-slate-100 ${stickyCellBg(isSelected)}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(school.id)}
                        className="rounded border-slate-300 text-orange-600 cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td
                      className={`sticky left-[48px] z-10 p-3 text-center font-bold text-slate-500 border-r border-slate-100 ${stickyCellBg(isSelected)}`}
                    >
                      {school.srNo}
                    </td>
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        onClick={() => col.key === "schoolName" && setViewSchool(school)}
                        className={`p-3 max-w-[200px] truncate ${
                          col.key === "schoolName"
                            ? "font-semibold text-[#ff791a] cursor-pointer hover:underline"
                            : col.key === "schoolCategory"
                              ? ""
                              : ""
                        }`}
                        title={String(school[col.key] ?? "")}
                      >
                        {renderSchoolWorkCell(school, col.key)}
                      </td>
                    ))}
                    <td
                      className={`p-3 sticky right-0 z-10 border-l border-slate-100 ${stickyCellBg(isSelected)}`}
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => setViewSchool(school)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition"
                          title="View"
                        >
                          <Eye size={15} />
                        </button>
                        {!readOnly && (
                          <>
                            <button
                              onClick={() => onEditClick(school)}
                              className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg cursor-pointer transition"
                              title="Edit"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => onDeleteClick(school.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {viewSchool && (
        <SchoolWorkViewModal
          school={viewSchool}
          supervisors={supervisors}
          onClose={() => setViewSchool(null)}
          onEditClick={(s) => {
            setViewSchool(null);
            onEditClick(s);
          }}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
