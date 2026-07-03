import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Employee } from "../types";
import { MonthLedger } from "../lib/ledger-helpers";
import { LedgerOverviewRow } from "./LedgerOverviewRow";

type OverviewRow = {
  emp: Employee;
  monthLedger: MonthLedger;
};

type Props = {
  monthLabel: string;
  overviewRows: OverviewRow[];
  hasEmployees: boolean;
  onClose: () => void;
};

export default function LedgerRecordedOverviewModal({
  monthLabel,
  overviewRows,
  hasEmployees,
  onClose,
}: Props) {
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
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0 text-left">
              <h3 className="text-sm font-bold text-slate-800">
                Recorded Ledger Overview - {monthLabel}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Monthly totals at a glance for all recorded ledger entries.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-600">
                {overviewRows.length} employee{overviewRows.length === 1 ? "" : "s"}
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
                {!hasEmployees ? (
                  <div className="p-8 text-center text-xs text-slate-450 font-medium">
                    No employees registered in the system database.
                  </div>
                ) : overviewRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-450 font-medium">
                    No ledger entries recorded for {monthLabel} yet.
                  </div>
                ) : (
                  overviewRows.map(({ emp, monthLedger }) => (
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
