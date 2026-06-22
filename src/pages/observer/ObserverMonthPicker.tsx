import React from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { useHRMS } from "../../context/HRMSContext";
import { normalizeMonthKey } from "../../lib/date-helpers";
import { formatMonthLabel } from "./ObserverUI";

export default function ObserverMonthPicker({ compact = false }: { compact?: boolean }) {
  const { selectedMonth, setSelectedMonth, MONTHS_LIST, activeFYRange } = useHRMS();
  const monthLabel = formatMonthLabel(selectedMonth);
  const selectValue = MONTHS_LIST.includes(selectedMonth) ? selectedMonth : MONTHS_LIST[0] || selectedMonth;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <select
            value={selectValue}
            onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
            className="w-full text-xs font-bold text-slate-800 bg-white border-0 rounded-xl pl-9 pr-8 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300/50 cursor-pointer appearance-none"
            aria-label="Select month and year"
          >
            {MONTHS_LIST.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ff791a] pointer-events-none" />
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <span className="text-[10px] font-bold text-orange-200/90 shrink-0 px-2 py-1 rounded-lg bg-white/10">
          FY {activeFYRange}
        </span>
        <span className="sr-only">{monthLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <Calendar size={14} className="text-orange-300/90 shrink-0" />
      <div className="relative flex-1 min-w-0">
        <select
          value={selectValue}
          onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
          className="w-full text-xs font-bold text-slate-800 bg-white border-0 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300/50 cursor-pointer appearance-none"
          aria-label="Select month and year"
        >
          {MONTHS_LIST.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      <span className="text-[10px] font-semibold text-orange-200/80 shrink-0">FY {activeFYRange}</span>
      <span className="sr-only">{monthLabel}</span>
    </div>
  );
}
