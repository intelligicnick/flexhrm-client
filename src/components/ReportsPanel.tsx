import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { useHRMS } from "../context/HRMSContext";
import { Button } from "./ui/Button";
import { getEmployeeHeaderValue } from "../utils";
import {
  EXCEL_ROW_HEADERS,
  formatReportColumnLabel,
  REPORT_COLUMN_GROUPS,
  SKILL_FILTER_OPTIONS,
} from "../lib/report-columns";

function MultiSelectDropdown({
  label,
  placeholder,
  options,
  selected,
  isOpen,
  onToggle,
  onClear,
  onToggleOption,
}: {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  onToggleOption: (value: string) => void;
}) {
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  return (
    <div className="space-y-1.5 relative">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">{label}</label>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30 focus:border-[#ff791a] text-left flex justify-between items-center hover:bg-slate-50 transition cursor-pointer"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-56 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase">{label}</span>
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] font-bold uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Clear
            </button>
          </div>
          {options.map((option) => {
            const checked = selected.includes(option);
            return (
              <label
                key={option}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleOption(option)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a]"
                />
                <span className="font-medium">{option}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportsPanel() {
  const {
    customLocations,
    registeredJobRoles,
    customRoles,
    savedReportTemplates,
    isFetchingTemplates,
    newReportTemplateName,
    activeReportTemplateName,
    selectedReportColumns,
    reportLocFilters,
    reportJoinStartFilter,
    reportJoinEndFilter,
    reportExitStartFilter,
    reportExitEndFilter,
    reportMinSalaryFilter,
    reportMaxSalaryFilter,
    reportGenderFilter,
    reportMaritalFilter,
    reportEsicFilter,
    reportEmploymentFilter,
    reportSkillFilters,
    reportRoleFilters,
    isReportLocDropdownOpen,
    isSkillDropdownOpen,
    isRoleDropdownOpen,
    reportSearchQuery,
    selectedReportEmployeeIds,
    reportLocationExportLabel,
    filteredReportEmployees,
    reportActiveFilterCount,
    clearReportFilters,
    handleSaveReportTemplate,
    handleLoadReportTemplate,
    handleDeleteReportTemplate,
    downloadReportsCSV,
    downloadReportsExcel,
    downloadReportsPDF,
    setNewReportTemplateName,
    setSelectedReportColumns,
    setReportLocFilters,
    setReportJoinStartFilter,
    setReportJoinEndFilter,
    setReportExitStartFilter,
    setReportExitEndFilter,
    setReportMinSalaryFilter,
    setReportMaxSalaryFilter,
    setReportGenderFilter,
    setReportMaritalFilter,
    setReportEsicFilter,
    setReportEmploymentFilter,
    setReportSkillFilters,
    setReportRoleFilters,
    setIsReportLocDropdownOpen,
    setIsSkillDropdownOpen,
    setIsRoleDropdownOpen,
    setReportSearchQuery,
    setSelectedReportEmployeeIds,
  } = useHRMS();

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const roleOptions = useMemo(
    () => (registeredJobRoles.length > 0 ? registeredJobRoles : customRoles),
    [registeredJobRoles, customRoles],
  );

  const closeOtherDropdowns = (target: "location" | "skill" | "role") => {
    if (target !== "location") setIsReportLocDropdownOpen(false);
    if (target !== "skill") setIsSkillDropdownOpen(false);
    if (target !== "role") setIsRoleDropdownOpen(false);
  };

  const exportData =
    selectedReportEmployeeIds.length > 0
      ? filteredReportEmployees.filter((emp) => selectedReportEmployeeIds.includes(emp.id))
      : filteredReportEmployees;

  const canExport = filteredReportEmployees.length > 0 && selectedReportColumns.length > 0;
  const previewRows = filteredReportEmployees.slice(0, 50);

  const toggleColumnGroup = (groupHeaders: readonly string[], isAllChecked: boolean) => {
    if (isAllChecked) {
      setSelectedReportColumns((prev) => prev.filter((h) => !groupHeaders.includes(h)));
    } else {
      setSelectedReportColumns((prev) => Array.from(new Set([...prev, ...groupHeaders])));
    }
  };

  return (
    <div className="animate-fade-in" id="view-reports-panel">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden" id="custom-reports-builder">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50/80 via-white to-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Wrench size={18} className="text-[#ff791a]" />
              Employee Reports
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Set filters, choose columns, preview results, and export with saved templates.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">
                Template
              </span>
              <div className="relative min-w-[140px]">
                <select
                  id="active-report-template-name"
                  name="activeReportTemplateName"
                  value={activeReportTemplateName}
                  onChange={(e) => handleLoadReportTemplate(e.target.value)}
                  disabled={isFetchingTemplates}
                  className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30 disabled:opacity-60"
                >
                  <option value="">Choose layout…</option>
                  {savedReportTemplates.map((t: { name: string }) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {isFetchingTemplates && (
                  <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                )}
              </div>
              {activeReportTemplateName && (
                <button
                  type="button"
                  onClick={() => handleDeleteReportTemplate(activeReportTemplateName)}
                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-bold text-[10px] uppercase px-2 py-1 rounded hover:bg-red-50 cursor-pointer transition"
                  title="Delete template"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>

            <form onSubmit={handleSaveReportTemplate} className="flex items-center gap-2">
              <input
                id="new-report-template-name"
                name="newReportTemplateName"
                type="text"
                placeholder="Save current layout as…"
                value={newReportTemplateName}
                onChange={(e) => setNewReportTemplateName(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30 w-[160px]"
              />
              <Button type="submit" size="sm" disabled={!newReportTemplateName.trim()}>
                Save
              </Button>
            </form>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Filters — always visible */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Filter size={15} className="text-[#ff791a] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Filters</p>
                  <p className="text-[11px] text-slate-500 hidden sm:block">
                    Defaults to active employees. Refine the export pool below.
                  </p>
                </div>
                {reportActiveFilterCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-[#ff791a]/10 text-[#ff791a] text-[10px] font-black">
                    {reportActiveFilterCount} active
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg border border-[#ff791a]/20 bg-[#ff791a]/10 px-3 py-1.5 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block leading-none">
                    Matched
                  </span>
                  <span className="text-lg font-black text-[#ff791a] tabular-nums leading-tight">
                    {filteredReportEmployees.length}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearReportFilters}
                  disabled={reportActiveFilterCount === 0 && reportEmploymentFilter === "active"}
                >
                  <RotateCcw size={13} />
                  Reset
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "active", label: "Active only" },
                    { id: "exited", label: "Exited only" },
                    { id: "all", label: "All employees" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setReportEmploymentFilter(option.id)}
                    className={[
                      "px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer",
                      reportEmploymentFilter === option.id
                        ? "bg-[#ff791a] text-white border-[#ff791a]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MultiSelectDropdown
                  label="Branch / Location"
                  placeholder="All locations"
                  options={customLocations}
                  selected={reportLocFilters}
                  isOpen={isReportLocDropdownOpen}
                  onToggle={() => {
                    closeOtherDropdowns("location");
                    setIsReportLocDropdownOpen(!isReportLocDropdownOpen);
                  }}
                  onClear={() => setReportLocFilters([])}
                  onToggleOption={(loc) => {
                    setReportLocFilters((prev) =>
                      prev.includes(loc) ? prev.filter((item) => item !== loc) : [...prev, loc],
                    );
                  }}
                />

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Search employee
                  </label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="report-search-query"
                      name="reportSearchQuery"
                      type="text"
                      placeholder="Code or name…"
                      value={reportSearchQuery}
                      onChange={(e) => setReportSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                    />
                  </div>
                </div>

                <MultiSelectDropdown
                  label="Skill category"
                  placeholder="All categories"
                  options={[...SKILL_FILTER_OPTIONS]}
                  selected={reportSkillFilters}
                  isOpen={isSkillDropdownOpen}
                  onToggle={() => {
                    closeOtherDropdowns("skill");
                    setIsSkillDropdownOpen(!isSkillDropdownOpen);
                  }}
                  onClear={() => setReportSkillFilters([])}
                  onToggleOption={(cat) => {
                    setReportSkillFilters((prev) =>
                      prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat],
                    );
                  }}
                />

                <MultiSelectDropdown
                  label="Job role"
                  placeholder="All roles"
                  options={roleOptions}
                  selected={reportRoleFilters}
                  isOpen={isRoleDropdownOpen}
                  onToggle={() => {
                    closeOtherDropdowns("role");
                    setIsRoleDropdownOpen(!isRoleDropdownOpen);
                  }}
                  onClear={() => setReportRoleFilters([])}
                  onToggleOption={(role) => {
                    setReportRoleFilters((prev) =>
                      prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role],
                    );
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedFilters((open) => !open)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 hover:text-[#ff791a] cursor-pointer transition"
              >
                {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAdvancedFilters ? "Hide" : "Show"} date, salary & demographic filters
              </button>

              {showAdvancedFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-200">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      PF joining range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        id="report-join-start-filter"
                        name="reportJoinStartFilter"
                        type="date"
                        value={reportJoinStartFilter}
                        onChange={(e) => setReportJoinStartFilter(e.target.value)}
                        className="px-2 py-2 border border-slate-200 bg-white rounded-lg text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                      />
                      <input
                        id="report-join-end-filter"
                        name="reportJoinEndFilter"
                        type="date"
                        value={reportJoinEndFilter}
                        onChange={(e) => setReportJoinEndFilter(e.target.value)}
                        className="px-2 py-2 border border-slate-200 bg-white rounded-lg text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Exit / leaving range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        id="report-exit-start-filter"
                        name="reportExitStartFilter"
                        type="date"
                        value={reportExitStartFilter}
                        onChange={(e) => setReportExitStartFilter(e.target.value)}
                        className="px-2 py-2 border border-slate-200 bg-white rounded-lg text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                      />
                      <input
                        id="report-exit-end-filter"
                        name="reportExitEndFilter"
                        type="date"
                        value={reportExitEndFilter}
                        onChange={(e) => setReportExitEndFilter(e.target.value)}
                        className="px-2 py-2 border border-slate-200 bg-white rounded-lg text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Gross salary (₹)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        id="report-min-salary-filter"
                        name="reportMinSalaryFilter"
                        type="number"
                        placeholder="Min"
                        value={reportMinSalaryFilter}
                        onChange={(e) => setReportMinSalaryFilter(e.target.value)}
                        className="px-2 py-2 border border-slate-200 bg-white rounded-lg text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                      />
                      <input
                        id="report-max-salary-filter"
                        name="reportMaxSalaryFilter"
                        type="number"
                        placeholder="Max"
                        value={reportMaxSalaryFilter}
                        onChange={(e) => setReportMaxSalaryFilter(e.target.value)}
                        className="px-2 py-2 border border-slate-200 bg-white rounded-lg text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Gender</label>
                    <select
                      id="report-gender-filter"
                      name="reportGenderFilter"
                      value={reportGenderFilter}
                      onChange={(e) => setReportGenderFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                    >
                      <option value="All">All genders</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Marital status
                    </label>
                    <select
                      id="report-marital-filter"
                      name="reportMaritalFilter"
                      value={reportMaritalFilter}
                      onChange={(e) => setReportMaritalFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                    >
                      <option value="All">All statuses</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      ESIC insured
                    </label>
                    <select
                      id="report-esic-filter"
                      name="reportEsicFilter"
                      value={reportEsicFilter}
                      onChange={(e) => setReportEsicFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/30"
                    >
                      <option value="All">All coverage</option>
                      <option value="Yes">Yes (insured)</option>
                      <option value="No">No (exempt / excluded)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Columns + Preview side by side (preview can expand to full width) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start min-w-0">
            {!isPreviewExpanded && (
            <section className="xl:col-span-4 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col max-h-[560px]">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
                <div>
                  <p className="text-xs font-bold text-slate-800">Export columns</p>
                  <p className="text-[11px] text-slate-500">
                    {selectedReportColumns.length} of {EXCEL_ROW_HEADERS.length} selected
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedReportColumns(EXCEL_ROW_HEADERS)}>
                    All
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedReportColumns([])}>
                    None
                  </Button>
                </div>
              </div>
              <div className="p-3 space-y-2 overflow-y-auto grow">
                {REPORT_COLUMN_GROUPS.map((group) => {
                  const groupCheckedCount = group.headers.filter((h) => selectedReportColumns.includes(h)).length;
                  const isAllGroupChecked = groupCheckedCount === group.headers.length;
                  const isSomeGroupChecked = groupCheckedCount > 0 && !isAllGroupChecked;

                  return (
                    <div key={group.name} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className={`px-3 py-2 border-b flex items-center justify-between ${group.color}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeGroupChecked;
                            }}
                            checked={isAllGroupChecked}
                            onChange={() => toggleColumnGroup(group.headers, isAllGroupChecked)}
                            className="rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a] cursor-pointer"
                          />
                          <span className="text-[10px] font-black uppercase tracking-wider truncate">{group.name}</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/70 text-slate-700 rounded-full font-mono shrink-0">
                          {groupCheckedCount}/{group.headers.length}
                        </span>
                      </div>
                      <div className="p-2 space-y-1 max-h-32 overflow-y-auto">
                        {group.headers.map((header) => {
                          const isChecked = selectedReportColumns.includes(header);
                          return (
                            <label
                              key={header}
                              className="flex items-start gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedReportColumns((prev) => prev.filter((h) => h !== header));
                                  } else {
                                    setSelectedReportColumns((prev) => [...prev, header]);
                                  }
                                }}
                                className="mt-0.5 rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a]"
                              />
                              <span className="font-medium text-slate-700 leading-snug">
                                {formatReportColumnLabel(header)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            )}

            <section
              className={[
                "rounded-xl border border-slate-200 bg-white flex flex-col min-w-0 shadow-sm",
                isPreviewExpanded
                  ? "xl:col-span-12 min-h-[420px] max-h-[78vh]"
                  : "xl:col-span-8 min-h-[360px] max-h-[560px]",
              ].join(" ")}
              id="reports-preview-section"
            >
              <div className="px-4 py-3 border-b border-orange-100 bg-gradient-to-r from-orange-50/90 via-white to-white shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-slate-800">Live preview</p>
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600 tabular-nums">
                      {filteredReportEmployees.length > 50
                        ? `Showing 50 of ${filteredReportEmployees.length}`
                        : `${filteredReportEmployees.length} record${filteredReportEmployees.length === 1 ? "" : "s"}`}
                    </span>
                    {selectedReportColumns.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#ff791a]/10 text-[10px] font-bold text-[#ff791a] tabular-nums">
                        {selectedReportColumns.length} column{selectedReportColumns.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {isPreviewExpanded
                      ? "Expanded view — full width with readable cell text. Select rows to export a subset."
                      : "Updates as you change filters or columns. Expand for a larger, easier-to-read preview."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewExpanded((open) => !open)}
                  className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wide text-slate-600 hover:border-[#ff791a]/40 hover:text-[#ff791a] hover:bg-orange-50/50 transition cursor-pointer"
                  title={isPreviewExpanded ? "Contract preview" : "Expand preview"}
                >
                  {isPreviewExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  {isPreviewExpanded ? "Contract" : "Expand"}
                </button>
              </div>

              {filteredReportEmployees.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-slate-50/40">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Filter size={22} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No matching employees</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">Adjust filters or switch employment status to see preview data.</p>
                </div>
              ) : selectedReportColumns.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-slate-50/40">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <FileSpreadsheet size={22} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No columns selected</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    {isPreviewExpanded
                      ? "Contract the preview to pick export columns, or load a saved template."
                      : "Pick at least one column on the left to preview data."}
                  </p>
                  {isPreviewExpanded && (
                    <button
                      type="button"
                      onClick={() => setIsPreviewExpanded(false)}
                      className="mt-3 text-xs font-bold text-[#ff791a] hover:underline cursor-pointer"
                    >
                      Show column picker
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto rounded-b-xl border-t border-slate-100 bg-slate-50/30"
                  style={{ scrollbarWidth: "auto" }}
                  id="reports-preview-scroller"
                >
                  <table className="text-left border-collapse text-xs min-w-max w-max">
                      <thead className="select-none sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                          <th className="sticky left-0 z-20 bg-slate-800 p-2.5 w-10 text-center border-r border-slate-600/80 text-[10px] font-bold uppercase tracking-wider">
                            #
                          </th>
                          <th className="sticky left-10 z-20 bg-slate-800 p-2.5 w-11 text-center border-r border-slate-600/80">
                            <input
                              type="checkbox"
                              checked={
                                filteredReportEmployees.length > 0 &&
                                filteredReportEmployees.every((emp) => selectedReportEmployeeIds.includes(emp.id))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedReportEmployeeIds(filteredReportEmployees.map((emp) => emp.id));
                                } else {
                                  setSelectedReportEmployeeIds([]);
                                }
                              }}
                              className="rounded border-slate-500 bg-slate-700 text-[#ff791a] focus:ring-[#ff791a] cursor-pointer w-4 h-4"
                              id="reports-select-all"
                            />
                          </th>
                          {selectedReportColumns.map((col, idx) => (
                            <th
                              key={col + idx}
                              className="p-2.5 border-r border-slate-600/50 last:border-r-0 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap"
                            >
                              {formatReportColumnLabel(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((emp, empIdx) => {
                          const isSelected = selectedReportEmployeeIds.includes(emp.id);
                          const rowBg = isSelected ? "bg-orange-50" : empIdx % 2 === 0 ? "bg-white" : "bg-slate-50/80";
                          const stickyBg = isSelected ? "bg-orange-50" : empIdx % 2 === 0 ? "bg-white" : "bg-slate-50";
                          return (
                            <tr
                              key={emp.id || empIdx}
                              className={`border-b border-slate-100 last:border-b-0 hover:bg-orange-50/30 transition-colors ${isSelected ? "bg-orange-50/60" : ""}`}
                            >
                              <td
                                className={`sticky left-0 z-10 p-2.5 text-center border-r border-slate-100 text-[10px] font-bold text-slate-400 tabular-nums ${stickyBg}`}
                              >
                                {empIdx + 1}
                              </td>
                              <td
                                className={`sticky left-10 z-10 p-2.5 text-center border-r border-slate-100 ${stickyBg}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setSelectedReportEmployeeIds((prev) => prev.filter((id) => id !== emp.id));
                                    } else {
                                      setSelectedReportEmployeeIds((prev) => [...prev, emp.id]);
                                    }
                                  }}
                                  className="rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a] cursor-pointer w-4 h-4"
                                  id={`report-check-${emp.id}`}
                                />
                              </td>
                              {selectedReportColumns.map((col, colIdx) => {
                                const val = getEmployeeHeaderValue(emp, col, empIdx);
                                const display =
                                  val !== undefined && val !== null && val !== "" ? String(val) : "—";
                                return (
                                  <td
                                    key={col + colIdx}
                                    className={[
                                      "p-2.5 border-r border-slate-100 last:border-r-0 text-slate-700",
                                      isPreviewExpanded
                                        ? "min-w-[120px] max-w-[320px] whitespace-normal break-words align-top text-[11px] leading-relaxed"
                                        : "min-w-[140px] max-w-[280px] whitespace-nowrap font-mono text-[11px]",
                                      rowBg,
                                    ].join(" ")}
                                    title={display}
                                  >
                                    {display}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                </div>
              )}
            </section>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-800">{exportData.length}</span> employees ready
              {selectedReportEmployeeIds.length > 0 && (
                <span className="text-slate-500"> · {selectedReportEmployeeIds.length} row(s) selected</span>
              )}
              {selectedReportColumns.length > 0 && (
                <span className="text-slate-500"> · {selectedReportColumns.length} column(s)</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="md"
                disabled={!canExport}
                onClick={() => downloadReportsCSV(exportData, selectedReportColumns)}
                id="report-download-csv-btn"
              >
                <FileText size={14} />
                CSV
              </Button>
              <Button
                size="md"
                disabled={!canExport}
                onClick={() => downloadReportsExcel(exportData, selectedReportColumns, reportLocationExportLabel)}
                className="bg-green-600 hover:bg-green-700"
                id="report-download-excel-btn"
              >
                <FileSpreadsheet size={14} />
                Excel
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={!canExport}
                onClick={() => downloadReportsPDF(exportData, selectedReportColumns, reportLocationExportLabel)}
                id="report-download-pdf-btn"
              >
                <Download size={14} />
                PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
