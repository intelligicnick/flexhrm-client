import React, { useState } from "react";
import { LucideIcon, Loader2 } from "lucide-react";
import { busyButtonClasses, inferLoadingLabel, normalizeButtonLabel } from "../../lib/button-loading";

export function SupervisorPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-1">
      <div className="min-w-0">
        <h1 className="text-lg font-black text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SupervisorStatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{children}</div>;
}

export function SupervisorStatCard({
  icon: Icon,
  label,
  value,
  accent = "orange",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: "orange" | "blue" | "emerald" | "slate";
}) {
  const accents = {
    orange: "bg-orange-50 text-[#ff791a] border-orange-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  };
  return (
    <div className={`rounded-2xl border p-3 ${accents[accent]}`}>
      <Icon size={16} className="mb-1.5 opacity-80" />
      <p className="text-lg font-black leading-none text-slate-900">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide mt-1 opacity-80">{label}</p>
    </div>
  );
}

export function SupervisorSection({
  title,
  action,
  children,
  className = "",
  scrollable = false,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden ${
        scrollable ? "flex flex-col max-h-[min(480px,calc(100dvh-280px))]" : ""
      } ${className}`}
    >
      {title && (
        <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">{title}</h2>
          {action}
        </div>
      )}
      <div className={scrollable ? "flex flex-col flex-1 min-h-0 p-4" : "p-4"}>{children}</div>
    </section>
  );
}

export function SupervisorEmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center py-10 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon size={22} className="text-slate-400" />
      </div>
      <p className="text-sm font-bold text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-1 max-w-[220px]">{hint}</p>}
    </div>
  );
}

export function SupervisorQuickAction({
  icon: Icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      data-no-busy
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl text-[11px] font-bold transition cursor-pointer ${
        variant === "primary"
          ? "bg-[#ff791a] text-white shadow-md shadow-orange-200/60"
          : "bg-white border border-slate-200 text-slate-600 hover:border-orange-200 hover:bg-orange-50/50"
      }`}
    >
      <Icon size={20} strokeWidth={2} />
      {label}
    </button>
  );
}

export function SupervisorSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-4 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-[#ff791a] bg-white placeholder:text-slate-400"
      />
    </div>
  );
}

export function SupervisorChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      data-no-busy
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
        active
          ? "bg-[#ff791a] text-white shadow-sm"
          : "bg-white border border-slate-200 text-slate-600 hover:border-orange-200"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1 ${active ? "text-orange-100" : "text-slate-400"}`}>({count})</span>
      )}
    </button>
  );
}

export function SupervisorLoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-9 h-9 rounded-full border-[3px] border-[#ff791a] border-t-transparent animate-spin" />
      <p className="text-sm text-slate-400 font-medium">{message}</p>
    </div>
  );
}

export function SupervisorFormStep({
  step,
  total,
  title,
  children,
}: {
  step: number;
  total: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ff791a] text-white text-xs font-black">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-[10px] text-slate-400 font-medium">
            Step {step} of {total}
          </p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function extractButtonText(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  const parts: string[] = [];
  React.Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      parts.push(String(child));
      return;
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      parts.push(extractButtonText(child.props.children));
    }
  });
  return normalizeButtonLabel(parts.join(" "));
}

const supervisorActionVariants = {
  primary:
    "bg-[#ff791a] hover:bg-[#e4640c] text-white shadow-lg shadow-orange-200/50 disabled:shadow-none",
  secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
  outline: "border-2 border-[#ff791a] text-[#ff791a] bg-white hover:bg-orange-50",
  danger: "bg-rose-600 hover:bg-rose-700 text-white",
  gradient:
    "bg-gradient-to-r from-[#ff791a] to-[#ff981a] text-white shadow-lg shadow-orange-200/60 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none",
} as const;

export type SupervisorActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: string;
  variant?: keyof typeof supervisorActionVariants;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
};

export function SupervisorActionButton({
  loading = false,
  loadingText,
  variant = "primary",
  fullWidth = false,
  icon,
  className = "",
  disabled,
  children,
  onClick,
  type = "button",
  ...props
}: SupervisorActionButtonProps) {
  const [internalBusy, setInternalBusy] = useState(false);
  const busy = loading || internalBusy;
  const idleLabel = extractButtonText(children);
  const busyLabel = loadingText ?? inferLoadingLabel(idleLabel);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (busy || disabled || !onClick) return;

    const result = onClick(event);
    if (!result || typeof result.then !== "function") return;

    setInternalBusy(true);
    try {
      await result;
    } finally {
      setInternalBusy(false);
    }
  };

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={handleClick}
      className={[
        "inline-flex items-center justify-center gap-2 font-bold rounded-xl transition active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed",
        busy ? busyButtonClasses : supervisorActionVariants[variant],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {busy ? (
        <>
          <Loader2 size={18} className="animate-spin shrink-0" />
          {busyLabel}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
