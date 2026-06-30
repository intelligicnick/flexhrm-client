import React from "react";
import { DATE_INPUT_CLASS, parseFlexibleDateToIso } from "../../lib/date-helpers";

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  inlineLabel?: string;
}

export function DateInput({
  label,
  inlineLabel,
  id,
  className = "",
  value,
  ...props
}: DateInputProps) {
  const inputId = id || props.name;
  const isoValue =
    value === undefined || value === null
      ? undefined
      : parseFlexibleDateToIso(String(value));

  const input = (
    <input
      id={inputId}
      type="date"
      className={[DATE_INPUT_CLASS, className].filter(Boolean).join(" ")}
      value={isoValue}
      {...props}
    />
  );

  if (inlineLabel) {
    return (
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <span className="font-semibold whitespace-nowrap">{inlineLabel}</span>
        {input}
      </label>
    );
  }

  if (label) {
    return (
      <label htmlFor={inputId} className="block w-full">
        <span className="text-xs font-bold text-slate-600 block mb-1">{label}</span>
        {input}
      </label>
    );
  }

  return input;
}

export interface TimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export function TimeInput({ label, id, className = "", ...props }: TimeInputProps) {
  const inputId = id || props.name;
  const input = (
    <input
      id={inputId}
      type="time"
      className={[DATE_INPUT_CLASS, className].filter(Boolean).join(" ")}
      {...props}
    />
  );

  if (!label) return input;

  return (
    <label htmlFor={inputId} className="block w-full">
      <span className="text-xs font-bold text-slate-600 block mb-1">{label}</span>
      {input}
    </label>
  );
}

export interface DateTimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export function DateTimeInput({ label, id, className = "", ...props }: DateTimeInputProps) {
  const inputId = id || props.name;
  const input = (
    <input
      id={inputId}
      type="datetime-local"
      className={[DATE_INPUT_CLASS, className].filter(Boolean).join(" ")}
      {...props}
    />
  );

  if (!label) return input;

  return (
    <label htmlFor={inputId} className="block w-full">
      <span className="text-xs font-bold text-slate-600 block mb-1">{label}</span>
      {input}
    </label>
  );
}
