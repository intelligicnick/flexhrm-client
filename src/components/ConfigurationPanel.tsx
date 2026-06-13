/**
 * HRMS Configuration panel — payroll rules, office locations, and job roles.
 */
import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Building,
  Check,
  Edit2,
  IndianRupee,
  Loader2,
  Map,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useHRMS } from "../context/HRMSContext";
import PercentIcon from "./ui/PercentIcon";
import { BASIC_SALARY_OPTIONS } from "../lib/hrms-config";
import {
  DEFAULT_LOCATION_PT_AMOUNT,
  resolveLocationPtAmount,
} from "../utils";

type ConfigSection = "payroll" | "locations" | "roles";

const SECTIONS: { id: ConfigSection; label: string; icon: React.ElementType }[] = [
  { id: "payroll", label: "Payroll Rules", icon: IndianRupee },
  { id: "locations", label: "Office Locations", icon: Map },
  { id: "roles", label: "Job Roles", icon: Briefcase },
];

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "orange" | "blue" | "emerald" | "slate";
}) {
  const accentClass =
    accent === "blue"
      ? "text-blue-600 bg-blue-50 border-blue-100"
      : accent === "emerald"
        ? "text-emerald-600 bg-emerald-50 border-emerald-100"
        : accent === "orange"
          ? "text-orange-600 bg-orange-50 border-orange-100"
          : "text-slate-600 bg-slate-50 border-slate-100";

  return (
    <div className={`rounded-xl border px-4 py-3 ${accentClass}`}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-xl font-black mt-0.5 tabular-nums">{value}</p>
      {hint && <p className="text-[10px] font-medium opacity-70 mt-1">{hint}</p>}
    </div>
  );
}

function RegistryEmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <MapPin size={28} className="mx-auto text-slate-300 mb-2" />
      <p className="text-xs font-semibold text-slate-500">{message}</p>
    </div>
  );
}

export default function ConfigurationPanel() {
  const {
    customLocations,
    customRoles,
    esicEligibilityLimit,
    basicSalaryPercentage,
    companyBranch,
    configHasUnsavedChanges,
    configValidationError,
    isSavingPayrollConfig,
    configSummary,
    locationCompliance,
    locationPtAmounts,
    isFetchingLocations,
    isFetchingJobRoles,
    newLocCompliance,
    newLocPtAmount,
    newLocNameInput,
    newRoleNameInput,
    editingLocIndex,
    editingLocValue,
    editingRoleIndex,
    editingRoleValue,
    selectedLocs,
    selectedRoles,
    setEsicEligibilityLimit,
    setBasicSalaryPercentage,
    setCompanyBranch,
    setNewLocCompliance,
    setNewLocPtAmount,
    setNewLocNameInput,
    setNewRoleNameInput,
    setEditingLocIndex,
    setEditingLocValue,
    setEditingRoleIndex,
    setEditingRoleValue,
    setSelectedLocs,
    setSelectedRoles,
    setConfigValidationError,
    handleAddLocationFromConfig,
    handleEditLocationFromConfig,
    handleDeleteLocations,
    handleAddRoleFromConfig,
    handleEditRoleFromConfig,
    handleDeleteRoles,
    updateLocationCompliance,
    updateLocationPtAmount,
    handleSavePayrollConfig,
    handleResetPayrollConfig,
  } = useHRMS();

  const [activeSection, setActiveSection] = useState<ConfigSection>("payroll");
  const [locSearch, setLocSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");

  const filteredLocations = useMemo(() => {
    const q = locSearch.trim().toLowerCase();
    if (!q) return customLocations;
    return customLocations.filter((loc) => loc.toLowerCase().includes(q));
  }, [customLocations, locSearch]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return customRoles;
    return customRoles.filter((role) => role.toLowerCase().includes(q));
  }, [customRoles, roleSearch]);

  const previewBasic = useMemo(() => {
    const gross = 30000;
    return Math.round((gross * basicSalaryPercentage) / 100);
  }, [basicSalaryPercentage]);

  const addLocation = () => {
    const val = newLocNameInput.trim();
    if (!val) return;
    const parsedPt = parseFloat(newLocPtAmount);
    const ptVal = Number.isFinite(parsedPt) && parsedPt >= 0 ? Math.round(parsedPt) : DEFAULT_LOCATION_PT_AMOUNT;
    handleAddLocationFromConfig(val, newLocCompliance, ptVal);
  };

  const addRole = () => {
    const val = newRoleNameInput.trim();
    if (!val) return;
    handleAddRoleFromConfig(val);
  };

  const renderPayrollSection = () => (
    <div className="space-y-5">
      {configHasUnsavedChanges && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>You have unsaved payroll rule changes. Save them to apply across salary calculations and new employee forms.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <IndianRupee size={14} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">ESIC Ceiling Limit</h4>
              <p className="text-[11px] text-slate-400">Employees at or below this gross salary are ESIC-eligible.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="esic-eligibility-limit" className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Monthly gross ceiling (₹)
              </label>
              <input
                id="esic-eligibility-limit"
                name="esicEligibilityLimit"
                type="number"
                min={0}
                step={100}
                value={esicEligibilityLimit}
                onChange={(e) => {
                  setConfigValidationError(null);
                  setEsicEligibilityLimit(Math.max(0, parseInt(e.target.value, 10) || 0));
                }}
                className="mt-1 w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
              />
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">{configSummary.esicCoveredCount}</span> of{" "}
              <span className="font-bold text-slate-800">{configSummary.totalEmployees}</span> employees currently covered
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <PercentIcon size={14} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Basic Salary Split</h4>
              <p className="text-[11px] text-slate-400">Used when computing basic from gross on new employee entry.</p>
            </div>
          </div>
          <div>
            <label htmlFor="basic-salary-percentage" className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              Basic as % of gross
            </label>
            <select
              id="basic-salary-percentage"
              name="basicSalaryPercentage"
              value={basicSalaryPercentage}
              onChange={(e) => {
                setConfigValidationError(null);
                setBasicSalaryPercentage(parseInt(e.target.value, 10));
              }}
              className="mt-1 w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-orange-500"
            >
              {BASIC_SALARY_OPTIONS.map((pct) => (
                <option key={pct} value={pct}>
                  {pct}% of gross{pct === 50 ? " (recommended)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-slate-500">
              Preview: ₹30,000 gross → <span className="font-bold text-slate-700">₹{previewBasic.toLocaleString("en-IN")}</span> basic
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <Building size={14} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Default Branch Office</h4>
              <p className="text-[11px] text-slate-400">Pre-filled when manually adding a new employee.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px] gap-3">
            <div>
              <label htmlFor="company-branch" className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Branch name
              </label>
              <input
                id="company-branch"
                name="companyBranch"
                type="text"
                list="company-branch-options"
                value={companyBranch}
                onChange={(e) => {
                  setConfigValidationError(null);
                  setCompanyBranch(e.target.value);
                }}
                placeholder="e.g. Hyderabad Branch"
                className="mt-1 w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-orange-500"
              />
              <datalist id="company-branch-options">
                {customLocations.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 flex items-center">
              <p className="text-[11px] text-slate-500">
                Pick from registered locations or type a custom branch label.
              </p>
            </div>
          </div>
        </div>
      </div>

      {configValidationError && (
        <p className="text-xs text-rose-600 font-semibold" role="alert">
          {configValidationError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handleResetPayrollConfig}
          disabled={!configHasUnsavedChanges || isSavingPayrollConfig}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600 font-bold text-xs rounded-lg transition cursor-pointer"
        >
          <RotateCcw size={13} /> Reset
        </button>
        <button
          type="button"
          onClick={handleSavePayrollConfig}
          disabled={!configHasUnsavedChanges || isSavingPayrollConfig}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
        >
          {isSavingPayrollConfig ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save Payroll Rules
        </button>
      </div>
    </div>
  );

  const renderLocationsSection = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-800">Add office location</h4>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            id="new-loc-name-input"
            name="newLocNameInput"
            type="text"
            placeholder="Enter office location name…"
            value={newLocNameInput}
            onChange={(e) => setNewLocNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLocation();
              }
            }}
            className="w-full px-3 py-2 border border-slate-200 bg-white text-sm text-slate-800 rounded-lg placeholder-slate-400 focus:outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={addLocation}
            disabled={!newLocNameInput.trim()}
            className="px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Plus size={14} /> Add Location
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <label htmlFor="new-loc-compliance" className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              id="new-loc-compliance"
              checked={newLocCompliance}
              onChange={(e) => setNewLocCompliance(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
            />
            <span className="text-xs font-semibold text-slate-700 leading-snug">
              Enable statutory compliance (PF, ESIC, PT)
            </span>
          </label>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="new-loc-pt-amount" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Default PT (₹)
            </label>
            <input
              type="number"
              id="new-loc-pt-amount"
              min={0}
              step={1}
              value={newLocPtAmount}
              onChange={(e) => setNewLocPtAmount(e.target.value)}
              className="w-24 px-2 py-1.5 border border-slate-200 bg-white text-sm text-slate-800 rounded-lg focus:outline-none focus:border-orange-500 text-right font-semibold"
              title="Professional Tax when monthly gross exceeds ₹10,000"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={locSearch}
            onChange={(e) => setLocSearch(e.target.value)}
            placeholder="Search locations…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-orange-500"
          />
        </div>
        {selectedLocs.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-600">{selectedLocs.length} selected</span>
            <button
              type="button"
              onClick={() => handleDeleteLocations(selectedLocs)}
              className="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={11} /> Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedLocs([])}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wide rounded-lg cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="bg-slate-50 px-3 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 min-w-0 cursor-pointer select-none">
            <input
              id="loc-select-all"
              name="locSelectAll"
              type="checkbox"
              checked={filteredLocations.length > 0 && filteredLocations.every((loc) => selectedLocs.includes(loc))}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedLocs((prev) => Array.from(new Set([...prev, ...filteredLocations])));
                } else {
                  setSelectedLocs((prev) => prev.filter((loc) => !filteredLocations.includes(loc)));
                }
              }}
              className="w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
            />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              {filteredLocations.length} location{filteredLocations.length !== 1 ? "s" : ""}
              {locSearch.trim() ? ` matching "${locSearch.trim()}"` : ""}
            </span>
          </label>
          {isFetchingLocations && <Loader2 size={14} className="animate-spin text-slate-400" />}
        </div>
        <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto" id="locations-scrollable-list">
          {isFetchingLocations && customLocations.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-400">Loading locations…</div>
          ) : filteredLocations.length === 0 ? (
            <RegistryEmptyState message={locSearch.trim() ? "No locations match your search." : "No branch offices added yet."} />
          ) : (
            filteredLocations.map((loc) => {
              const idx = customLocations.indexOf(loc);
              const isEditing = editingLocIndex === idx;
              const isSelected = selectedLocs.includes(loc);
              const employeeCount = configSummary.locationCounts[loc] || 0;
              const isRegistered = configSummary.registeredLocationSet.has(loc.toLowerCase());

              return (
                <div
                  key={loc}
                  className={`px-3 py-3 space-y-2 transition ${isSelected ? "bg-orange-50/40" : "hover:bg-slate-50/70"}`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        id={`edit-loc-${loc}`}
                        name={`editLoc_${loc}`}
                        type="text"
                        value={editingLocValue}
                        onChange={(e) => setEditingLocValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (editingLocValue.trim()) {
                              handleEditLocationFromConfig(loc, editingLocValue.trim());
                              setEditingLocIndex(null);
                            }
                          } else if (e.key === "Escape") {
                            setEditingLocIndex(null);
                          }
                        }}
                        className="flex-1 min-w-0 px-2.5 py-1.5 border border-blue-300 bg-blue-50/30 text-slate-800 font-medium text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={!editingLocValue.trim()}
                        onClick={() => {
                          if (editingLocValue.trim()) {
                            handleEditLocationFromConfig(loc, editingLocValue.trim());
                            setEditingLocIndex(null);
                          }
                        }}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg transition cursor-pointer shrink-0"
                        title="Save"
                      >
                        <Check size={12} className="stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLocIndex(null)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg border border-slate-200 transition cursor-pointer shrink-0"
                        title="Cancel"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 min-w-0">
                        <input
                          id={`loc-select-${loc}`}
                          name={`locSelect_${loc}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLocs((prev) => [...prev, loc]);
                            } else {
                              setSelectedLocs((prev) => prev.filter((l) => l !== loc));
                            }
                          }}
                          className="mt-1 w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800 leading-snug truncate" title={loc}>
                              {loc}
                            </p>
                            {!isRegistered && (
                              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Legacy only
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {employeeCount} employee{employeeCount !== 1 ? "s" : ""} assigned
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLocIndex(idx);
                              setEditingLocValue(loc);
                            }}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer"
                            title={`Rename "${loc}"`}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLocations([loc])}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                            title={`Delete "${loc}"`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-6">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            id={`loc-compliance-${loc}`}
                            name={`locCompliance_${loc}`}
                            type="checkbox"
                            checked={!!locationCompliance[loc]}
                            onChange={(e) => updateLocationCompliance(loc, e.target.checked)}
                            className="w-3.5 h-3.5 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                          />
                          <Shield size={11} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Compliance</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 select-none">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">PT (₹)</span>
                          <input
                            id={`loc-pt-${loc}`}
                            name={`locPt_${loc}`}
                            type="number"
                            min={0}
                            step={1}
                            value={resolveLocationPtAmount(loc, locationPtAmounts)}
                            onChange={(e) => updateLocationPtAmount(loc, e.target.value)}
                            className="w-16 px-2 py-0.5 border border-slate-200 bg-white text-xs font-semibold text-slate-800 rounded focus:outline-none focus:border-orange-500 text-center"
                          />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Renaming or deleting a location updates all linked employee records automatically.
      </p>
    </div>
  );

  const renderRolesSection = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-800">Add job role</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="new-role-name-input"
            name="newRoleNameInput"
            type="text"
            placeholder="Enter job role title…"
            value={newRoleNameInput}
            onChange={(e) => setNewRoleNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRole();
              }
            }}
            className="flex-1 px-3 py-2 border border-slate-200 bg-white text-sm text-slate-800 rounded-lg placeholder-slate-400 focus:outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={addRole}
            disabled={!newRoleNameInput.trim()}
            className="px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm inline-flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
          >
            <Plus size={14} /> Add Role
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={roleSearch}
            onChange={(e) => setRoleSearch(e.target.value)}
            placeholder="Search roles…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-orange-500"
          />
        </div>
        {selectedRoles.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-600">{selectedRoles.length} selected</span>
            <button
              type="button"
              onClick={() => handleDeleteRoles(selectedRoles)}
              className="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={11} /> Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoles([])}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wide rounded-lg cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="bg-slate-50 px-3 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="role-select-all"
              name="roleSelectAll"
              type="checkbox"
              checked={filteredRoles.length > 0 && filteredRoles.every((role) => selectedRoles.includes(role))}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedRoles((prev) => Array.from(new Set([...prev, ...filteredRoles])));
                } else {
                  setSelectedRoles((prev) => prev.filter((role) => !filteredRoles.includes(role)));
                }
              }}
              className="w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
            />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""}
              {roleSearch.trim() ? ` matching "${roleSearch.trim()}"` : ""}
            </span>
          </label>
          {isFetchingJobRoles && <Loader2 size={14} className="animate-spin text-slate-400" />}
        </div>
        <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto" id="roles-scrollable-list">
          {isFetchingJobRoles && customRoles.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-400">Loading roles…</div>
          ) : filteredRoles.length === 0 ? (
            <RegistryEmptyState message={roleSearch.trim() ? "No roles match your search." : "No job roles added yet."} />
          ) : (
            filteredRoles.map((role) => {
              const idx = customRoles.indexOf(role);
              const isEditing = editingRoleIndex === idx;
              const isSelected = selectedRoles.includes(role);
              const employeeCount = configSummary.roleCounts[role] || 0;
              const isRegistered = configSummary.registeredRoleSet.has(role.toLowerCase());

              return (
                <div
                  key={role}
                  className={`px-3 py-2.5 flex items-center justify-between gap-2 transition ${isSelected ? "bg-orange-50/40" : "hover:bg-slate-50/70"}`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        id={`edit-role-${role}`}
                        name={`editRole_${role}`}
                        type="text"
                        value={editingRoleValue}
                        onChange={(e) => setEditingRoleValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (editingRoleValue.trim()) {
                              handleEditRoleFromConfig(role, editingRoleValue.trim());
                              setEditingRoleIndex(null);
                            }
                          } else if (e.key === "Escape") {
                            setEditingRoleIndex(null);
                          }
                        }}
                        className="flex-1 px-2.5 py-1.5 border border-blue-300 bg-blue-50/30 text-slate-800 font-medium text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={!editingRoleValue.trim()}
                        onClick={() => {
                          if (editingRoleValue.trim()) {
                            handleEditRoleFromConfig(role, editingRoleValue.trim());
                            setEditingRoleIndex(null);
                          }
                        }}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg transition cursor-pointer"
                      >
                        <Check size={12} className="stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRoleIndex(null)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg border border-slate-200 transition cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          id={`role-select-${role}`}
                          name={`roleSelect_${role}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoles((prev) => [...prev, role]);
                            } else {
                              setSelectedRoles((prev) => prev.filter((r) => r !== role));
                            }
                          }}
                          className="w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800 truncate">{role}</span>
                            {!isRegistered && (
                              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Legacy only
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {employeeCount} employee{employeeCount !== 1 ? "s" : ""} assigned
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRoleIndex(idx);
                            setEditingRoleValue(role);
                          }}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer"
                          title={`Rename "${role}"`}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoles([role])}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          title={`Delete "${role}"`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Renaming or deleting a role updates all linked employee records automatically.
      </p>
    </div>
  );

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl shadow-xs animate-fade-in overflow-hidden"
      id="view-configuration-panel"
    >
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 tracking-tight">System Configuration</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Manage payroll rules, office locations, and job roles. Location and role changes sync immediately; payroll rules require an explicit save.
            </p>
          </div>
          {configHasUnsavedChanges && activeSection !== "payroll" && (
            <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wide">
              <AlertCircle size={11} /> Unsaved payroll rules
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <StatCard label="Employees" value={configSummary.totalEmployees} accent="slate" />
          <StatCard label="Locations" value={customLocations.length} hint={`${Object.keys(configSummary.locationCounts).length} in use`} accent="blue" />
          <StatCard label="Job Roles" value={customRoles.length} hint={`${Object.keys(configSummary.roleCounts).length} in use`} accent="orange" />
          <StatCard
            label="ESIC Covered"
            value={configSummary.esicCoveredCount}
            hint={`Ceiling ₹${esicEligibilityLimit.toLocaleString("en-IN")}`}
            accent="emerald"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[520px]">
        <nav className="lg:w-52 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/60 p-2 lg:p-3 flex lg:flex-col gap-1 overflow-x-auto">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            const showDot = id === "payroll" && configHasUnsavedChanges;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={[
                  "relative flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-xs font-bold whitespace-nowrap transition cursor-pointer",
                  isActive
                    ? "bg-white text-[#ff791a] shadow-sm border border-slate-200"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-800",
                ].join(" ")}
              >
                <Icon size={14} className="shrink-0" />
                {label}
                {showDot && <span className="ml-auto w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 p-4 lg:p-5 min-w-0">
          {activeSection === "payroll" && renderPayrollSection()}
          {activeSection === "locations" && renderLocationsSection()}
          {activeSection === "roles" && renderRolesSection()}
        </div>
      </div>
    </div>
  );
}
