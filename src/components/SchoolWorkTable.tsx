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
} from "lucide-react";
import { SchoolWork } from "../types";
import SchoolWorkViewModal from "./SchoolWorkViewModal";

interface SchoolWorkTableProps {
  schools: SchoolWork[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEditClick: (school: SchoolWork) => void;
  onDeleteClick: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onExportSelected: (type: "csv" | "excel", ids: string[]) => void;
  readOnly?: boolean;
}

const COLUMNS: { key: keyof SchoolWork; label: string }[] = [
  { key: "schoolName", label: "School Name" },
  { key: "udise", label: "UDISE" },
  { key: "headmasterName", label: "Headmaster Name" },
  { key: "headmasterNumber", label: "Headmaster Number" },
  { key: "sweeperName", label: "Sweeper Name" },
  { key: "accountHolderName", label: "Account Holder Name" },
  { key: "accountNumber", label: "Account Number" },
  { key: "ifscCode", label: "IFSC Code" },
  { key: "noOfToilets", label: "No of Toilets" },
  { key: "rates", label: "Rates" },
  { key: "rateExplanation", label: "Explanation for Rate" },
  { key: "block", label: "Block" },
  { key: "district", label: "District" },
  { key: "materialCost", label: "Material Cost" },
  { key: "remarks", label: "Remarks" },
];

export default function SchoolWorkTable({
  schools,
  selectedIds,
  onSelectionChange,
  onEditClick,
  onDeleteClick,
  onBulkDelete,
  onExportSelected,
  readOnly = false,
}: SchoolWorkTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [viewSchool, setViewSchool] = useState<SchoolWork | null>(null);
  const [sortField, setSortField] = useState<keyof SchoolWork>("srNo");
  const [sortAsc, setSortAsc] = useState(true);

  const districts = useMemo(
    () => Array.from(new Set(schools.map((s) => s.district).filter(Boolean))),
    [schools],
  );
  const blocks = useMemo(
    () => Array.from(new Set(schools.map((s) => s.block).filter(Boolean))),
    [schools],
  );

  const filteredSchools = useMemo(() => {
    let result = [...schools];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.schoolName?.toLowerCase().includes(q) ||
          s.udise?.toLowerCase().includes(q) ||
          s.headmasterName?.toLowerCase().includes(q) ||
          s.sweeperName?.toLowerCase().includes(q),
      );
    }
    if (districtFilter) result = result.filter((s) => s.district === districtFilter);
    if (blockFilter) result = result.filter((s) => s.block === blockFilter);

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
  }, [schools, searchTerm, districtFilter, blockFilter, sortField, sortAsc]);

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="school-work-table">
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by school name, UDISE, headmaster, sweeper..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
              <MapPin size={16} className="text-slate-400 mr-1" />
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="py-2 pr-4 bg-transparent border-0 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="">All Districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
              <select
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="py-2 pr-4 bg-transparent border-0 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="">All Blocks</option>
                {blocks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-700">{filteredSchools.length}</span> of{" "}
          <span className="font-bold text-slate-750">{schools.length}</span> schools
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-slate-900 px-6 py-3 text-white flex items-center justify-between gap-4">
          <span className="p-1 px-2.5 bg-yellow-400 text-yellow-950 font-black text-xs rounded-full">
            {selectedIds.length} Selected
          </span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onExportSelected("csv", selectedIds)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold px-3 py-1.5 rounded cursor-pointer"
            >
              <DownloadCloud size={14} /> CSV
            </button>
            <button
              onClick={() => onExportSelected("excel", selectedIds)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold px-3 py-1.5 rounded cursor-pointer"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            {!readOnly && (
              <button
                onClick={() => onBulkDelete(selectedIds)}
                className="flex items-center gap-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-xs font-bold px-3 py-1.5 rounded cursor-pointer"
              >
                <Trash2 size={14} /> Delete ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-auto max-h-[580px] w-full">
        <table className="w-full text-left border-collapse min-w-[1600px]" id="schools-grid-table">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-xs font-semibold">
              <th className="sticky left-0 z-20 bg-slate-100 p-3 w-[48px] text-center border-r border-slate-200">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-orange-600 cursor-pointer w-4 h-4"
                />
              </th>
              <th
                onClick={() => handleSort("srNo")}
                className="sticky left-[48px] z-20 bg-slate-100 p-3 w-[60px] text-center cursor-pointer border-r border-slate-200"
              >
                SR NO
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="p-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/70"
                >
                  {col.label}
                </th>
              ))}
              <th className="p-3 w-[100px] text-center sticky right-0 z-20 bg-slate-100 border-l border-slate-200">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-slate-700 text-xs bg-white">
            {filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="py-12 text-center text-slate-450">
                  <ShieldAlert className="mx-auto mb-2 text-slate-350" size={28} />
                  No schools matched the current filters.
                </td>
              </tr>
            ) : (
              filteredSchools.map((school) => {
                const isSelected = selectedIds.includes(school.id);
                return (
                  <tr key={school.id} className={`hover:bg-slate-50/80 ${isSelected ? "bg-slate-50" : ""}`}>
                    <td className="sticky left-0 z-10 bg-white p-3 text-center border-r border-slate-200">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(school.id)}
                        className="rounded border-slate-300 text-orange-600 cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="sticky left-[48px] z-10 bg-white p-3 text-center font-bold border-r border-slate-200">
                      {school.srNo}
                    </td>
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        onClick={() => col.key === "schoolName" && setViewSchool(school)}
                        className={`p-3 max-w-[200px] truncate ${col.key === "schoolName" ? "font-semibold text-orange-700 cursor-pointer hover:underline" : ""}`}
                        title={String(school[col.key] ?? "")}
                      >
                        {school[col.key] ?? ""}
                      </td>
                    ))}
                    <td className="p-3 sticky right-0 z-10 bg-white border-l border-slate-200">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewSchool(school)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        {!readOnly && (
                          <>
                            <button
                              onClick={() => onEditClick(school)}
                              className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded cursor-pointer"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => onDeleteClick(school.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={14} />
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
        <SchoolWorkViewModal school={viewSchool} onClose={() => setViewSchool(null)} />
      )}
    </div>
  );
}
