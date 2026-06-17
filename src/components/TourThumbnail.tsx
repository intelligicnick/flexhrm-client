import React from "react";
import type { LucideIcon } from "lucide-react";

const THEMES: Record<
  string,
  { from: string; to: string; accent: string; ring: string }
> = {
  employees: { from: "#fff7ed", to: "#ffedd5", accent: "#ff791a", ring: "#fed7aa" },
  attendance: { from: "#eff6ff", to: "#dbeafe", accent: "#2563eb", ring: "#bfdbfe" },
  salary: { from: "#ecfdf5", to: "#d1fae5", accent: "#059669", ring: "#a7f3d0" },
  ledger: { from: "#faf5ff", to: "#ede9fe", accent: "#7c3aed", ring: "#ddd6fe" },
  leave: { from: "#f0fdfa", to: "#ccfbf1", accent: "#0d9488", ring: "#99f6e4" },
  directory: { from: "#fdf2f8", to: "#fce7f3", accent: "#db2777", ring: "#fbcfe8" },
  schoolWork: { from: "#fffbeb", to: "#fef3c7", accent: "#d97706", ring: "#fde68a" },
  bids: { from: "#f8fafc", to: "#e2e8f0", accent: "#475569", ring: "#cbd5e1" },
  roleAccess: { from: "#fff1f2", to: "#ffe4e6", accent: "#e11d48", ring: "#fecdd3" },
  supervisorApp: { from: "#f0f9ff", to: "#e0f2fe", accent: "#0284c7", ring: "#bae6fd" },
  portalTips: { from: "#f1f5f9", to: "#e2e8f0", accent: "#334155", ring: "#cbd5e1" },
};

interface TourThumbnailProps {
  sectionId: string;
  title: string;
  icon: LucideIcon;
  stepIndex?: number;
  stepTitle?: string;
  totalSteps?: number;
  compact?: boolean;
}

export default function TourThumbnail({
  sectionId,
  title,
  icon: Icon,
  stepIndex = 0,
  stepTitle,
  totalSteps = 1,
  compact = false,
}: TourThumbnailProps) {
  const theme = THEMES[sectionId] ?? THEMES.portalTips;
  const progress = totalSteps > 1 ? ((stepIndex + 1) / totalSteps) * 100 : 100;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border shadow-sm ${
        compact ? "aspect-[16/10]" : "aspect-[16/9] md:aspect-[2/1]"
      }`}
      style={{
        background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
        borderColor: theme.ring,
      }}
    >
      {/* faux browser chrome */}
      <div className="absolute inset-x-0 top-0 h-7 bg-white/70 backdrop-blur-sm border-b border-white/60 flex items-center gap-1.5 px-3">
        <span className="w-2 h-2 rounded-full bg-rose-300" />
        <span className="w-2 h-2 rounded-full bg-amber-300" />
        <span className="w-2 h-2 rounded-full bg-emerald-300" />
        <span className="ml-2 text-[9px] font-bold text-slate-400 truncate flex-1">
          FlexHRM · {title}
        </span>
      </div>

      <div className="absolute inset-0 pt-7 flex">
        {/* faux sidebar */}
        <div className="w-[22%] bg-slate-900/90 m-2 mt-3 rounded-lg p-2 space-y-1.5 hidden sm:block">
          <div className="h-1.5 w-8 rounded bg-orange-400/80" />
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded ${i === 1 ? "w-full bg-white/30" : "w-3/4 bg-white/10"}`}
            />
          ))}
        </div>

        {/* faux content */}
        <div className="flex-1 p-3 pt-4 sm:pl-1 flex flex-col justify-between min-w-0">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md"
              style={{ backgroundColor: theme.accent, color: "white" }}
            >
              <Icon size={compact ? 18 : 22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500">
                Step {stepIndex + 1} of {totalSteps}
              </p>
              <p className="text-xs sm:text-sm font-extrabold text-slate-800 truncate mt-0.5">
                {stepTitle ?? title}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-white/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: theme.accent }}
                />
              </div>
            </div>
          </div>

          {/* faux table rows */}
          <div className="mt-3 space-y-1.5 hidden sm:block">
            {[0.9, 0.7, 0.55].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="h-2 rounded bg-white/70"
                  style={{ width: `${w * 100}%` }}
                />
                <div
                  className="h-2 w-6 rounded shrink-0"
                  style={{
                    backgroundColor: i === 0 ? theme.accent : "rgba(255,255,255,0.5)",
                    opacity: i === 0 ? 0.35 : 1,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* step badge */}
      <div
        className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow"
        style={{ backgroundColor: theme.accent }}
      >
        {stepIndex + 1}/{totalSteps}
      </div>
    </div>
  );
}
