import React, { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  List,
  XCircle,
} from "lucide-react";
import { CommitmentDiary, SchoolSupervisor, SchoolWork } from "../types";
import { getCalendarDays, toIsoDate } from "../lib/supervisor-dates";

interface CommitmentDiaryPanelProps {
  commitments: CommitmentDiary[];
  supervisors?: SchoolSupervisor[];
  schools?: SchoolWork[];
  onUpdate: (
    id: string,
    patch: {
      status?: CommitmentDiary["status"];
      adminNotes?: string;
      notes?: string;
    },
  ) => Promise<boolean>;
  readOnly?: boolean;
}

type EnrichedCommitment = CommitmentDiary & {
  schoolName: string;
  supervisorName: string;
  block: string;
};

type DayStats = {
  total: number;
  committed: number;
  in_progress: number;
  completed: number;
  overdue: number;
};

function formatDateRange(fromDate: string, toDate: string): string {
  const fmt = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  return fromDate === toDate
    ? fmt(fromDate)
    : `${fmt(fromDate)} – ${fmt(toDate)}`;
}

function formatDayLabel(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: CommitmentDiary["status"] }) {
  const styles: Record<CommitmentDiary["status"], string> = {
    committed: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-amber-100 text-amber-800 border-amber-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const labels: Record<CommitmentDiary["status"], string> = {
    committed: "Committed",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[status]}`}
    >
      {status === "completed" && <CheckCircle size={10} />}
      {status === "cancelled" && <XCircle size={10} />}
      {labels[status]}
    </span>
  );
}

function resolveSchoolLabel(entry: CommitmentDiary, schools: SchoolWork[]): string {
  const stored = String(entry.schoolName || "").trim();
  if (stored) return stored;
  const school = schools.find((row) => row.id === entry.schoolWorkId);
  const name = String(school?.schoolName || "").trim();
  if (name) return name;
  const udise = String(school?.udise || entry.schoolWorkId || "").trim();
  return udise ? `UDISE ${udise}` : entry.schoolWorkId;
}

function resolveSupervisorLabel(
  entry: CommitmentDiary,
  supervisors: SchoolSupervisor[],
): string {
  const stored = String(entry.supervisorName || "").trim();
  const supervisor = supervisors.find((row) => row.id === entry.supervisorId);
  if (supervisor?.name) return supervisor.name;
  if (stored && !/^\d{10}$/.test(stored)) return stored;
  return supervisor?.phone || stored || entry.supervisorId;
}

function buildCommitmentByDate(
  rows: EnrichedCommitment[],
  today: string,
): Map<string, { entries: EnrichedCommitment[]; stats: DayStats }> {
  const map = new Map<string, { entries: EnrichedCommitment[]; stats: DayStats }>();

  const ensure = (iso: string) => {
    if (!map.has(iso)) {
      map.set(iso, {
        entries: [],
        stats: { total: 0, committed: 0, in_progress: 0, completed: 0, overdue: 0 },
      });
    }
    return map.get(iso)!;
  };

  for (const entry of rows) {
    if (entry.status === "cancelled") continue;
    const cursor = new Date(entry.fromDate + "T12:00:00");
    const end = new Date(entry.toDate + "T12:00:00");
    while (cursor <= end) {
      const iso = toIsoDate(cursor);
      const bucket = ensure(iso);
      if (!bucket.entries.some((row) => row.id === entry.id)) {
        bucket.entries.push(entry);
        bucket.stats.total += 1;
        if (entry.status === "committed") bucket.stats.committed += 1;
        if (entry.status === "in_progress") bucket.stats.in_progress += 1;
        if (entry.status === "completed") bucket.stats.completed += 1;
        if (
          entry.status !== "completed" &&
          entry.toDate < today
        ) {
          bucket.stats.overdue += 1;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return map;
}

function dayCellTint(stats: DayStats): string {
  if (stats.overdue > 0) return "bg-rose-50 border-rose-200 text-rose-900";
  if (stats.in_progress > 0) return "bg-amber-50 border-amber-200 text-amber-900";
  if (stats.committed > 0) return "bg-blue-50 border-blue-200 text-blue-900";
  if (stats.completed > 0) return "bg-emerald-50 border-emerald-200 text-emerald-900";
  return "bg-white border-slate-100 text-slate-700";
}

function CommitmentEntryCard({
  entry,
  expandedId,
  setExpandedId,
  editNotes,
  setEditNotes,
  editAdminNotes,
  setEditAdminNotes,
  submittingId,
  onUpdate,
  readOnly,
  onSave,
  onStatus,
}: {
  entry: EnrichedCommitment;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  editNotes: Record<string, string>;
  setEditNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editAdminNotes: Record<string, string>;
  setEditAdminNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submittingId: string | null;
  onUpdate: CommitmentDiaryPanelProps["onUpdate"];
  readOnly: boolean;
  onSave: (id: string) => Promise<void>;
  onStatus: (id: string, status: CommitmentDiary["status"]) => Promise<void>;
}) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => {
          setExpandedId(expandedId === entry.id ? null : entry.id);
          setEditNotes((prev) => ({ ...prev, [entry.id]: entry.notes || "" }));
          setEditAdminNotes((prev) => ({
            ...prev,
            [entry.id]: entry.adminNotes || "",
          }));
        }}
        className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2 cursor-pointer"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[10px] font-bold border border-orange-200">
              {formatDateRange(entry.fromDate, entry.toDate)}
            </span>
            <StatusBadge status={entry.status} />
          </div>
          <span className="font-bold text-slate-800 text-sm block mt-1">
            {entry.supervisorName}
          </span>
          <span className="text-xs text-slate-600 block mt-0.5 truncate">
            {entry.schoolName}
            {entry.block ? ` · ${entry.block}` : ""}
          </span>
        </div>
      </button>
      {expandedId === entry.id && (
        <div className="p-3 space-y-3 text-xs">
          {entry.notes && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="font-bold text-slate-500 block mb-1">
                Supervisor Notes
              </span>
              <p className="text-slate-700 whitespace-pre-wrap">{entry.notes}</p>
            </div>
          )}
          {entry.adminNotes && entry.status !== "committed" && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="font-bold text-emerald-700 block mb-1">
                Admin Notes
              </span>
              <p className="text-emerald-900 whitespace-pre-wrap">
                {entry.adminNotes}
              </p>
            </div>
          )}
          <p className="text-[10px] text-slate-400">
            Last updated by {entry.lastUpdatedBy} ({entry.lastUpdatedByRole})
          </p>
          {!readOnly && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div>
                <label className="font-bold text-slate-500 block mb-1">
                  Supervisor Notes (editable)
                </label>
                <textarea
                  value={editNotes[entry.id] ?? entry.notes ?? ""}
                  onChange={(e) =>
                    setEditNotes((prev) => ({
                      ...prev,
                      [entry.id]: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">
                  Admin Notes
                </label>
                <textarea
                  value={editAdminNotes[entry.id] ?? entry.adminNotes ?? ""}
                  onChange={(e) =>
                    setEditAdminNotes((prev) => ({
                      ...prev,
                      [entry.id]: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Add admin remarks or follow-up..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submittingId === entry.id}
                  onClick={() => onSave(entry.id)}
                  className="px-3 py-1.5 bg-[#ff791a] text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60"
                >
                  Save Updates
                </button>
                {(entry.status === "committed") && (
                  <button
                    type="button"
                    disabled={submittingId === entry.id}
                    onClick={() => onStatus(entry.id, "in_progress")}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    Mark In Progress
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CommitmentDiaryPanel({
  commitments,
  supervisors = [],
  schools = [],
  onUpdate,
  readOnly = false,
}: CommitmentDiaryPanelProps) {
  const today = toIsoDate(new Date());
  const todayDate = new Date();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [blockFilter, setBlockFilter] = useState("");
  const [supervisorFilter, setSupervisorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [editAdminNotes, setEditAdminNotes] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const enriched = useMemo(
    () =>
      commitments.map((entry) => ({
        ...entry,
        schoolName: resolveSchoolLabel(entry, schools),
        supervisorName: resolveSupervisorLabel(entry, supervisors),
        block: entry.block || schools.find((row) => row.id === entry.schoolWorkId)?.block || "",
      })),
    [commitments, schools, supervisors],
  );

  const blocks = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((c) => c.block && set.add(c.block));
    return Array.from(set).sort();
  }, [enriched]);

  const supervisorOptions = useMemo(() => {
    const map = new Map<string, string>();
    enriched.forEach((c) => {
      if (c.supervisorId) map.set(c.supervisorId, c.supervisorName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [enriched]);

  const filtered = useMemo(() => {
    let rows = [...enriched];
    if (statusFilter) rows = rows.filter((c) => c.status === statusFilter);
    if (blockFilter) rows = rows.filter((c) => c.block === blockFilter);
    if (supervisorFilter) rows = rows.filter((c) => c.supervisorId === supervisorFilter);
    return rows.sort((a, b) => {
      const aTime = new Date(a.fromDate + "T12:00:00").getTime();
      const bTime = new Date(b.fromDate + "T12:00:00").getTime();
      if (aTime !== bTime) return bTime - aTime;
      return (a.supervisorName || "").localeCompare(b.supervisorName || "");
    });
  }, [enriched, blockFilter, supervisorFilter, statusFilter]);

  const commitmentByDate = useMemo(
    () => buildCommitmentByDate(filtered, today),
    [filtered, today],
  );

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(viewYear, viewMonth, 1));

  const monthCommitmentCount = useMemo(() => {
    const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    let count = 0;
    for (const [iso, bucket] of commitmentByDate) {
      if (iso.startsWith(monthKey)) count += bucket.stats.total;
    }
    return count;
  }, [commitmentByDate, viewMonth, viewYear]);

  const selectedDayEntries = useMemo(() => {
    if (!selectedDate) return [];
    const bucket = commitmentByDate.get(selectedDate);
    if (!bucket) return [];
    return [...bucket.entries].sort((a, b) =>
      a.supervisorName.localeCompare(b.supervisorName),
    );
  }, [selectedDate, commitmentByDate]);

  const listGroupedByDate = useMemo(() => {
    const groups = new Map<string, EnrichedCommitment[]>();
    for (const entry of filtered) {
      if (entry.status === "cancelled") continue;
      const list = groups.get(entry.fromDate) || [];
      list.push(entry);
      groups.set(entry.fromDate, list);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, entries]) => ({ date, entries }));
  }, [filtered]);

  const handleSave = async (id: string) => {
    setSubmittingId(id);
    const ok = await onUpdate(id, {
      adminNotes: editAdminNotes[id] ?? "",
      notes: editNotes[id],
    });
    setSubmittingId(null);
    if (ok) setExpandedId(null);
  };

  const handleStatus = async (id: string, status: CommitmentDiary["status"]) => {
    setSubmittingId(id);
    await onUpdate(id, { status });
    setSubmittingId(null);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const entryCardProps = {
    expandedId,
    setExpandedId,
    editNotes,
    setEditNotes,
    editAdminNotes,
    setEditAdminNotes,
    submittingId,
    onUpdate,
    readOnly,
    onSave: handleSave,
    onStatus: handleStatus,
  };

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="mb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <BookOpen className="text-[#ff791a]" size={18} />
            Commitment Diary
          </h2>
          <p className="text-xs text-slate-400">
            Daily and date-range visit commitments submitted by supervisors. Completed entries appear in the Visits tab after the supervisor submits a geo-tagged field visit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-md cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500"
              }`}
            >
              <CalendarDays size={12} />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-md cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500"
              }`}
            >
              <List size={12} />
              List
            </button>
          </div>
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer"
          >
            <option value="">All Blocks</option>
            {blocks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            value={supervisorFilter}
            onChange={(e) => setSupervisorFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer"
          >
            <option value="">All Supervisors</option>
            {supervisorOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="committed">Committed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-10 text-sm">
          No commitment diary entries yet. Supervisors add these from the mobile calendar when they commit visit dates.
        </p>
      ) : viewMode === "calendar" ? (
        <div className="grid lg:grid-cols-[minmax(280px,340px)_1fr] gap-5">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 text-slate-500 hover:bg-white rounded-lg cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <h3 className="font-black text-slate-900 text-sm">{monthLabel}</h3>
                <p className="text-[10px] text-slate-400 font-bold">
                  {monthCommitmentCount} commitment{monthCommitmentCount === 1 ? "" : "s"} this month
                </p>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 text-slate-500 hover:bg-white rounded-lg cursor-pointer"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3 text-[9px] font-bold">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Committed
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> In Progress
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Overdue
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
              {weekDays.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="min-h-[52px]" />;
                const iso = toIsoDate(day);
                const bucket = commitmentByDate.get(iso);
                const stats = bucket?.stats;
                const count = stats?.total || 0;
                const isToday = iso === today;
                const isSelected = iso === selectedDate;
                const tint = stats ? dayCellTint(stats) : "bg-white border-slate-100 text-slate-700";

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDate(iso)}
                    className={`min-h-[52px] rounded-lg border p-1 flex flex-col items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? "ring-2 ring-[#ff791a] ring-offset-1 bg-orange-50 border-orange-200"
                        : isToday
                          ? "border-orange-300 bg-orange-50/80"
                          : tint
                    }`}
                  >
                    <span className="text-[11px] font-black leading-none">{day.getDate()}</span>
                    {count > 0 ? (
                      <div className="w-full space-y-0.5 mt-1">
                        <span className="block w-full text-center text-[9px] font-black px-1 py-0.5 rounded bg-slate-900/80 text-white">
                          {count > 99 ? "99+" : count}
                        </span>
                        <div className="flex gap-0.5 justify-center">
                          {stats!.overdue > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          )}
                          {stats!.in_progress > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          )}
                          {stats!.committed > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          )}
                          {stats!.completed > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="h-4" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-3 sticky top-0 bg-white/95 backdrop-blur-sm py-1 z-10">
              <div>
                <h3 className="font-black text-slate-900 text-sm">
                  {selectedDate ? formatDayLabel(selectedDate) : "Select a date"}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">
                  {selectedDayEntries.length} commitment
                  {selectedDayEntries.length === 1 ? "" : "s"}
                </p>
              </div>
              {selectedDate && selectedDate !== today && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(today)}
                  className="text-[10px] font-bold text-[#ff791a] cursor-pointer"
                >
                  Go to today
                </button>
              )}
            </div>

            {selectedDayEntries.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-12 border border-dashed border-slate-200 rounded-xl">
                No commitments on this date. Pick another day on the calendar.
              </p>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {selectedDayEntries.map((entry) => (
                  <CommitmentEntryCard
                    key={`${selectedDate}-${entry.id}`}
                    entry={entry}
                    {...entryCardProps}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {listGroupedByDate.map(({ date, entries }) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2 sticky top-0 bg-white/95 backdrop-blur-sm py-1.5 z-10">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">
                  {formatDayLabel(date)}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {entries.length} commitment{entries.length === 1 ? "" : "s"}
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <CommitmentEntryCard
                    key={entry.id}
                    entry={entry}
                    {...entryCardProps}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
