import React from "react";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export function ObserverStatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}

export function ObserverStatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "orange",
  to,
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "orange" | "blue" | "emerald" | "rose" | "indigo" | "slate" | "amber";
  to?: string;
  alert?: boolean;
}) {
  const accents = {
    orange: "bg-orange-50 text-[#ff791a] border-orange-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <Icon size={18} className="opacity-80 shrink-0" />
        {alert && (
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-0.5 animate-pulse" />
        )}
      </div>
      <p className="text-xl font-black leading-tight text-slate-900 mt-2">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide mt-1 opacity-80">{label}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{sub}</p>}
    </>
  );

  const className = `rounded-2xl border p-3.5 text-left w-full transition ${
    accents[accent]
  } ${to ? "active:scale-[0.98] hover:shadow-sm" : ""} ${alert ? "ring-2 ring-red-200" : ""}`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function ObserverSection({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ObserverListRow({
  title,
  subtitle,
  value,
  badge,
  badgeTone = "slate",
  onClick,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  badge?: string;
  badgeTone?: "slate" | "red" | "amber" | "green" | "blue";
  onClick?: () => void;
}) {
  const badgeColors = {
    slate: "bg-slate-100 text-slate-600",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
  };

  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-3 py-3 border-b border-slate-100 last:border-0 text-left ${
        onClick ? "cursor-pointer active:bg-slate-50" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800 truncate">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>}
      </div>
      {badge && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeColors[badgeTone]}`}>
          {badge}
        </span>
      )}
      {value && <span className="text-sm font-black text-slate-700 shrink-0">{value}</span>}
    </Tag>
  );
}

export function ObserverMenuTile({
  icon: Icon,
  label,
  count,
  alert,
  to,
  color = "orange",
}: {
  icon: LucideIcon;
  label: string;
  count?: string | number;
  alert?: boolean;
  to: string;
  color?: "orange" | "blue" | "emerald" | "indigo" | "rose" | "amber" | "slate";
}) {
  const colors = {
    orange: "from-orange-500 to-orange-600",
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    indigo: "from-indigo-500 to-indigo-600",
    rose: "from-rose-500 to-rose-600",
    amber: "from-amber-500 to-amber-600",
    slate: "from-slate-600 to-slate-700",
  };

  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm active:scale-[0.97] transition ${
        alert ? "ring-2 ring-red-200" : ""
      }`}
    >
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white shadow-md relative`}>
        <Icon size={20} />
        {alert && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
        )}
      </div>
      <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{label}</span>
      {count !== undefined && (
        <span className="text-xs font-black text-slate-900 -mt-1">{count}</span>
      )}
    </Link>
  );
}

export function ObserverEmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center py-12 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon size={24} className="text-slate-400" />
      </div>
      <p className="text-sm font-bold text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-1 max-w-[240px]">{hint}</p>}
    </div>
  );
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
