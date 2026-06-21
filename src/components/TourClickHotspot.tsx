import React from "react";
import { MousePointer2 } from "lucide-react";

interface TourClickHotspotProps {
  label?: string;
  compact?: boolean;
  /** Stagger animation delay in ms */
  delay?: number;
}

/** Animated click cursor overlay — pulsing ring + tap motion (GIF-like) */
export default function TourClickHotspot({
  label = "Click",
  compact = false,
  delay = 0,
}: TourClickHotspotProps) {
  const iconSize = compact ? 8 : 10;

  return (
    <span
      className="absolute z-30 pointer-events-none select-none"
      style={{
        top: compact ? "-2px" : "-4px",
        right: compact ? "-2px" : "-4px",
        animationDelay: `${delay}ms`,
      }}
      aria-hidden
    >
      <span className="relative flex items-center justify-center">
        <span
          className="absolute rounded-full bg-[#ff791a]/35 tour-click-hotspot-ring"
          style={{
            width: compact ? 14 : 18,
            height: compact ? 14 : 18,
            animationDelay: `${delay}ms`,
          }}
        />
        <span
          className="relative rounded-full bg-[#ff791a] border-2 border-white shadow-md text-white flex items-center justify-center tour-click-hotspot-tap"
          style={{
            width: compact ? 12 : 15,
            height: compact ? 12 : 15,
            animationDelay: `${delay}ms`,
          }}
        >
          <MousePointer2 size={iconSize} className="fill-white/20" />
        </span>
      </span>
      {label && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-black uppercase tracking-wide bg-slate-900 text-white rounded shadow-lg ${
            compact ? "top-[13px] text-[4px] px-0.5 py-px" : "top-[17px] text-[5px] sm:text-[6px] px-1 py-0.5"
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
