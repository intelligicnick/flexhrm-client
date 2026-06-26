import React from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { MonitorPeriod } from "../../lib/monitor-period";
import { PERIOD_LABELS, periodRangeLabel } from "../../lib/monitor-period";
import type { MonitoredEmployee } from "../../lib/monitor-api";
import { todayKey } from "../../lib/monitor-api";
import { formatAppDate } from "../../lib/date-helpers";
import MonitorEmployeeSelect from "./MonitorEmployeeSelect";

interface MonitorFilterBarProps {
  employees: MonitoredEmployee[];
  selectedEmployee: string;
  onEmployeeChange: (id: string) => void;
  period: MonitorPeriod;
  onPeriodChange: (p: MonitorPeriod) => void;
  date: string;
  onDateChange: (d: string) => void;
  showEmployee?: boolean;
  showPeriod?: boolean;
  showDate?: boolean;
  employeeRequired?: boolean;
  rangeStart?: string;
  rangeEnd?: string;
}

function shiftDate(date: string, period: MonitorPeriod, direction: -1 | 1): string {
  const d = new Date(`${date}T12:00:00`);
  if (period === "daily") d.setDate(d.getDate() + direction);
  else if (period === "weekly") d.setDate(d.getDate() + 7 * direction);
  else d.setMonth(d.getMonth() + direction);
  return d.toISOString().slice(0, 10);
}

function datePickerLabel(period: MonitorPeriod): string {
  if (period === "weekly") return "Week of";
  if (period === "monthly") return "Month";
  return "Date";
}

export default function MonitorFilterBar({
  employees,
  selectedEmployee,
  onEmployeeChange,
  period,
  onPeriodChange,
  date,
  onDateChange,
  showEmployee = true,
  showPeriod = true,
  showDate = true,
  employeeRequired = false,
  rangeStart,
  rangeEnd,
}: MonitorFilterBarProps) {
  const today = todayKey();
  const rangeLabel = periodRangeLabel(period, date, rangeStart, rangeEnd);
  const selectedEmployeeName = employees.find((e) => e.id === selectedEmployee)?.name;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap items-center gap-2">
        {showEmployee && (
          <MonitorEmployeeSelect
            employees={employees}
            value={selectedEmployee}
            onChange={onEmployeeChange}
            required={employeeRequired}
          />
        )}

        {showPeriod && (
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white" data-tab-nav>
            {(Object.keys(PERIOD_LABELS) as MonitorPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                data-no-busy
                onClick={() => onPeriodChange(p)}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  period === p ? "bg-[#ff791a] text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        )}

        {showDate && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              data-no-busy
              onClick={() => onDateChange(shiftDate(date, period, -1))}
              className="p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              title={`Previous ${PERIOD_LABELS[period].toLowerCase()}`}
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex items-center gap-1.5 px-2 border-x border-slate-100">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <label className="sr-only">{datePickerLabel(period)}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="text-xs py-2 bg-transparent border-0 focus:ring-0 focus:outline-none text-slate-700 font-medium w-[118px]"
              />
            </div>
            <button
              type="button"
              data-no-busy
              onClick={() => onDateChange(shiftDate(date, period, 1))}
              className="p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              title={`Next ${PERIOD_LABELS[period].toLowerCase()}`}
            >
              <ChevronRight size={14} />
            </button>
            {date !== today && (
              <button
                type="button"
                data-no-busy
                onClick={() => onDateChange(today)}
                className="px-2.5 py-2 text-[10px] font-bold text-[#ff791a] hover:bg-orange-50 border-l border-slate-100"
              >
                Today
              </button>
            )}
          </div>
        )}
      </div>

      {(showPeriod || showDate) && (
        <p className="text-[10px] text-slate-500">
          <span className="font-semibold text-slate-600">{rangeLabel}</span>
          {period !== "daily" && rangeStart && rangeEnd && (
            <span className="text-slate-400">
              {" "}({formatAppDate(rangeStart)} – {formatAppDate(rangeEnd)})
            </span>
          )}
          {period === "daily" && date && (
            <span className="text-slate-400"> · {formatAppDate(date)}</span>
          )}
          {selectedEmployeeName && (
            <span className="text-slate-400"> · {selectedEmployeeName}</span>
          )}
        </p>
      )}
    </div>
  );
}
