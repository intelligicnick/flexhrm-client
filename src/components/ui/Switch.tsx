import React, { startTransition, useEffect, useRef, useState } from "react";

type SwitchSize = "sm" | "md";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: SwitchSize;
  deferUpdate?: boolean;
}

const sizeClasses: Record<SwitchSize, { track: string; thumb: string; on: string; off: string }> = {
  sm: {
    track: "h-4 w-7",
    thumb: "h-3 w-3",
    on: "translate-x-3.5",
    off: "translate-x-0.5",
  },
  md: {
    track: "h-5 w-9",
    thumb: "h-4 w-4",
    on: "translate-x-4",
    off: "translate-x-0.5",
  },
};

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  size = "sm",
  deferUpdate = true,
  className = "",
  disabled = false,
  ...props
}: SwitchProps) {
  const isControlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? checked ?? false);
  const renderedChecked = isControlled ? checked : internalChecked;
  const [optimisticChecked, setOptimisticChecked] = useState(renderedChecked);
  const transitionFrameRef = useRef<number | null>(null);
  const transitionCommitRef = useRef<number | null>(null);

  useEffect(() => {
    setOptimisticChecked(renderedChecked);
  }, [renderedChecked]);

  useEffect(() => {
    return () => {
      if (transitionFrameRef.current !== null) {
        window.cancelAnimationFrame(transitionFrameRef.current);
      }
      if (transitionCommitRef.current !== null) {
        window.cancelAnimationFrame(transitionCommitRef.current);
      }
    };
  }, []);

  const classes = sizeClasses[size];

  const handleClick = () => {
    if (disabled) {
      return;
    }

    const nextChecked = !optimisticChecked;
    setOptimisticChecked(nextChecked);
    if (!isControlled) {
      setInternalChecked(nextChecked);
    }

    if (deferUpdate) {
      if (transitionFrameRef.current !== null) {
        window.cancelAnimationFrame(transitionFrameRef.current);
      }
      if (transitionCommitRef.current !== null) {
        window.cancelAnimationFrame(transitionCommitRef.current);
      }

      // Give the thumb one paint before the expensive table relayout starts.
      transitionFrameRef.current = window.requestAnimationFrame(() => {
        transitionCommitRef.current = window.requestAnimationFrame(() => {
          startTransition(() => {
            onCheckedChange?.(nextChecked);
          });
        });
      });
      return;
    }

    onCheckedChange?.(nextChecked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimisticChecked}
      disabled={disabled}
      onClick={handleClick}
      className={[
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-150 ease-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        classes.track,
        optimisticChecked ? "bg-[#f57416]" : "bg-slate-300",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <span
        className={[
          "inline-block rounded-full bg-white shadow will-change-transform transition-transform duration-150 ease-out motion-reduce:transition-none",
          classes.thumb,
          optimisticChecked ? classes.on : classes.off,
        ].join(" ")}
      />
    </button>
  );
}
