import React from "react";

export interface MonitorSubNavItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

interface MonitorSubNavProps {
  items: MonitorSubNavItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function MonitorSubNav({ items, activeId, onChange }: MonitorSubNavProps) {
  if (items.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1 px-4 py-2 border-b border-slate-100 bg-slate-50/80">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              active
                ? "bg-white text-[#ff791a] shadow-xs border border-slate-200"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-800"
            }`}
          >
            {Icon && <Icon size={13} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
