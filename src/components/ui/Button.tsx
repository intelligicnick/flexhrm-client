import React from "react";
import { Loader2 } from "lucide-react";
import { busyButtonClasses, inferLoadingLabel, normalizeButtonLabel } from "../../lib/button-loading";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary hover:bg-primary-dark text-white shadow-md shadow-primary/20",
  secondary:
    "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
  danger: "bg-rose-600 hover:bg-rose-700 text-white",
  ghost: "bg-transparent hover:bg-slate-50 text-slate-600",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-xs",
  lg: "px-5 py-2.5 text-sm",
};

function extractText(children: React.ReactNode): string {
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
      parts.push(extractText(child.props.children));
    }
  });
  return normalizeButtonLabel(parts.join(" "));
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  loadingText,
  className = "",
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const idleLabel = extractText(children);
  const busyLabel = loadingText ?? inferLoadingLabel(idleLabel);

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-1.5 font-bold rounded-lg transition active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        loading ? busyButtonClasses : variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin shrink-0" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
