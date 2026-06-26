import React from "react";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  sub?: string;
}

export function KpiCard({ label, value, icon: Icon, color = "text-[#ff791a]", sub }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
        <Icon size={14} className={color} /> {label}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    trial: "bg-amber-100 text-amber-700",
    suspended: "bg-red-100 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
    paid: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
    open: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{message}</div>
  );
}
