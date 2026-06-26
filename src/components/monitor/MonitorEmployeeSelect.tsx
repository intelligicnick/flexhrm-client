import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, User, X } from "lucide-react";
import type { MonitoredEmployee } from "../../lib/monitor-api";

interface MonitorEmployeeSelectProps {
  employees: MonitoredEmployee[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  className?: string;
}

function employeeLabel(e: MonitoredEmployee): string {
  return `${e.name} (${e.employeeCode})${e.isOnline ? " · online" : ""}`;
}

export default function MonitorEmployeeSelect({
  employees,
  value,
  onChange,
  required = false,
  className = "",
}: MonitorEmployeeSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = employees.find((e) => e.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q),
    );
  }, [employees, query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const placeholder = required ? "Select employee" : "All employees";
  const displayValue = open ? query : selected ? employeeLabel(selected) : "";

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    onChange("");
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={`relative min-w-[220px] ${className}`}>
      <div
        className={`flex items-center gap-1.5 bg-white border rounded-lg px-2 transition-colors ${
          open ? "border-[#ff791a] ring-2 ring-[#ff791a]/20" : "border-slate-200"
        }`}
      >
        <User size={14} className="text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 text-xs py-2 bg-transparent border-0 focus:ring-0 focus:outline-none text-slate-700 font-medium min-w-0"
          autoComplete="off"
        />
        {value && !open && (
          <button
            type="button"
            data-no-busy
            onClick={clear}
            className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
            title="Clear selection"
          >
            <X size={12} />
          </button>
        )}
        <button
          type="button"
          data-no-busy
          onClick={() => {
            setOpen((o) => !o);
            if (!open) inputRef.current?.focus();
          }}
          className="p-0.5 text-slate-400 hover:text-slate-600"
          aria-label="Toggle employee list"
        >
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {!required && (
            <button
              type="button"
              data-no-busy
              onClick={() => pick("")}
              className={`w-full text-left px-3 py-2 text-xs font-semibold border-b border-slate-100 hover:bg-slate-50 ${
                !value ? "text-[#ff791a] bg-orange-50/50" : "text-slate-700"
              }`}
            >
              All employees
            </button>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50">
            <Search size={12} className="text-slate-400 shrink-0" />
            <span className="text-[10px] text-slate-400">Search by name or code</span>
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-xs text-slate-400 text-center">No employees match your search</li>
            ) : (
              filtered.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    data-no-busy
                    onClick={() => pick(e.id)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-b-0 ${
                      value === e.id ? "bg-orange-50/60" : ""
                    }`}
                  >
                    <div className={`font-semibold ${value === e.id ? "text-[#ff791a]" : "text-slate-800"}`}>
                      {e.name}
                      {e.isOnline && (
                        <span className="ml-1.5 text-[10px] font-bold text-emerald-600">online</span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      {e.employeeCode}
                      {e.location ? ` · ${e.location}` : ""}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
