import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  id,
  className = "",
  ...props
}: InputProps) {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-bold text-slate-600 block mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          "w-full px-3 py-2 border border-slate-200 rounded-lg",
          "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30",
          "text-xs text-slate-800 transition bg-white",
          error ? "border-rose-400" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
