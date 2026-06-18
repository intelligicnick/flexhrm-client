/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Search, MapPin, BadgePercent, ShieldAlert, Edit, Trash2, DownloadCloud, FileDown, FileSpreadsheet, CheckCircle, ChevronDown, RefreshCw, Eye, LogOut, X, Briefcase } from "lucide-react";
import { Employee, EXCEL_ROW_HEADERS } from "../types";
import { normalizeSkillCategory } from "../utils";
import EmployeeViewModal from "./EmployeeViewModal";

interface EmployeeTableProps {
  employees: Employee[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEditClick: (emp: Employee) => void;
  onDeleteClick: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkMarkExit?: (ids: string[], exitDate: string, exitReason: string) => void;
  onMarkExit?: (employee: Employee, exitDate: string, exitReason: string) => Promise<boolean>;
  onExportSelected: (type: "csv" | "excel" | "pdf", ids: string[]) => void;
  readOnly?: boolean;
  roleFilter?: string;
  onRoleFilterChange?: (role: string) => void;
}

type ViewMode = "all" | "identity" | "salary" | "nominee";

const BULK_EXIT_REASON_OPTIONS = [
  "Resignation",
  "Termination",
  "Retirement",
  "Absconding",
  "Contract Ended",
  "Mutual Separation",
  "Other",
] as const;

function buildBulkExitReason(category: string, details: string): string {
  const trimmedDetails = details.trim();
  return trimmedDetails ? `${category} — ${trimmedDetails}` : category;
}

export default function EmployeeTable({
  employees,
  selectedIds,
  onSelectionChange,
  onEditClick,
  onDeleteClick,
  onBulkDelete,
  onBulkMarkExit,
  onMarkExit,
  onExportSelected,
  readOnly = false,
  roleFilter: roleFilterProp,
  onRoleFilterChange,
}: EmployeeTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [localRoleFilter, setLocalRoleFilter] = useState("");
  const roleFilter = onRoleFilterChange !== undefined ? (roleFilterProp ?? "") : localRoleFilter;
  const setRoleFilter = onRoleFilterChange ?? setLocalRoleFilter;
  const [esicFilter, setEsicFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "exited" | "all">("active");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [showBulkExitDialog, setShowBulkExitDialog] = useState(false);
  const [bulkExitDate, setBulkExitDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [bulkExitReasonCategory, setBulkExitReasonCategory] = useState<string>(BULK_EXIT_REASON_OPTIONS[0]);
  const [bulkExitReasonDetails, setBulkExitReasonDetails] = useState("");
  
  // Sorting state
  const [sortField, setSortField] = useState<keyof Employee>("srNo");
  const [sortAsc, setSortAsc] = useState(true);

  // Get unique locations
  const locations = useMemo(() => {
    const locSet = new Set(employees.map((e) => e.location).filter(Boolean));
    return Array.from(locSet);
  }, [employees]);

  const roles = useMemo(() => {
    const roleSet = new Set(employees.map((e) => e.role).filter(Boolean));
    return Array.from(roleSet).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  // Handle individual row select
  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  // Filter and sort employees
  const filteredEmployees = useMemo(() => {
    let result = [...employees];

    // Employment Status Filter
    if (statusFilter === "active") {
      result = result.filter((emp) => {
        if (emp.exitDate && emp.exitDate.trim() !== "") return false;
        if (emp.customFields && Array.isArray(emp.customFields)) {
          const exitField = emp.customFields.find(
            (f) =>
              f.name.toLowerCase().includes("exit") ||
              f.name.toLowerCase().includes("resignation") ||
              f.name.toLowerCase().includes("leaving_date") ||
              f.name.toLowerCase().includes("leaving date")
          );
          if (exitField && exitField.value && exitField.value.trim() !== "") return false;
        }
        return true;
      });
    } else if (statusFilter === "exited") {
      result = result.filter((emp) => {
        if (emp.exitDate && emp.exitDate.trim() !== "") return true;
        if (emp.customFields && Array.isArray(emp.customFields)) {
          const exitField = emp.customFields.find(
            (f) =>
              f.name.toLowerCase().includes("exit") ||
              f.name.toLowerCase().includes("resignation") ||
              f.name.toLowerCase().includes("leaving_date") ||
              f.name.toLowerCase().includes("leaving date")
          );
          if (exitField && exitField.value && exitField.value.trim() !== "") return true;
        }
        return false;
      });
    }

    // Substring Search
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.employeeCode?.toLowerCase().includes(q) ||
          e.nameAsPerAadhar?.toLowerCase().includes(q) ||
          e.nameAsPerBank?.toLowerCase().includes(q) ||
          e.nameAsPerAadharColumn?.toLowerCase().includes(q) ||
          e.uan?.includes(q) ||
          e.aadharNo?.includes(q) ||
          e.panNo?.toLowerCase().includes(q)
      );
    }

    // Location Filter
    if (locationFilter) {
      result = result.filter((e) => e.location === locationFilter);
    }

    // Role Filter
    if (roleFilter) {
      result = result.filter((e) => (e.role || "").toLowerCase() === roleFilter.toLowerCase());
    }

    // ESIC Filter
    if (esicFilter) {
      result = result.filter((e) => e.esic?.toLowerCase() === esicFilter.toLowerCase());
    }

    // Sort
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
  }, [employees, searchTerm, locationFilter, roleFilter, esicFilter, statusFilter, sortField, sortAsc]);

  // Handle select-all checkbox
  const isAllSelected = useMemo(() => {
    if (filteredEmployees.length === 0) return false;
    return filteredEmployees.every((e) => selectedIds.includes(e.id));
  }, [filteredEmployees, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Unselect all in THIS filtered view
      const filteredCodes = filteredEmployees.map((e) => e.id);
      onSelectionChange(selectedIds.filter((id) => !filteredCodes.includes(id)));
    } else {
      // Add all filtered ones to selected list
      const combined = Array.from(new Set([...selectedIds, ...filteredEmployees.map((e) => e.id)]));
      onSelectionChange(combined);
    }
  };

  const handleSort = (field: keyof Employee) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setLocationFilter("");
    setRoleFilter("");
    setEsicFilter("");
    setStatusFilter("active");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="employee-table-component">
      {/* Search and Filters Section */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Main search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by Employee Code, Name, Aadhar No, UAN, PAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none rounded-lg text-sm text-slate-700 transition"
              id="search-input-field"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Employment Status Filter */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 text-slate-600">
              <ShieldAlert size={16} className="text-slate-400 mr-1 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="py-2 pr-4 bg-transparent border-0 text-xs font-semibold text-slate-700 focus:ring-0 focus:outline-none cursor-pointer"
                id="status-filter-dd"
              >
                <option value="active">Active Staff (Current)</option>
                <option value="exited">Exited Staff (Old List)</option>
                <option value="all">All Personnel</option>
              </select>
            </div>

            {/* Location filter */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 text-slate-600">
              <MapPin size={16} className="text-slate-400 mr-1 shrink-0" />
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="py-2 pr-4 bg-transparent border-0 text-xs text-slate-700 focus:ring-0 focus:outline-none cursor-pointer"
                id="location-filter-dd"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Role filter */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 text-slate-600">
              <Briefcase size={16} className="text-slate-400 mr-1 shrink-0" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="py-2 pr-4 bg-transparent border-0 text-xs text-slate-700 focus:ring-0 focus:outline-none cursor-pointer max-w-[140px]"
                id="role-filter-dd"
              >
                <option value="">All Job Roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* ESIC filter */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 text-slate-600">
              <BadgePercent size={16} className="text-slate-400 mr-1 shrink-0" />
              <select
                value={esicFilter}
                onChange={(e) => setEsicFilter(e.target.value)}
                className="py-2 pr-4 bg-transparent border-0 text-xs text-slate-700 focus:ring-0 focus:outline-none cursor-pointer"
                id="esic-filter-dd"
              >
                <option value="">All ESIC Coverages</option>
                <option value="Yes">ESIC Covered</option>
                <option value="No">Non ESIC Covered</option>
              </select>
            </div>

            {(searchTerm || locationFilter || roleFilter || esicFilter || statusFilter !== "active") && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition font-semibold cursor-pointer"
                id="btn-clear-filters"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Column Group View Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-200 pt-3 gap-3">
          <div className="flex overflow-x-auto bg-slate-200/60 p-1 rounded-lg gap-1 max-w-full scrollbar-none whitespace-nowrap scroll-smooth" id="view-mode-tabs">
            <button
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition shrink-0 ${
                viewMode === "all"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              }`}
              id="tab-all"
            >
              All Columns (49)
            </button>
            <button
              onClick={() => setViewMode("identity")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition shrink-0 ${
                viewMode === "identity"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              }`}
              id="tab-identity"
            >
              Identity & Payee Bank
            </button>
            <button
              onClick={() => setViewMode("salary")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition shrink-0 ${
                viewMode === "salary"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              }`}
              id="tab-salary"
            >
              Onboarding & Salary
            </button>
            <button
              onClick={() => setViewMode("nominee")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition shrink-0 ${
                viewMode === "nominee"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              }`}
              id="tab-nominee"
            >
              Nominee & Family
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-700">{filteredEmployees.length}</span> of <span className="font-bold text-slate-750">{employees.length}</span> Employees
          </div>
        </div>
      </div>

      {/* Floating Selection Action Ribbon */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 px-6 py-3 text-white flex items-center justify-between gap-4 animate-slide-up" id="selection-action-ribbon">
          <div className="flex items-center gap-3">
            <span className="p-1 px-2.5 bg-yellow-400 text-yellow-950 font-black text-xs rounded-full">
              {selectedIds.length} Selected
            </span>
            <p className="text-xs text-slate-300 hidden sm:block">Perform bulk actions on checked personnel</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onExportSelected("csv", selectedIds)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 font-bold text-xs px-3 py-1.5 rounded transition cursor-pointer"
              id="bulk-export-csv-btn"
              title="Download CSV (ESIC ECR format)"
            >
              <DownloadCloud size={14} className="text-blue-400" />
              CSV
            </button>
            <button
              onClick={() => onExportSelected("excel", selectedIds)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 font-bold text-xs px-3 py-1.5 rounded transition cursor-pointer"
              id="bulk-export-excel-btn"
              title="Download Styled Excel Sheet"
            >
              <FileSpreadsheet size={14} className="text-emerald-400" />
              Excel
            </button>
            <button
              onClick={() => onExportSelected("pdf", selectedIds)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 font-bold text-xs px-3 py-1.5 rounded transition cursor-pointer"
              id="bulk-export-pdf-btn"
              title="Download High-Fidelity PDF Registry"
            >
              <FileDown size={14} className="text-rose-400" />
              PDF
            </button>
            {!readOnly && onBulkMarkExit && (
              <button
                onClick={() => {
                  setBulkExitDate(new Date().toISOString().split("T")[0]);
                  setBulkExitReasonCategory(BULK_EXIT_REASON_OPTIONS[0]);
                  setBulkExitReasonDetails("");
                  setShowBulkExitDialog(true);
                }}
                className="flex items-center gap-1.5 bg-rose-900/80 hover:bg-rose-900 border border-rose-700 text-rose-100 font-bold text-xs px-3 py-1.5 rounded transition cursor-pointer"
                id="bulk-mark-exit-btn"
                title="Mark selected employees as exited"
              >
                <LogOut size={14} className="text-rose-300" />
                Mark Exit ({selectedIds.length})
              </button>
            )}
            {!readOnly && (
              <button
                onClick={() => onBulkDelete(selectedIds)}
                className="flex items-center gap-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 font-medium text-xs px-3 py-1.5 rounded transition cursor-pointer"
                id="bulk-delete-btn"
              >
                <Trash2 size={14} className="text-rose-400" />
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Datagrid */}
      <div className="overflow-x-auto overflow-y-auto max-h-[580px] w-full @container border border-slate-150 rounded-lg shadow-inner" style={{ scrollbarWidth: "auto" }}>
        <table className="w-full text-left border-collapse min-w-[1200px]" id="employees-grid-table">
          <thead>
            {/* Header top background */}
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-xs font-semibold select-none">
              
              {/* Sticky Columns (Prefix Checklist & Primary Attributes) with pixel-locked widths to prevent overlap & scrolling gaps */}
              <th className="sticky left-0 z-20 bg-slate-100 p-3.5 w-[48px] min-w-[48px] max-w-[48px] text-center border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.03)] selection:bg-transparent">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                  id="header-select-all"
                />
              </th>
              
              <th 
                onClick={() => handleSort("srNo")}
                className="sticky left-[48px] z-20 bg-slate-100 p-3.5 w-[60px] min-w-[60px] max-w-[60px] text-center cursor-pointer hover:bg-slate-200/70 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-center justify-center gap-1">
                  SR NO
                  {sortField === "srNo" && <span className="opacity-70 text-[9px]">{sortAsc ? "▲" : "▼"}</span>}
                </div>
              </th>

              <th 
                onClick={() => handleSort("employeeCode")}
                className="sticky left-[108px] z-20 bg-slate-100 p-3.5 w-[110px] min-w-[110px] max-w-[110px] cursor-pointer hover:bg-slate-200/70 border-r border-slate-250 shadow-[2px_0_4px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-center gap-1 justify-between">
                  <span>Code <span className="text-red-500 font-bold">*</span></span>
                  {sortField === "employeeCode" && <span className="opacity-70 text-[9px]">{sortAsc ? "▲" : "▼"}</span>}
                </div>
              </th>

              <th 
                onClick={() => handleSort("nameAsPerAadhar")}
                className="sticky left-[218px] z-20 bg-slate-100 p-3.5 w-[220px] min-w-[220px] max-w-[220px] cursor-pointer hover:bg-slate-200/70 border-r border-slate-300 shadow-[2px_0_4px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-center gap-1 justify-between">
                  <span>Name (Aadhar) <span className="text-red-500 font-bold">**</span></span>
                  {sortField === "nameAsPerAadhar" && <span className="opacity-70 text-[9px]">{sortAsc ? "▲" : "▼"}</span>}
                </div>
              </th>

              {/* Viewmode Specific Columns */}
              {viewMode === "all" && (
                <>
                  <th className="p-3.5 border-r border-slate-200 w-36">Location</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Skill Category</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Job Role</th>
                  <th className="p-3.5 border-r border-slate-200 w-44 text-center">Working Days Cycle</th>
                  <th className="p-3.5 border-r border-slate-200 w-32 text-right">Gross Salary <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-32 text-right">Basic Salary <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-20 text-center">ESIC</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">UAN</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Aadhar No <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Name as per Aadhar <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36">PAN No</th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Name as per PAN</th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Bank Account No <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36">IFSC Code <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Name as per Bank <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Father Name <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Husband Name <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36">PF Joining Date</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Date of Birth</th>
                  <th className="p-3.5 border-r border-slate-200 w-24 text-center">Gender <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-28 text-center">Marital <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Aadhar Mob <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Prev UAN</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Prev ESIC <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-52">Present Address <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-52">Permanent Address <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-40">Nominee Name</th>
                  <th className="p-3.5 border-r border-slate-200 w-32">Nominee DOB</th>
                  <th className="p-3.5 border-r border-slate-200 w-32">Nominee Relation</th>
                  <th className="p-3.5 border-r border-slate-200 w-32 text-right">Daily Wage</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Employee Mobile</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Nominee Mobile</th>
                  <th className="p-3.5 border-r border-slate-200 w-40">Family Member Name (3)</th>
                  <th className="p-3.5 border-r border-slate-200 w-32">Family Member DOB (3)</th>
                  <th className="p-3.5 border-r border-slate-200 w-32">Family Member Relation (3)</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Family Mobile (1)</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Family Mobile (2)</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Family Mobile (3)</th>
                </>
              )}

              {viewMode === "identity" && (
                <>
                  <th className="p-3.5 border-r border-slate-200 w-40 font-bold bg-slate-50/50">Aadhar No <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Name as per Aadhar <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36">PAN No</th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Name as per PAN</th>
                  <th className="p-3.5 border-r border-slate-200 w-48 font-bold bg-slate-50/50">Bank Account No <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36 font-bold bg-slate-50/50">IFSC Code <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Name as per Bank <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Aadhar Mob <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Employee Mobile</th>
                </>
              )}

              {viewMode === "salary" && (
                <>
                  <th className="p-3.5 border-r border-slate-200 w-36">Location</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Skill Category</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Job Role</th>
                  <th className="p-3.5 border-r border-slate-200 w-44 text-center">Working Days Cycle</th>
                  <th className="p-3.5 border-r border-slate-200 w-36 font-bold bg-slate-50/50 text-right">Gross Salary <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-36 font-bold bg-slate-50/50 text-right">Basic Salary <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-24 text-center">ESIC Status</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">UAN No</th>
                  <th className="p-3.5 border-r border-slate-200 w-36 text-center">PF Join Date</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Previous UAN</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Previous ESIC <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-32 text-right">Daily Wage</th>
                </>
              )}

              {viewMode === "nominee" && (
                <>
                  <th className="p-3.5 border-r border-slate-200 w-44">Present Address <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Permanent Address <span className="text-red-500">*</span></th>
                  <th className="p-3.5 border-r border-slate-200 w-44 font-semibold text-blue-900 bg-blue-50/20">Nominee Name</th>
                  <th className="p-3.5 border-r border-slate-200 w-32 font-semibold text-blue-900 bg-blue-50/20">Nominee DOB</th>
                  <th className="p-3.5 border-r border-slate-200 w-32 font-semibold text-blue-900 bg-blue-50/20">Nominee Rel</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Nominee Mobile</th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Family Member 1</th>
                  <th className="p-3.5 border-r border-slate-200 w-32">Relation 1</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Family Mobile (1)</th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Family Member 2</th>
                  <th className="p-3.5 border-r border-slate-200 w-32">Relation 2</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Family Mobile (2)</th>
                  <th className="p-3.5 border-r border-slate-200 w-44">Family Member 3</th>
                  <th className="p-3.5 border-r border-slate-200 w-32">Relation 3</th>
                  <th className="p-3.5 border-r border-slate-200 w-36">Family Mobile (3)</th>
                </>
              )}

              <th className="p-3.5 border-r border-slate-200 text-left w-52">Custom Fields</th>
              <th className="p-3.5 text-center w-[120px] min-w-[120px] max-w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-slate-700 text-xs bg-white">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={viewMode === "all" ? 42 : 16} className="py-12 text-center text-slate-450 font-medium">
                  <ShieldAlert className="mx-auto mb-2 text-slate-350" size={28} />
                  No employees matched the chosen filtering and search parameters.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedIds.includes(emp.id);
                return (
                  <tr
                    key={emp.id}
                    className={`hover:bg-slate-50/80 transition group ${
                      isSelected ? "bg-slate-50" : ""
                    }`}
                  >
                    {/* Sticky column checkboxes with pixel-locked widths */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 p-3 w-[48px] min-w-[48px] max-w-[48px] text-center border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.03)]">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(emp.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                        id={`check-${emp.id}`}
                      />
                    </td>

                    <td className="sticky left-[48px] z-10 bg-white group-hover:bg-slate-50 p-3 w-[60px] min-w-[60px] max-w-[60px] text-center font-bold text-slate-450 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.03)]">
                      {emp.srNo}
                    </td>

                    <td 
                      onClick={() => setViewEmployee(emp)}
                      className="sticky left-[108px] z-10 bg-white group-hover:bg-slate-50 p-3 w-[110px] min-w-[110px] max-w-[110px] font-semibold text-blue-600 border-r border-slate-250 shadow-[2px_0_4px_rgba(0,0,0,0.03)] cursor-pointer hover:underline hover:text-blue-800"
                      title="Click to view full employee dossier"
                    >
                      {emp.employeeCode}
                    </td>

                    <td className="sticky left-[218px] z-10 bg-white group-hover:bg-slate-50 p-3 w-[220px] min-w-[220px] max-w-[220px] font-bold text-slate-900 truncate border-r border-slate-300 shadow-[2px_0_4px_rgba(0,0,0,0.03)]" title={emp.nameAsPerAadhar}>
                      {emp.nameAsPerAadhar}
                    </td>

                    {/* Viewmode Specific Data Cells */}
                    {viewMode === "all" && (
                      <>
                        <td className="p-3 border-r border-slate-200 truncate max-w-[140px] text-slate-600">{emp.location || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 font-medium">{normalizeSkillCategory(emp.skillCategory) || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 font-medium">{emp.role || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-center font-medium">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            emp.workingDaysType === "22 Days (Sat/Sun Off)"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                              : emp.workingDaysType === "30/31 Days (No Off)"
                              ? "bg-rose-50 text-rose-700 border border-rose-100"
                              : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}>
                            {emp.workingDaysType || "26 Days (Sun Off)"}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-200 text-right font-semibold text-slate-800">
                          Rs. {emp.grossSalary ? emp.grossSalary.toLocaleString("en-IN") : "0"}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-right text-slate-600">
                          Rs. {emp.basicSalary ? emp.basicSalary.toLocaleString("en-IN") : "0"}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                            emp.esic === "Yes" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-500"
                          }`}>
                            {emp.esic || "No"}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 font-mono text-[11px]">{emp.uan || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-700 font-medium font-mono text-[11px]">{emp.aadharNo ? emp.aadharNo.replace(/(\d{4})/g, "$1 ").trim() : "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-500 truncate max-w-[160px]">{emp.nameAsPerAadharColumn || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.panNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-500 truncate max-w-[160px]">{emp.nameAsPerPan || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-700 font-semibold font-mono text-[11px]">{emp.bankAccountNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-650 font-mono text-[11px] font-medium">{emp.ifscCode || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-500 truncate max-w-[160px]">{emp.nameAsPerBank || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 truncate max-w-[160px]">{emp.fatherName || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-500 truncate max-w-[160px]">{emp.husbandName || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-655">{emp.pfJoiningDate || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-655">{emp.dateOfBirth || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-center text-slate-600">{emp.gender || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-center text-slate-600">{emp.maritalStatus || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.aadharLinkMobNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-505 text-[11px]">{emp.previousUanNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-505 text-[11px]">{emp.previousEsicNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 truncate max-w-[200px] text-slate-505" title={emp.presentAddress}>{emp.presentAddress || "—"}</td>
                        <td className="p-3 border-r border-slate-200 truncate max-w-[200px] text-slate-505" title={emp.permanentAddress}>{emp.permanentAddress || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-700 font-semibold">{emp.nomineeName || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600">{emp.nomineeDob || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600">{emp.nomineeRelation || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-right font-semibold text-slate-700">
                          {emp.dailyWage ? `Rs. ${emp.dailyWage.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.employeeMobile || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.nomineeMobile || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 truncate max-w-[140px]">{emp.familyMember3Name || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-505">{emp.familyMember3Dob || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-505">{emp.familyMember3Relation || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.familyMember1Mobile || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.familyMember2Mobile || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.familyMember3Mobile || "—"}</td>
                      </>
                    )}

                    {viewMode === "identity" && (
                      <>
                        <td className="p-3 border-r border-slate-200 font-mono font-medium text-slate-800 bg-slate-50/20">{emp.aadharNo ? emp.aadharNo.replace(/(\d{4})/g, "$1 ").trim() : "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-605">{emp.nameAsPerAadharColumn || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.panNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-500 truncate max-w-[150px]">{emp.nameAsPerPan || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono font-semibold text-slate-900 bg-slate-50/20">{emp.bankAccountNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono font-medium text-slate-855 bg-slate-50/20">{emp.ifscCode || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-500 truncate">{emp.nameAsPerBank || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 font-mono">{emp.aadharLinkMobNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.employeeMobile || "—"}</td>
                      </>
                    )}

                    {viewMode === "salary" && (
                      <>
                        <td className="p-3 border-r border-slate-200 text-slate-600">{emp.location || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 font-medium">{normalizeSkillCategory(emp.skillCategory) || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 font-medium">{emp.role || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-center font-medium bg-slate-50/20">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            emp.workingDaysType === "22 Days (Sat/Sun Off)"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                              : emp.workingDaysType === "30/31 Days (No Off)"
                              ? "bg-rose-50 text-rose-700 border border-rose-100"
                              : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}>
                            {emp.workingDaysType || "26 Days (Sun Off)"}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-200 text-right font-bold text-slate-800 bg-slate-50/20">
                          Rs. {emp.grossSalary ? emp.grossSalary.toLocaleString("en-IN") : "0"}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-right font-semibold text-slate-655 bg-slate-50/20">
                          Rs. {emp.basicSalary ? emp.basicSalary.toLocaleString("en-IN") : "0"}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                            emp.esic === "Yes" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-500"
                          }`}>
                            {emp.esic || "No"}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px]">{emp.uan || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 text-center">{emp.pfJoiningDate || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-550">{emp.previousUanNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-550">{emp.previousEsicNo || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-right font-semibold text-slate-700 bg-slate-50/10">
                          {emp.dailyWage ? `Rs. ${emp.dailyWage.toLocaleString("en-IN")}` : "—"}
                        </td>
                      </>
                    )}

                    {viewMode === "nominee" && (
                      <>
                        <td className="p-3 border-r border-slate-200 font-normal text-slate-500 truncate max-w-[150px]" title={emp.presentAddress}>{emp.presentAddress || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-normal text-slate-500 truncate max-w-[150px]" title={emp.permanentAddress}>{emp.permanentAddress || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-850 font-bold bg-blue-50/5">{emp.nomineeName || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-medium text-slate-600 bg-blue-50/5">{emp.nomineeDob || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-655 font-semibold bg-blue-50/5">{emp.nomineeRelation || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600 bg-blue-50/5">{emp.nomineeMobile || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 truncate max-w-[140px]">{emp.familyMember1Name || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-505">{emp.familyMember1Relation || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.familyMember1Mobile || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-655 truncate max-w-[140px]">{emp.familyMember2Name || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-505">{emp.familyMember2Relation || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.familyMember2Mobile || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-655 truncate max-w-[140px]">{emp.familyMember3Name || "—"}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-505">{emp.familyMember3Relation || "—"}</td>
                        <td className="p-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">{emp.familyMember3Mobile || "—"}</td>
                      </>
                    )}

                    <td className="p-3 border-r border-slate-200 w-52 max-w-[208px]">
                      {emp.customFields && emp.customFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-full" id={`custom-fields-cell-${emp.id}`}>
                          {emp.customFields.map((f, i) => (
                            <span 
                              key={i} 
                              className="inline-block text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 truncate max-w-full font-medium"
                              title={`${f.name} (${f.type}): ${f.value || "no value"}`}
                            >
                              <strong>{f.name}:</strong> {f.value || "—"}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal italic">—</span>
                      )}
                    </td>

                    <td className="p-2 w-[120px] min-w-[120px] max-w-[120px] text-center">
                      <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={() => setViewEmployee(emp)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-950 border border-slate-200 text-slate-700 rounded transition cursor-pointer"
                          title="View Complete Employee Dossier"
                          id={`btn-view-${emp.id}`}
                        >
                          <Eye size={13} />
                        </button>
                        {!readOnly && (
                          <>
                            <button
                              onClick={() => onEditClick(emp)}
                              className="p-1.5 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-700 rounded transition cursor-pointer"
                              title="Edit employee onboarding card"
                              id={`btn-edit-${emp.id}`}
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => onDeleteClick(emp.id)}
                              className="p-1.5 bg-rose-50 border border-rose-105 hover:bg-rose-100 text-rose-700 rounded transition cursor-pointer"
                              title="Remove employee record"
                              id={`btn-delete-${emp.id}`}
                            >
                              <Trash2 size={13} />
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
      {viewEmployee && (
        <EmployeeViewModal
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
          onEditClick={(emp) => {
            setViewEmployee(null);
            onEditClick(emp);
          }}
          onMarkExit={onMarkExit}
          readOnly={readOnly}
        />
      )}

      {showBulkExitDialog && onBulkMarkExit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setShowBulkExitDialog(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Bulk mark exit</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Set the same leaving date for {selectedIds.length} selected employee(s). They will leave the active roster.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkExitDialog(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Exit / leaving date
            </label>
            <input
              type="date"
              value={bulkExitDate}
              onChange={(e) => setBulkExitDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#ff791a] focus:outline-none focus:ring-2 focus:ring-[#ff791a]/20"
              id="bulk-exit-date-input"
            />
            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Reason for exit
            </label>
            <select
              value={bulkExitReasonCategory}
              onChange={(e) => setBulkExitReasonCategory(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#ff791a] focus:outline-none focus:ring-2 focus:ring-[#ff791a]/20"
              id="bulk-exit-reason-input"
            >
              {BULK_EXIT_REASON_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {bulkExitReasonCategory === "Other" ? "Details (required)" : "Additional notes (optional)"}
            </label>
            <textarea
              value={bulkExitReasonDetails}
              onChange={(e) => setBulkExitReasonDetails(e.target.value)}
              rows={3}
              placeholder={
                bulkExitReasonCategory === "Other"
                  ? "Describe why these employees are leaving..."
                  : "Any extra context about the separation..."
              }
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#ff791a] focus:outline-none focus:ring-2 focus:ring-[#ff791a]/20"
              id="bulk-exit-details-input"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkExitDialog(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const reason = buildBulkExitReason(bulkExitReasonCategory, bulkExitReasonDetails);
                  if (bulkExitReasonCategory === "Other" && !bulkExitReasonDetails.trim()) {
                    alert("Please describe the exit reason when selecting Other.");
                    return;
                  }
                  onBulkMarkExit(selectedIds, bulkExitDate, reason);
                  setShowBulkExitDialog(false);
                }}
                disabled={
                  !bulkExitDate.trim() ||
                  (bulkExitReasonCategory === "Other" && !bulkExitReasonDetails.trim())
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                id="confirm-bulk-mark-exit-btn"
              >
                <LogOut size={14} />
                Mark {selectedIds.length} Exited
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
