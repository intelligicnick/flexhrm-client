import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { busyButtonClasses, inferLoadingLabel, normalizeButtonLabel } from "../../lib/button-loading";
import { Button, type ButtonProps } from "./Button";

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

export interface AsyncButtonProps extends Omit<ButtonProps, "loading" | "onClick"> {
  loadingText?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
}

export function AsyncButton({
  children,
  loadingText,
  onClick,
  className = "",
  disabled,
  ...props
}: AsyncButtonProps) {
  const [busy, setBusy] = useState(false);
  const idleLabel = extractText(children);
  const busyLabel = loadingText ?? inferLoadingLabel(idleLabel);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (busy || disabled || !onClick) return;

    const result = onClick(event);
    if (!result || typeof result.then !== "function") return;

    setBusy(true);
    try {
      await result;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      {...props}
      disabled={disabled || busy}
      loading={busy}
      loadingText={busyLabel}
      className={[className, busy ? busyButtonClasses : ""].filter(Boolean).join(" ")}
      onClick={handleClick}
    >
      {children}
    </Button>
  );
}

export function AsyncButtonSpinner({ className = "" }: { className?: string }) {
  return <Loader2 size={16} className={["animate-spin shrink-0", className].filter(Boolean).join(" ")} />;
}
