import React from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { useHRMS } from "../../context/HRMSContext";
import { FISCAL_MONTH_NAME_LIST, getCalendarYearFromFYRange, normalizeMonthKey } from "../../lib/date-helpers";
import { formatMonthLabel } from "./ObserverUI";

export default function ObserverMonthPicker({ compact = false }: { compact?: boolean }) {
  const {
    selectedMonth,
    setSelectedMonth,
    activeMonthName,
    activeFYRange,
    availableFYRanges,
  } = useHRMS();
  const monthLabel = formatMonthLabel(selectedMonth);

  const handleMonthChange = (newMonth: string) => {
    const calendarYear = getCalendarYearFromFYRange(newMonth, activeFYRange);
    setSelectedMonth(normalizeMonthKey(`${newMonth} ${calendarYear}`));
  };

  const handleYearChange = (newFYRange: string) => {
    const calendarYear = getCalendarYearFromFYRange(activeMonthName, newFYRange);
    setSelectedMonth(normalizeMonthKey(`${activeMonthName} ${calendarYear}`));
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <select
            value={activeMonthName}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-full text-xs font-bold text-slate-800 bg-white border-0 rounded-xl pl-9 pr-7 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300/50 cursor-pointer appearance-none"
            aria-label="Select month"
          >
            {FISCAL_MONTH_NAME_LIST.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ff791a] pointer-events-none" />
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative shrink-0 min-w-[5.5rem]">
          <select
            value={activeFYRange}
            onChange={(e) => handleYearChange(e.target.value)}
            className="w-full text-[10px] font-bold text-slate-800 bg-white border-0 rounded-xl pl-2 pr-6 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300/50 cursor-pointer appearance-none"
            aria-label="Select financial year"
          >
            {availableFYRanges.map((fy) => (
              <option key={fy} value={fy}>
                FY {fy}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <span className="sr-only">{monthLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <Calendar size={14} className="text-orange-300/90 shrink-0" />
      <div className="relative flex-1 min-w-0">
        <select
          value={activeMonthName}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="w-full text-xs font-bold text-slate-800 bg-white border-0 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300/50 cursor-pointer appearance-none"
          aria-label="Select month"
        >
          {FISCAL_MONTH_NAME_LIST.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      <div className="relative shrink-0 min-w-[6rem]">
        <select
          value={activeFYRange}
          onChange={(e) => handleYearChange(e.target.value)}
          className="w-full text-xs font-bold text-slate-800 bg-white border-0 rounded-xl px-2.5 pr-7 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300/50 cursor-pointer appearance-none"
          aria-label="Select financial year"
        >
          {availableFYRanges.map((fy) => (
            <option key={fy} value={fy}>
              FY {fy}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      <span className="sr-only">{monthLabel}</span>
    </div>
  );
}
