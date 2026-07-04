import React, { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Employee } from "../types";
import { getMonthLedger } from "../lib/ledger-helpers";
import { normalizeMonthKey } from "../lib/date-helpers";
import { matchesMultiSelectFilter } from "../lib/filter-helpers";
import { LedgerOverviewRow, filterEmployeesWithLedgerEntries } from "./LedgerOverviewRow";
import SearchableMultiSelect from "./ui/SearchableMultiSelect";

type Props = {
  selectedMonth: string;
  monthsList: string[];
  employees: Employee[];
  onMonthChange: (month: string) => void;
  onClose: () => void;
};

export default function LedgerRecordedOverviewModal({
  selectedMonth,
  monthsList,
  employees,
  onMonthChange,
  onClose,
}: Props) {
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [locationFilters, setLocationFilters] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const overviewRows = useMemo(
    () =>
      filterEmployeesWithLedgerEntries(employees, selectedMonth, getMonthLedger).map((emp) => ({
        emp,
        monthLedger: getMonthLedger(emp, selectedMonth),
      })),
    [employees, selectedMonth],
  );

  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          overviewRows
            .map(({ emp }) => (emp.location || "Unassigned").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [overviewRows],
  );

  useEffect(() => {
    setLocationFilters((current) =>
      current.filter((value) =>
        locationOptions.some((option) => option.toLowerCase() === value.toLowerCase()),
      ),
    );
  }, [locationOptions]);

  const filteredOverviewRows = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    return overviewRows.filter(({ emp }) => {
      const employeeName = (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase();
      const employeeCode = (emp.employeeCode || "").toLowerCase();
      const locationLabel = (emp.location || "Unassigned").trim();
      const matchesSearch =
        !query ||
        employeeName.includes(query) ||
        employeeCode.includes(query) ||
        locationLabel.toLowerCase().includes(query);
      return matchesSearch && matchesMultiSelectFilter(locationLabel, locationFilters);
    });
  }, [employeeSearch, locationFilters, overviewRows]);

  const hasActiveFilters = employeeSearch.trim().length > 0 || locationFilters.length > 0;
  const employeeCountLabel = hasActiveFilters
    ? `${filteredOverviewRows.length} of ${overviewRows.length} employee${overviewRows.length === 1 ? "" : "s"}`
    : `${overviewRows.length} employee${overviewRows.length === 1 ? "" : "s"}`;

  return (
    <div className="fixed inset-0 z-[90] overflow-hidden animate-fade-in">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative h-full w-full p-2 sm:p-3">
        <div
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="space-y-4 border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-left">
                <h3 className="text-sm font-bold text-slate-800">
                  Recorded Ledger Overview - {selectedMonth}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                Monthly totals at a glance for all recorded ledger entries.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-600">
                  {employeeCountLabel}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                  aria-label="Close recorded ledger"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_220px_minmax(0,1fr)]">
              <label className="text-left">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Month
                </span>
                <select
                  value={monthsList.includes(selectedMonth) ? selectedMonth : monthsList[0] || selectedMonth}
                  onChange={(event) => onMonthChange(normalizeMonthKey(event.target.value))}
                  className="w-full rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition focus:border-orange-500 focus:outline-none"
                >
                  {monthsList.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-left">
                <SearchableMultiSelect
                  label="Location"
                  labelClassName="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400"
                  placeholder="All Locations"
                  options={locationOptions}
                  selected={locationFilters}
                  onChange={setLocationFilters}
                  containerId="recorded-ledger-location-filter"
                  buttonClassName="w-full rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:border-orange-500 focus:outline-none text-left flex justify-between items-center cursor-pointer"
                />
              </div>

              <label className="text-left">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Search Employee
                </span>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Name, code, or location"
                    className="w-full rounded-lg border border-slate-250 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-700 shadow-sm transition placeholder:text-slate-350 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
              <div className="bg-slate-100/50 px-4 py-2 border-b border-slate-200 grid grid-cols-10 text-[10px] font-black text-slate-500 uppercase tracking-wider text-left select-none">
                <span className="col-span-2">Employee</span>
                <span>Advance</span>
                <span>Uniform</span>
                <span>Penalty</span>
                <span>Food</span>
                <span>Accom.</span>
                <span>Conv.</span>
                <span className="col-span-2 text-center">Settlement Reason / Notes</span>
              </div>

              <div className="divide-y divide-slate-150 min-h-0 flex-1 overflow-y-auto" id="ledger-records-modal-container">
                {employees.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-450 font-medium">
                    No employees registered in the system database.
                  </div>
                ) : overviewRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-450 font-medium">
                    No ledger entries recorded for {selectedMonth} yet.
                  </div>
                ) : filteredOverviewRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-450 font-medium">
                    No employees match the current month, location, or search filters.
                  </div>
                ) : (
                  filteredOverviewRows.map(({ emp, monthLedger }) => (
                    <LedgerOverviewRow
                      key={emp.id}
                      emp={emp}
                      monthLedger={monthLedger}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
