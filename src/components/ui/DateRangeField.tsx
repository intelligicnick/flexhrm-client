import React from "react";
import { CalendarRange } from "lucide-react";
import { DateInput } from "./DateInput";
import { formatIsoDateRangeLabel } from "../../lib/date-helpers";

export interface DateRangeFieldOption {
  value: string;
  label: string;
}

export interface DateRangeFieldProps {
  title?: string;
  field: string;
  fieldOptions?: DateRangeFieldOption[];
  onFieldChange?: (value: string) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear?: () => void;
  maxDate?: string;
  className?: string;
}

export default function DateRangeField({
  title = "Date range",
  field,
  fieldOptions,
  onFieldChange,
  from,
  to,
  onFromChange,
  onToChange,
  onClear,
  maxDate,
  className = "",
}: DateRangeFieldProps) {
  const hasRange = Boolean(from || to);
  const summary = formatIsoDateRangeLabel(from, to);

  return (
    <div
      className={[
        "flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 shrink-0">
        <CalendarRange size={14} className="text-[#ff791a]" />
        {title}
      </div>

      {fieldOptions && fieldOptions.length > 0 && onFieldChange && (
        <select
          value={field}
          onChange={(e) => onFieldChange(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
        >
          {fieldOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
        <DateInput
          inlineLabel="From"
          value={from}
          max={to || maxDate}
          onChange={(e) => onFromChange(e.target.value)}
          aria-label="From date"
        />
        <span className="text-slate-400 text-xs font-semibold">to</span>
        <DateInput
          inlineLabel="To"
          value={to}
          min={from}
          max={maxDate}
          onChange={(e) => onToChange(e.target.value)}
          aria-label="To date"
        />
      </div>

      {hasRange && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-white cursor-pointer shrink-0"
        >
          Clear dates
        </button>
      )}

      {summary && (
        <p className="w-full sm:w-auto sm:ml-auto text-[10px] font-semibold text-slate-400">
          {summary}
        </p>
      )}
    </div>
  );
}
