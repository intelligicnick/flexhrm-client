import React, { useMemo, useState } from "react";
import { AlertTriangle, LogOut, X } from "lucide-react";
import {
  formatLastPresentDate,
  type ExitEligibleEmployee,
} from "../lib/exit-eligibility-helpers";

const EXIT_REASON_OPTIONS = [
  "Absconding",
  "Resignation",
  "Termination",
  "Retirement",
  "Contract Ended",
  "Mutual Separation",
  "Other",
] as const;

type ExitEligibleModalProps = {
  employees: ExitEligibleEmployee[];
  checkedMonths: string[];
  onClose: () => void;
  onMarkExit: (ids: string[], exitDate: string, exitReason: string) => Promise<void>;
};

export default function ExitEligibleModal({
  employees,
  checkedMonths,
  onClose,
  onMarkExit,
}: ExitEligibleModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    employees.map((e) => e.employeeId),
  );
  const [exitDate, setExitDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [exitReasonCategory, setExitReasonCategory] = useState<string>(EXIT_REASON_OPTIONS[0]);
  const [exitReasonDetails, setExitReasonDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allSelected = selectedIds.length === employees.length && employees.length > 0;

  const monthLabel = useMemo(() => {
    if (checkedMonths.length === 0) return "the last 3 months";
    if (checkedMonths.length === 1) return checkedMonths[0];
    return `${checkedMonths[0]} – ${checkedMonths[checkedMonths.length - 1]}`;
  }, [checkedMonths]);

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : employees.map((e) => e.employeeId));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    const trimmedDetails = exitReasonDetails.trim();
    const exitReason = trimmedDetails
      ? `${exitReasonCategory} — ${trimmedDetails}`
      : exitReasonCategory;

    setIsSubmitting(true);
    try {
      await onMarkExit(selectedIds, exitDate, exitReason);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-3 md:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-amber-200 w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-amber-100 bg-amber-50 rounded-t-xl shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-amber-900">Eligible for Exit</h3>
              <p className="text-[10px] text-amber-700 truncate">
                No present mark in {monthLabel} · {employees.length} employee
                {employees.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-amber-100 text-amber-600 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-auto flex-1 p-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-2 pr-2 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Location</th>
                  <th className="py-2">Last Present</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.employeeId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(emp.employeeId)}
                        onChange={() => toggleOne(emp.employeeId)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="py-2 pr-2 font-bold text-slate-800">{emp.employeeCode}</td>
                    <td className="py-2 pr-2 text-slate-700">{emp.nameAsPerAadhar || "—"}</td>
                    <td className="py-2 pr-2 text-slate-600">{emp.location || "Unassigned"}</td>
                    <td className="py-2 font-semibold text-rose-700">
                      {formatLastPresentDate(emp.lastPresentDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 p-4 space-y-3 shrink-0 bg-slate-50 rounded-b-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Exit Date</label>
                <input
                  type="date"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Exit Reason</label>
                <select
                  value={exitReasonCategory}
                  onChange={(e) => setExitReasonCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs"
                >
                  {EXIT_REASON_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <input
              type="text"
              value={exitReasonDetails}
              onChange={(e) => setExitReasonDetails(e.target.value)}
              placeholder="Additional details (optional)"
              className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
              >
                Review Later
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedIds.length === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <LogOut size={13} />
                {isSubmitting
                  ? "Marking exit..."
                  : `Mark Exit (${selectedIds.length})`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
