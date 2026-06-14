import React from "react";
import { CalendarDays, CalendarRange, ChevronDown, RotateCcw } from "lucide-react";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import {
  createDefaultHistoryFilter,
  getHistoryFilterSummary,
  getMonthOptions,
  resolveHistoryFilterBounds,
  SupervisorHistoryFilter,
  SupervisorHistoryFilterMode,
  toIsoDate,
} from "../../lib/supervisor-dates";

interface SupervisorDateFilterProps {
  filter: SupervisorHistoryFilter;
  onChange: (filter: SupervisorHistoryFilter) => void;
  visitCount?: number;
}

type FilterTab = "quick" | "month" | "custom" | "range";

const QUICK_MODES: SupervisorHistoryFilterMode[] = ["day", "week", "month"];

function getActiveTab(mode: SupervisorHistoryFilterMode): FilterTab {
  if (QUICK_MODES.includes(mode)) return "quick";
  if (mode === "selectMonth") return "month";
  if (mode === "customDate") return "custom";
  return "range";
}

export default function SupervisorDateFilter({ filter, onChange, visitCount }: SupervisorDateFilterProps) {
  const { t, lang } = useSupervisorI18n();
  const [tab, setTab] = React.useState<FilterTab>(() => getActiveTab(filter.mode));
  const monthOptions = React.useMemo(() => getMonthOptions(24, lang), [lang]);
  const today = toIsoDate(new Date());
  const bounds = resolveHistoryFilterBounds(filter);

  React.useEffect(() => {
    setTab(getActiveTab(filter.mode));
  }, [filter.mode]);

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: "quick", label: t("quickFilter"), icon: <CalendarDays size={14} /> },
    { key: "month", label: t("pickMonth"), icon: <CalendarDays size={14} /> },
    { key: "custom", label: t("customDate"), icon: <CalendarDays size={14} /> },
    { key: "range", label: t("dateRange"), icon: <CalendarRange size={14} /> },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#ff791a] to-[#ff981a] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-100/90">
              {t("filterByDate")}
            </p>
            <p className="text-sm font-black text-white truncate mt-0.5">
              {getHistoryFilterSummary(filter, lang)}
            </p>
          </div>
          {visitCount !== undefined && (
            <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black text-white">
              {visitCount} {t("visitsCount")}
            </span>
          )}
        </div>
        {bounds.fromDate && bounds.toDate && bounds.fromDate !== bounds.toDate && (
          <p className="text-[10px] text-orange-100/80 mt-1 font-medium">
            {bounds.fromDate} → {bounds.toDate}
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 border-b border-slate-100">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-col items-center gap-1 py-2.5 px-1 text-[9px] font-bold transition cursor-pointer border-b-2 ${
              tab === key
                ? "border-[#ff791a] text-[#ff791a] bg-orange-50/60"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {icon}
            <span className="leading-tight text-center">{label}</span>
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "quick" && (
          <div className="flex gap-2">
            {QUICK_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ ...filter, mode })}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition cursor-pointer ${
                  filter.mode === mode
                    ? "bg-[#ff791a] text-white shadow-md shadow-orange-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t(mode)}
              </button>
            ))}
          </div>
        )}

        {tab === "month" && (
          <div className="relative">
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <select
              value={filter.mode === "selectMonth" ? filter.monthKey : ""}
              onChange={(e) => {
                const monthKey = e.target.value;
                if (!monthKey) return;
                onChange({ ...filter, mode: "selectMonth", monthKey });
              }}
              className="w-full appearance-none px-4 py-3.5 pr-10 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 bg-slate-50 cursor-pointer focus:border-[#ff791a] focus:outline-none"
            >
              <option value="">{t("selectMonth")}</option>
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {tab === "custom" && (
          <input
            type="date"
            value={filter.mode === "customDate" ? filter.customDate : ""}
            max={today}
            onChange={(e) => {
              const customDate = e.target.value;
              if (!customDate) return;
              onChange({ ...filter, mode: "customDate", customDate });
            }}
            className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 bg-slate-50 focus:border-[#ff791a] focus:outline-none"
          />
        )}

        {tab === "range" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                  {t("fromDate")}
                </label>
                <input
                  type="date"
                  value={filter.fromDate}
                  max={filter.toDate || today}
                  onChange={(e) => {
                    const fromDate = e.target.value;
                    if (!fromDate) return;
                    onChange({
                      ...filter,
                      mode: "dateRange",
                      fromDate,
                      toDate: filter.toDate && filter.toDate >= fromDate ? filter.toDate : fromDate,
                    });
                  }}
                  className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:border-[#ff791a] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                  {t("toDate")}
                </label>
                <input
                  type="date"
                  value={filter.toDate}
                  min={filter.fromDate}
                  max={today}
                  onChange={(e) => {
                    const toDate = e.target.value;
                    if (!toDate) return;
                    onChange({
                      ...filter,
                      mode: "dateRange",
                      toDate,
                      fromDate: filter.fromDate && filter.fromDate <= toDate ? filter.fromDate : toDate,
                    });
                  }}
                  className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:border-[#ff791a] focus:outline-none"
                />
              </div>
            </div>
            {filter.mode === "dateRange" && filter.fromDate && filter.toDate && (
              <p className="text-[10px] text-center text-slate-400 font-bold">
                {filter.fromDate === filter.toDate
                  ? getHistoryFilterSummary({ ...filter, mode: "customDate", customDate: filter.fromDate }, lang)
                  : getHistoryFilterSummary(filter, lang)}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onChange(createDefaultHistoryFilter());
            setTab("quick");
          }}
          className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold text-slate-500 border border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:text-slate-700 transition"
        >
          <RotateCcw size={12} />
          {t("resetFilters")}
        </button>
      </div>
    </div>
  );
}
