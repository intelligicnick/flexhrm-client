import React from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { useHRMS } from "../../context/HRMSContext";
import { normalizeMonthKey } from "../../lib/date-helpers";
import { formatMonthLabel } from "./ObserverUI";

export default function ObserverMonthPicker({ compact = false }: { compact?: boolean }) {
  const { selectedMonth, setSelectedMonth, MONTHS_LIST, activeFYRange } = useHRMS();
  const monthLabel = formatMonthLabel(selectedMonth);

  if (compact) {
    return (
      <div className="relative">
        <select
          value={MONTHS_LIST.includes(selectedMonth) ? selectedMonth : MONTHS_LIST[0] || selectedMonth}
          onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
          className="w-full text-[10px] font-bold text-white bg-white/10 border border-white/20 rounded-lg pl-7 pr-6 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300/40 cursor-pointer appearance-none truncate"
          aria-label="Select month and year"
        >
          {MONTHS_LIST.map((m) => (
            <option key={m} value={m} className="text-slate-800">
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
        <Calendar size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-orange-300/90 pointer-events-none" />
        <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-orange-300/80 pointer-events-none" />
        <p className="text-[9px] font-semibold text-orange-200/70 text-right mt-0.5 pr-0.5">FY {activeFYRange}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <Calendar size={14} className="text-orange-300/90 shrink-0" />
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <select
          value={MONTHS_LIST.includes(selectedMonth) ? selectedMonth : MONTHS_LIST[0] || selectedMonth}
          onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
          className="flex-1 min-w-0 text-[11px] font-bold text-white bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300/40 cursor-pointer appearance-none"
          aria-label="Select month and year"
        >
          {MONTHS_LIST.map((m) => (
            <option key={m} value={m} className="text-slate-800">
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="text-orange-300/80 -ml-6 pointer-events-none shrink-0" />
      </div>
      <span className="text-[10px] font-semibold text-orange-200/80 shrink-0 hidden sm:inline">FY {activeFYRange}</span>
      <span className="sr-only">{monthLabel}</span>
    </div>
  );
}
