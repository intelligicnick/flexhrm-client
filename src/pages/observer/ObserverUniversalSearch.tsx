import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHRMS } from "../../context/HRMSContext";
import { useObserverStats } from "./useObserverStats";
import { runUniversalSearch, type UniversalSearchResult } from "./observer-universal-search";
import { ObserverDetailSheet } from "./ObserverDetailSheet";
import {
  buildCommitmentDetails,
  buildContractDetails,
  buildEmployeeDetails,
  buildExpenseDetails,
  buildPartnerDetails,
  buildRenewalDetails,
  buildSupervisorDetails,
  buildTenderDetails,
  buildVisitDetails,
  type DetailField,
} from "./observer-details";

function SearchResultRow({
  result,
  onSelect,
}: {
  result: UniversalSearchResult;
  onSelect: (result: UniversalSearchResult) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition cursor-pointer"
    >
      <p className="text-[10px] font-bold uppercase text-[#ff791a]">{result.category}</p>
      <p className="text-sm font-bold text-slate-800 truncate">{result.title}</p>
      <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
    </button>
  );
}

export default function ObserverUniversalSearch() {
  const navigate = useNavigate();
  const stats = useObserverStats();
  const {
    employees,
    esicEligibilityLimit,
    attendanceDb,
    locationCompliance,
    locationPtEnabled,
  } = useHRMS();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<{ title: string; fields: DetailField[] } | null>(null);

  const results = useMemo(
    () =>
      runUniversalSearch({
        query,
        canView: stats.canView,
        employees,
        supervisors: stats.rawSchoolSupervisors,
        visits: stats.rawSchoolVisits,
        commitments: stats.rawCommitmentDiary,
        tenders: stats.rawTenders,
        contracts: stats.rawContracts,
        renewals: stats.rawRenewals,
        schools: stats.rawSchoolWorks,
        partners: stats.rawSchoolPartners,
        selectedMonth: stats.selectedMonth,
      }),
    [query, stats, employees],
  );

  const buildDetail = (result: UniversalSearchResult): { title: string; fields: DetailField[] } => {
    switch (result.kind) {
      case "employee":
        return {
          title: (result.entity as typeof employees[0]).nameAsPerAadhar,
          fields: buildEmployeeDetails(
            result.entity as typeof employees[0],
            stats.selectedMonth,
            esicEligibilityLimit,
            attendanceDb,
            locationCompliance,
            locationPtEnabled,
          ),
        };
      case "supervisor":
        return {
          title: (result.entity as typeof stats.rawSchoolSupervisors[0]).name,
          fields: buildSupervisorDetails(result.entity as typeof stats.rawSchoolSupervisors[0]),
        };
      case "visit":
        return {
          title: (result.entity as typeof stats.rawSchoolVisits[0]).schoolName,
          fields: buildVisitDetails(result.entity as typeof stats.rawSchoolVisits[0]),
        };
      case "commitment":
        return {
          title: (result.entity as typeof stats.rawCommitmentDiary[0]).schoolName,
          fields: buildCommitmentDetails(result.entity as typeof stats.rawCommitmentDiary[0]),
        };
      case "tender":
        return {
          title: (result.entity as typeof stats.rawTenders[0]).bidNo || "Tender",
          fields: buildTenderDetails(result.entity as typeof stats.rawTenders[0]),
        };
      case "contract":
        return {
          title: (result.entity as typeof stats.rawContracts[0]).contractNo || "Contract",
          fields: buildContractDetails(result.entity as typeof stats.rawContracts[0]),
        };
      case "renewal":
        return {
          title: (result.entity as typeof stats.rawRenewals[0]).title || "Renewal",
          fields: buildRenewalDetails(result.entity as typeof stats.rawRenewals[0]),
        };
      case "expense":
        return {
          title: (result.entity as typeof stats.rawSchoolWorks[0]).schoolName,
          fields: buildExpenseDetails(
            result.entity as typeof stats.rawSchoolWorks[0],
            stats.selectedMonth,
          ),
        };
      case "partner":
        return {
          title: (result.entity as typeof stats.rawSchoolPartners[0]).partnerName,
          fields: buildPartnerDetails(
            result.entity as typeof stats.rawSchoolPartners[0],
            stats.selectedMonth,
          ),
        };
      default:
        return { title: result.title, fields: [] };
    }
  };

  const handleSelect = (result: UniversalSearchResult) => {
    setDetail(buildDetail(result));
    setOpen(false);
    navigate(result.to);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-left text-[11px] font-semibold text-slate-200 hover:bg-white/15 transition cursor-pointer"
      >
        <Search size={14} className="shrink-0 text-orange-300/90" />
        <span className="truncate">Search employees, supervisors, visits…</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f6f9] max-w-lg mx-auto w-full">
          <div className="bg-gradient-to-br from-[#0C1E4A] via-[#152a5c] to-[#1a3568] px-4 pt-3 pb-4 safe-area-top shadow-lg">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
                <Search size={16} className="text-orange-300/90 shrink-0" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search across all modules…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none min-w-0"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                className="text-xs font-bold text-orange-200 px-2 py-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {!query.trim() ? (
              <p className="text-center text-xs text-slate-400 py-10">
                Type to search employees, supervisors, guards, visits, tenders, contracts, and more.
              </p>
            ) : results.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-10">No results for &ldquo;{query}&rdquo;</p>
            ) : (
              <div className="space-y-1">
                {results.map((result) => (
                  <SearchResultRow key={result.id} result={result} onSelect={handleSelect} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detail && (
        <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
