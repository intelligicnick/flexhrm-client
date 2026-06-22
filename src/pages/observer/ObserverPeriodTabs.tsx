import React from "react";
import type { SchoolSupervisor } from "../../types";

export type ObserverPeriod = "day" | "week" | "month";

const PERIOD_OPTIONS: { key: ObserverPeriod; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

export function ObserverPeriodTabs({
  period,
  onPeriodChange,
}: {
  period: ObserverPeriod;
  onPeriodChange: (period: ObserverPeriod) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 w-full">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onPeriodChange(option.key)}
          className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
            period === option.key
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ObserverSupervisorSelect({
  supervisors,
  value,
  onChange,
}: {
  supervisors: Pick<SchoolSupervisor, "id" | "name">[];
  value: string;
  onChange: (supervisorId: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-100 cursor-pointer"
      aria-label="Filter by supervisor"
    >
      <option value="all">All supervisors</option>
      {supervisors.map((sup) => (
        <option key={sup.id} value={sup.id}>
          {sup.name}
        </option>
      ))}
    </select>
  );
}
