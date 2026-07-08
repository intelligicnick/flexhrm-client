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
    <div className="flex rounded-2xl bg-[#0C1E4A]/5 border border-slate-200 p-1 w-full gap-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          data-no-busy
          onClick={() => onPeriodChange(option.key)}
          className={`flex-1 px-2 py-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
            period === option.key
              ? "bg-[#0C1E4A] text-white shadow-md"
              : "text-slate-600 hover:bg-white hover:text-slate-800"
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
      className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-100 cursor-pointer"
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

export function ObserverDistrictSelect({
  districts,
  value,
  onChange,
}: {
  districts: string[];
  value: string;
  onChange: (district: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-100 cursor-pointer"
      aria-label="Filter by district"
    >
      <option value="all">All districts</option>
      {districts.map((district) => (
        <option key={district} value={district}>
          {district}
        </option>
      ))}
    </select>
  );
}

export function ObserverBlockSelect({
  blocks,
  value,
  onChange,
  disabled,
}: {
  blocks: string[];
  value: string;
  onChange: (block: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-100 cursor-pointer disabled:opacity-50"
      aria-label="Filter by block"
    >
      <option value="all">All blocks</option>
      {blocks.map((block) => (
        <option key={block} value={block}>
          {block}
        </option>
      ))}
    </select>
  );
}

export type VisitViewMode = "list" | "supervisor" | "district" | "block";

const VIEW_MODE_OPTIONS: { key: VisitViewMode; label: string }[] = [
  { key: "list", label: "List" },
  { key: "supervisor", label: "Supervisor" },
  { key: "district", label: "District" },
  { key: "block", label: "Block" },
];

export function ObserverVisitViewModeTabs({
  mode,
  onModeChange,
}: {
  mode: VisitViewMode;
  onModeChange: (mode: VisitViewMode) => void;
}) {
  return (
    <div className="flex rounded-2xl bg-slate-50 border border-slate-200 p-1 w-full gap-1 overflow-x-auto">
      {VIEW_MODE_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          data-no-busy
          onClick={() => onModeChange(option.key)}
          className={`flex-1 min-w-[4.5rem] px-2 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer whitespace-nowrap ${
            mode === option.key
              ? "bg-white text-[#0C1E4A] shadow-sm border border-slate-200"
              : "text-slate-600 hover:bg-white hover:text-slate-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
