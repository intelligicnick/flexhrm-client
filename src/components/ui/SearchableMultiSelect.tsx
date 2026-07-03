import React, { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  formatMultiSelectSummary,
  toggleMultiSelectValue,
} from "../../lib/filter-helpers";

export interface SearchableMultiSelectProps {
  label?: string;
  labelClassName?: string;
  placeholder?: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
  searchPlaceholder?: string;
  clearLabel?: string;
  containerId?: string;
  buttonClassName?: string;
  className?: string;
}

export default function SearchableMultiSelect({
  label,
  labelClassName = "text-[11px] font-bold text-slate-500 uppercase tracking-wider block",
  placeholder = "All",
  options,
  selected,
  onChange,
  disabled = false,
  compact = false,
  searchPlaceholder = "Search...",
  clearLabel = "Clear",
  containerId,
  buttonClassName,
  className = "",
}: SearchableMultiSelectProps) {
  const generatedId = useId();
  const rootId = containerId || `searchable-multi-select-${generatedId}`;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, search]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const root = document.getElementById(rootId);
      if (root && !root.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, rootId]);

  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  const summary = formatMultiSelectSummary(selected, placeholder);
  const dropdownPanelClass = [
    "absolute left-0 top-full mt-1 z-50",
    "w-80 min-w-full max-w-[calc(100vw-1rem)]",
    "bg-white border border-slate-200 rounded-lg shadow-lg",
    "p-2 space-y-1 max-h-60 overflow-hidden flex flex-col",
  ].join(" ");

  const defaultButtonClass = compact
    ? "w-full py-2 pr-3 bg-transparent border-0 text-xs text-slate-700 focus:ring-0 focus:outline-none text-left flex justify-between items-center cursor-pointer disabled:opacity-60"
    : "w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-60";

  return (
    <div
      id={rootId}
      className={`relative ${isOpen ? "z-50" : ""} ${className}`}
    >
      {label ? <label className={labelClassName}>{label}</label> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className={buttonClassName || defaultButtonClass}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          size={compact ? 14 : 14}
          className={`text-slate-400 shrink-0 transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className={dropdownPanelClass}>
          <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5 gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={12} className="absolute left-2 top-2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-[#f57416]"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] font-bold uppercase text-slate-500 hover:text-slate-700 cursor-pointer shrink-0"
            >
              {clearLabel}
            </button>
          </div>

          <div className="overflow-y-auto space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-400">No matches found.</p>
            ) : (
              filteredOptions.map((option) => {
                const checked = selected.some(
                  (value) => value.toLowerCase() === option.toLowerCase(),
                );
                return (
                  <label
                    key={option}
                    className="flex items-start gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onChange(toggleMultiSelectValue(selected, option))}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#f57416] focus:ring-[#f57416] mt-0.5 shrink-0"
                    />
                    <span className="font-medium break-words leading-snug">{option}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
