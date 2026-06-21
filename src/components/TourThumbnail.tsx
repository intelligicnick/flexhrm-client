import React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { getTourThumbnailMock } from "../lib/tour-thumbnail-mocks";
import type { TourFormField } from "../lib/tour-thumbnail-forms";
import TourClickHotspot from "./TourClickHotspot";

const THEMES: Record<
  string,
  { from: string; to: string; accent: string; ring: string }
> = {
  gettingStarted: { from: "#f1f5f9", to: "#e2e8f0", accent: "#334155", ring: "#cbd5e1" },
  dashboard: { from: "#fff7ed", to: "#ffedd5", accent: "#ff791a", ring: "#fed7aa" },
  employees: { from: "#fff7ed", to: "#ffedd5", accent: "#ff791a", ring: "#fed7aa" },
  attendance: { from: "#eff6ff", to: "#dbeafe", accent: "#2563eb", ring: "#bfdbfe" },
  salary: { from: "#ecfdf5", to: "#d1fae5", accent: "#059669", ring: "#a7f3d0" },
  savedBulkPay: { from: "#f5f3ff", to: "#ede9fe", accent: "#6d28d9", ring: "#ddd6fe" },
  ledger: { from: "#faf5ff", to: "#ede9fe", accent: "#7c3aed", ring: "#ddd6fe" },
  leave: { from: "#f0fdfa", to: "#ccfbf1", accent: "#0d9488", ring: "#99f6e4" },
  directory: { from: "#fdf2f8", to: "#fce7f3", accent: "#db2777", ring: "#fbcfe8" },
  birthdays: { from: "#fdf4ff", to: "#fae8ff", accent: "#a855f7", ring: "#e9d5ff" },
  schoolWork: { from: "#fffbeb", to: "#fef3c7", accent: "#d97706", ring: "#fde68a" },
  fieldTeam: { from: "#ecfeff", to: "#cffafe", accent: "#0891b2", ring: "#a5f3fc" },
  bids: { from: "#f8fafc", to: "#e2e8f0", accent: "#475569", ring: "#cbd5e1" },
  renewals: { from: "#fef2f2", to: "#fee2e2", accent: "#dc2626", ring: "#fecaca" },
  bgDd: { from: "#f0fdf4", to: "#dcfce7", accent: "#16a34a", ring: "#bbf7d0" },
  roleAccess: { from: "#fff1f2", to: "#ffe4e6", accent: "#e11d48", ring: "#fecdd3" },
  supervisorApp: { from: "#f0f9ff", to: "#e0f2fe", accent: "#0284c7", ring: "#bae6fd" },
  monthlyPayroll: { from: "#ecfdf5", to: "#d1fae5", accent: "#059669", ring: "#a7f3d0" },
  portalTips: { from: "#f1f5f9", to: "#e2e8f0", accent: "#334155", ring: "#cbd5e1" },
};

interface TourThumbnailProps {
  sectionId: string;
  title: string;
  icon: LucideIcon;
  stepIndex?: number;
  stepTitle?: string;
  totalSteps?: number;
  compact?: boolean;
}

function MiniFormField({
  field,
  compact,
  delay,
}: {
  field: TourFormField;
  compact: boolean;
  delay: number;
}) {
  const fsSm = compact ? "text-[5px]" : "text-[6px] sm:text-[7px]";
  const isSelect = field.type === "select";
  const isEmpty = !field.value?.trim();

  return (
    <div className={`relative ${field.span === 2 ? "col-span-2" : ""}`}>
      <label className={`${fsSm} font-bold text-slate-500 block mb-0.5 leading-tight`}>
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        className={`relative flex items-center min-h-[14px] sm:min-h-[16px] border rounded px-1 py-0.5 ${
          field.highlight
            ? "border-orange-400 bg-orange-50/90 ring-1 ring-orange-300/60"
            : "border-slate-200 bg-white"
        }`}
      >
        <span
          className={`${fsSm} flex-1 truncate ${
            isEmpty ? "text-slate-300 italic" : "text-slate-800 font-medium"
          }`}
        >
          {isEmpty ? "—" : field.value}
        </span>
        {isSelect && (
          <ChevronDown size={compact ? 7 : 8} className="text-slate-400 shrink-0 ml-0.5" />
        )}
        {field.highlight && <TourClickHotspot compact={compact} delay={delay} label="Click" />}
      </div>
    </div>
  );
}

export default function TourThumbnail({
  sectionId,
  title,
  icon: Icon,
  stepIndex = 0,
  stepTitle,
  totalSteps = 1,
  compact = false,
}: TourThumbnailProps) {
  const theme = THEMES[sectionId] ?? THEMES.gettingStarted;
  const progress = totalSteps > 1 ? ((stepIndex + 1) / totalSteps) * 100 : 100;
  const mock = getTourThumbnailMock(sectionId, stepIndex);
  const isMobileApp = sectionId === "supervisorApp";
  const fs = compact ? "text-[6px]" : "text-[7px] sm:text-[8px]";
  const fsSm = compact ? "text-[5.5px]" : "text-[6px] sm:text-[7px]";

  const highlightCellSet = new Set(
    (mock.table?.highlightCells ?? []).map((c) => `${c.row}-${c.col}`),
  );

  const visibleFormFields = mock.formFields?.slice(0, compact ? 4 : 8) ?? [];
  let hotspotDelay = 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border shadow-sm ${
        compact ? "aspect-[16/10]" : "aspect-[16/9] md:aspect-[2/1]"
      }`}
      style={{
        background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
        borderColor: theme.ring,
      }}
    >
      {/* Browser chrome */}
      <div className="absolute inset-x-0 top-0 h-6 sm:h-7 bg-white/80 backdrop-blur-sm border-b border-slate-200/80 flex items-center gap-1 px-2 sm:px-3 z-10">
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-300" />
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-300" />
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-300" />
        <span className={`ml-1.5 ${fs} font-bold text-slate-500 truncate flex-1`}>
          {mock.windowTitle}
        </span>
      </div>

      <div className="absolute inset-0 pt-6 sm:pt-7 flex flex-col">
        {/* Orange month bar — matches real portal header */}
        {mock.showMonthBar && !isMobileApp && (
          <div className="relative h-4 sm:h-5 bg-[#ff791a] flex items-center justify-end gap-1.5 px-2 shrink-0">
            <span className={`${fsSm} font-black uppercase text-orange-100/90`}>Month:</span>
            <span className="relative">
              <span className={`${fs} font-bold text-white bg-white/15 px-1 rounded`}>
                {mock.month} ▾
              </span>
              {mock.formFields?.some((f) => f.label === "Month" && f.highlight) && (
                <TourClickHotspot compact={compact} label="Click" />
              )}
            </span>
            <span className={`${fsSm} font-black uppercase text-orange-100/90 ml-1`}>Year:</span>
            <span className="relative">
              <span className={`${fs} font-bold text-white bg-white/15 px-1 rounded`}>
                {mock.year} ▾
              </span>
              {mock.formFields?.some((f) => f.label === "Financial Year" && f.highlight) && (
                <TourClickHotspot compact={compact} delay={200} label="Click" />
              )}
            </span>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* Sidebar — white like real FlexHRM */}
          {!isMobileApp && mock.sidebarItems.length > 0 && (
            <div className="w-[26%] sm:w-[24%] bg-white border-r border-slate-200 m-1 mt-1.5 rounded-md overflow-hidden hidden sm:flex flex-col shrink-0">
              <div className="px-1.5 py-1 border-b border-slate-100 flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-[#ff791a] text-white text-[5px] font-black flex items-center justify-center">
                  F
                </span>
                <span className={`${fsSm} font-extrabold text-slate-700 truncate`}>
                  Flex <span className="text-[#ff791a]">HRM</span>
                </span>
              </div>
              <div className="p-1 space-y-0.5 flex-1 overflow-hidden">
                {mock.sidebarItems.slice(0, compact ? 5 : 8).map((item, idx) => {
                  const active = item === mock.activeSidebar || item.startsWith(mock.activeSidebar);
                  const isClickTarget =
                    mock.highlightSidebarIndex === idx ||
                    (active && mock.highlightSidebarIndex === undefined && idx > 0);
                  return (
                    <div
                      key={item}
                      className={`relative px-1 py-0.5 rounded ${fsSm} font-semibold truncate ${
                        active
                          ? "bg-orange-50 text-[#ff791a]"
                          : "text-slate-500"
                      }`}
                    >
                      {item}
                      {isClickTarget && mock.highlightSidebarIndex !== undefined && (
                        <TourClickHotspot compact={compact} delay={idx * 100} label="Click" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main content mock */}
          <div className="flex-1 flex flex-col min-w-0 p-1.5 sm:p-2 pt-1 overflow-hidden">
            {/* Step overlay header */}
            <div className="flex items-start gap-1.5 sm:gap-2 mb-1 shrink-0">
              <div
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                style={{ backgroundColor: theme.accent, color: "white" }}
              >
                <Icon size={compact ? 12 : 14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`${fsSm} font-black uppercase tracking-wider text-slate-500`}>
                  Step {stepIndex + 1} of {totalSteps}
                </p>
                <p className={`${fs} font-extrabold text-slate-800 truncate`}>
                  {stepTitle ?? title}
                </p>
                <div className="mt-0.5 h-1 rounded-full bg-white/70 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%`, backgroundColor: theme.accent }}
                  />
                </div>
              </div>
            </div>

            {/* Realistic UI mock — mirrors live forms & tables */}
            <div
              className={`flex-1 min-h-0 rounded-md border border-white/80 bg-white/95 overflow-hidden flex flex-col ${
                isMobileApp ? "mx-1" : ""
              }`}
            >
              {mock.subTabs && (
                <div className="flex gap-0.5 px-1 py-0.5 border-b border-slate-100 bg-white shrink-0 overflow-x-auto">
                  {mock.subTabs.map((tab, idx) => {
                    const showHotspot = tab.clickTarget || (tab.active && idx > 0);
                    return (
                      <span
                        key={tab.label}
                        className={`relative px-1 py-0.5 rounded ${fsSm} font-bold whitespace-nowrap ${
                          tab.active
                            ? "bg-orange-50 text-[#ff791a] border border-orange-200"
                            : "text-slate-500"
                        }`}
                      >
                        {tab.label}
                        {showHotspot && tab.clickTarget && (
                          <TourClickHotspot compact={compact} delay={idx * 150} label="Click" />
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="p-1 sm:p-1.5 flex-1 min-h-0 overflow-hidden flex flex-col gap-1">
                {mock.heading && (
                  <div className="shrink-0">
                    <p className={`${fs} font-extrabold text-slate-800 truncate`}>{mock.heading}</p>
                    {mock.subheading && (
                      <p className={`${fsSm} text-slate-500 truncate`}>{mock.subheading}</p>
                    )}
                  </div>
                )}

                {mock.toolbar && mock.toolbar.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 shrink-0">
                    {mock.toolbar.slice(0, compact ? 3 : 5).map((item, idx) => {
                      hotspotDelay += 120;
                      return (
                        <span
                          key={item.label}
                          className={`relative ${fsSm} px-1 py-0.5 rounded border truncate max-w-full ${
                            item.kind === "search"
                              ? "border-slate-200 bg-slate-50 text-slate-400 italic flex-1 min-w-[35%]"
                              : item.highlight
                                ? "border-orange-300 bg-orange-50 text-[#ff791a] font-bold ring-1 ring-orange-200"
                                : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {item.label}
                          {item.highlight && (
                            <TourClickHotspot
                              compact={compact}
                              delay={hotspotDelay}
                              label={item.kind === "button" ? "Click" : "Click"}
                            />
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                {mock.cards && mock.cards.length > 0 && (
                  <div className="grid grid-cols-2 gap-0.5 shrink-0">
                    {mock.cards.slice(0, compact ? 2 : 4).map((card, idx) => (
                      <div
                        key={card.label}
                        className={`relative rounded border px-1 py-0.5 ${
                          card.highlight
                            ? "border-orange-200 bg-orange-50/80"
                            : "border-slate-100 bg-slate-50/80"
                        }`}
                      >
                        <p className={`${fsSm} text-slate-400 font-bold truncate`}>{card.label}</p>
                        <p className={`${fs} font-black text-slate-800 truncate`}>{card.value}</p>
                        {card.highlight && (
                          <TourClickHotspot compact={compact} delay={idx * 100} label="Click" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {visibleFormFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-1 shrink-0 overflow-hidden">
                    {visibleFormFields.map((field, idx) => (
                      <MiniFormField
                        key={`${field.label}-${idx}`}
                        field={field}
                        compact={compact}
                        delay={idx * 180}
                      />
                    ))}
                  </div>
                )}

                {mock.panelLines &&
                  mock.panelLines.length > 0 &&
                  !mock.table &&
                  !mock.formFields?.length && (
                    <div className="space-y-0.5 shrink-0">
                      {mock.panelLines.slice(0, compact ? 3 : 5).map((line) => (
                        <p key={line} className={`${fsSm} text-slate-600 truncate`}>
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                {mock.table && !mock.formFields?.length && (
                  <div className="flex-1 min-h-0 overflow-hidden rounded border border-slate-200 bg-white">
                    <div className="overflow-x-auto h-full">
                      <table className={`w-full border-collapse ${fsSm}`}>
                        <thead>
                          <tr className="bg-slate-100 text-slate-600">
                            {mock.table.headers.slice(0, compact ? 5 : 8).map((h) => (
                              <th
                                key={h}
                                className="px-0.5 py-0.5 border-r border-slate-200 font-bold text-left truncate max-w-[2.5rem] sm:max-w-[3.5rem]"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mock.table.rows.slice(0, compact ? 2 : 3).map((row, ri) => (
                            <tr key={ri} className="border-t border-slate-100 text-slate-700">
                              {row.slice(0, compact ? 5 : 8).map((cell, ci) => {
                                const isHighlight = highlightCellSet.has(`${ri}-${ci}`);
                                return (
                                  <td
                                    key={ci}
                                    className={`relative px-0.5 py-0.5 border-r border-slate-50 truncate max-w-[2.5rem] sm:max-w-[3.5rem] ${
                                      isHighlight
                                        ? "bg-orange-100 text-[#ff791a] font-black ring-1 ring-inset ring-orange-300"
                                        : ""
                                    }`}
                                  >
                                    {cell}
                                    {isHighlight && (
                                      <TourClickHotspot
                                        compact={compact}
                                        delay={300}
                                        label="Click"
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Form + table combo: form on top, compact grid below */}
                {mock.table && mock.formFields && mock.formFields.length > 0 && (
                  <div className="flex-1 min-h-0 overflow-hidden rounded border border-slate-200 bg-white mt-0.5">
                    <table className={`w-full border-collapse ${fsSm}`}>
                      <thead>
                        <tr className="bg-slate-100 text-slate-600">
                          {mock.table.headers.slice(0, compact ? 6 : 8).map((h) => (
                            <th key={h} className="px-0.5 py-0.5 border-r border-slate-200 font-bold truncate">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mock.table.rows.slice(0, compact ? 1 : 2).map((row, ri) => (
                          <tr key={ri}>
                            {row.slice(0, compact ? 6 : 8).map((cell, ci) => {
                              const isHighlight = highlightCellSet.has(`${ri}-${ci}`);
                              return (
                                <td
                                  key={ci}
                                  className={`relative px-0.5 py-0.5 border-t border-slate-100 truncate ${
                                    isHighlight
                                      ? "bg-orange-100 text-[#ff791a] font-black"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {cell}
                                  {isHighlight && (
                                    <TourClickHotspot compact={compact} delay={400} label="Click" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click legend */}
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 z-10">
        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-slate-900/85 text-white text-[6px] sm:text-[7px] font-bold shadow">
          <span className="w-2 h-2 rounded-full bg-[#ff791a] tour-click-hotspot-tap inline-block" />
          Click here
        </span>
      </div>

      <div
        className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black text-white shadow z-10"
        style={{ backgroundColor: theme.accent }}
      >
        {stepIndex + 1}/{totalSteps}
      </div>
    </div>
  );
}
