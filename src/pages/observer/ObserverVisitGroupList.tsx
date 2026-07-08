import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { EnrichedSchoolVisit, VisitGroup } from "../../lib/visit-enrichment";
import { ObserverListRow } from "./ObserverUI";

function formatDate(d: string): string {
  if (!d?.trim()) return "—";
  const parts = d.split("-");
  if (parts.length === 3) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[Number(parts[1]) - 1] || parts[1];
    return `${Number(parts[2])} ${month} ${parts[0]}`;
  }
  return d;
}

function VisitRows({
  visits,
  onVisitClick,
}: {
  visits: EnrichedSchoolVisit[];
  onVisitClick: (visit: EnrichedSchoolVisit) => void;
}) {
  return (
    <>
      {visits.map((v) => (
        <ObserverListRow
          key={v.id}
          title={v.schoolName}
          subtitle={`${v.supervisorName} · ${formatDate(v.visitDate)} · ${v.block || "—"}`}
          badge={v.status}
          badgeTone={v.status === "pending" ? "amber" : v.status === "approved" ? "green" : "slate"}
          onClick={() => onVisitClick(v)}
        />
      ))}
    </>
  );
}

function GroupSection({
  group,
  depth = 0,
  onVisitClick,
  defaultOpen = true,
}: {
  group: VisitGroup;
  depth?: number;
  onVisitClick: (visit: EnrichedSchoolVisit) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = Boolean(group.children?.length);
  const count = group.visits.length;

  if (depth === 0 && !hasChildren && group.key === "all") {
    return <VisitRows visits={group.visits} onVisitClick={onVisitClick} />;
  }

  const paddingLeft = depth === 0 ? "" : depth === 1 ? "pl-3" : "pl-5";

  return (
    <div className={paddingLeft}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left cursor-pointer transition ${
          depth === 0
            ? "border-slate-200 bg-slate-50 hover:bg-slate-100 mb-2"
            : "border-slate-100 bg-white hover:bg-slate-50 mb-1.5"
        }`}
      >
        {open ? (
          <ChevronDown size={14} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-slate-500 shrink-0" />
        )}
        <span
          className={`flex-1 truncate font-bold ${
            depth === 0 ? "text-sm text-slate-800" : "text-xs text-slate-700"
          }`}
        >
          {group.label}
        </span>
        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0C1E4A]/10 text-[#0C1E4A]">
          {count}
        </span>
      </button>
      {open && (
        <div className={depth === 0 ? "space-y-1 mb-3" : "space-y-1 mb-2"}>
          {hasChildren ? (
            group.children!.map((child) => (
              <GroupSection
                key={child.key}
                group={child}
                depth={depth + 1}
                onVisitClick={onVisitClick}
                defaultOpen={depth < 1}
              />
            ))
          ) : (
            <VisitRows visits={group.visits} onVisitClick={onVisitClick} />
          )}
        </div>
      )}
    </div>
  );
}

export function ObserverVisitGroupList({
  groups,
  onVisitClick,
}: {
  groups: VisitGroup[];
  onVisitClick: (visit: EnrichedSchoolVisit) => void;
}) {
  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <GroupSection key={group.key} group={group} onVisitClick={onVisitClick} />
      ))}
    </div>
  );
}
