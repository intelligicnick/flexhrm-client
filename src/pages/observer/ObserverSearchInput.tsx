import React from "react";
import { Search, X } from "lucide-react";

export default function ObserverSearchInput({
  value,
  onChange,
  placeholder = "Search this module…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-[#ff791a]/40 focus-within:ring-2 focus-within:ring-orange-100 transition">
      <Search size={16} className="text-slate-400 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none min-w-0"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-slate-400 hover:text-slate-600 cursor-pointer"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
