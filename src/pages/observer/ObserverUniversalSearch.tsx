import React, { useEffect, useMemo, useState } from "react";
import { Search, X, Calendar } from "lucide-react";
import { registerObserverBackHandler } from "../../lib/observer-back-handler";
import { useHRMS } from "../../context/HRMSContext";
import { useObserverStats } from "./useObserverStats";
import {
  groupUniversalSearchResults,
  runUniversalSearch,
  type UniversalSearchResult,
} from "./observer-universal-search";
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
  type ObserverDocumentLink,
} from "./observer-details";
import { fetchRenewalDocuments, getRenewalDocumentUrl } from "../../lib/renewals";

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
      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition cursor-pointer bg-slate-50/80"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-slate-800 truncate flex-1">{result.title}</p>
        {result.dateLabel && (
          <span className="text-[10px] font-semibold text-slate-400 shrink-0 inline-flex items-center gap-0.5">
            <Calendar size={10} />
            {result.dateLabel}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 truncate mt-0.5">{result.subtitle}</p>
    </button>
  );
}

type DetailState = {
  title: string;
  fields: DetailField[];
  documents?: ObserverDocumentLink[];
};

export default function ObserverUniversalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const stats = useObserverStats();
  const {
    employees,
    esicEligibilityLimit,
    attendanceDb,
    locationCompliance,
    locationPtEnabled,
  } = useHRMS();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [detail, setDetail] = useState<DetailState | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!detail) return undefined;
    return registerObserverBackHandler(() => {
      setDetail(null);
      return true;
    });
  }, [detail]);

  const results = useMemo(
    () =>
      runUniversalSearch({
        query: debouncedQuery,
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
        esicEligibilityLimit,
        attendanceDb,
        locationCompliance,
        locationPtEnabled,
      }),
    [debouncedQuery, stats, employees, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled],
  );

  const groupedResults = useMemo(() => groupUniversalSearchResults(results), [results]);

  const loadRenewalDocuments = async (renewalId: string): Promise<ObserverDocumentLink[]> => {
    try {
      const docs = await fetchRenewalDocuments(renewalId);
      return docs.map((doc) => ({
        id: doc.id,
        label: doc.label || doc.filename,
        url: getRenewalDocumentUrl(renewalId, doc),
        mimeType: doc.mimeType,
      }));
    } catch {
      return [];
    }
  };

  const buildDetail = async (result: UniversalSearchResult): Promise<DetailState> => {
    switch (result.kind) {
      case "employee":
      case "salary":
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
      case "renewal": {
        const renewal = result.entity as typeof stats.rawRenewals[0];
        const documents = await loadRenewalDocuments(renewal.id);
        return {
          title: renewal.title || renewal.subType || "Renewal",
          fields: buildRenewalDetails(renewal),
          documents,
        };
      }
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

  const handleSelect = async (result: UniversalSearchResult) => {
    const built = await buildDetail(result);
    setDetail(built);
  };

  const closeSearch = () => {
    onOpenChange(false);
    setQuery("");
  };

  if (!open && !detail) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f6f9] max-w-lg mx-auto w-full">
          <div className="bg-gradient-to-br from-[#0C1E4A] via-[#152a5c] to-[#1a3568] px-4 pt-3 pb-4 safe-area-top shadow-lg">
            <div className="flex items-center gap-2 mt-[20px]">
              <div className="flex-1 flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5">
                <Search size={16} className="text-orange-300/90 shrink-0" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, school, bid no, contract…"
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
                onClick={closeSearch}
                className="text-xs font-bold text-orange-200 px-2 py-1 cursor-pointer shrink-0"
              >
                Cancel
              </button>
            </div>
            {query.trim() && (
              <p className="text-[10px] text-orange-200/80 mt-2 font-semibold">
                {results.length} result{results.length === 1 ? "" : "s"} across modules
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {!query.trim() ? (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3">
                  <Search size={20} className="text-[#ff791a]" />
                </div>
                <p className="text-sm font-bold text-slate-600">Universal Search</p>
                <p className="text-xs text-slate-400 mt-2 max-w-[260px] mx-auto leading-relaxed">
                  Search a person or keyword to see salary, visits, contracts, tenders, expenses, and more — with dates from each module.
                </p>
              </div>
            ) : results.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-10">No results for &ldquo;{query}&rdquo;</p>
            ) : (
              <div className="space-y-4">
                {groupedResults.map((group) => (
                  <section key={group.category}>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#ff791a] px-1 mb-1.5">
                      {group.category}
                      <span className="text-slate-400 font-bold ml-1">({group.items.length})</span>
                    </p>
                    <div className="space-y-1.5">
                      {group.items.map((result) => (
                        <SearchResultRow key={result.id} result={result} onSelect={handleSelect} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detail && (
        <ObserverDetailSheet
          title={detail.title}
          fields={detail.fields}
          documents={detail.documents}
          onClose={() => {
            setDetail(null);
            if (!open) onOpenChange(true);
          }}
        />
      )}
    </>
  );
}
