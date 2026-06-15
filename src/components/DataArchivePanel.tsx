import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  Database,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { apiUrl, parseApiError } from "../api";

type ArchivableSource =
  | "school_visits"
  | "supervisor_activity_sessions"
  | "supervisor_requests"
  | "notifications"
  | "audit_logs"
  | "commitment_diary"
  | "planned_visits"
  | "sessions";

interface ArchiveSummary {
  retentionMonths: number;
  cutoffDate: string;
  autoRunEnabled: boolean;
  hotEligibleCounts: Record<string, number>;
  archivedCounts: Record<string, number>;
  labels: Record<ArchivableSource, string>;
  archiveInProgress: boolean;
  lastRun?: {
    id: string;
    completedAt?: string;
    totalArchived: number;
    countsBySource: Record<string, number>;
  };
  recentRuns: Array<{
    id: string;
    trigger: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    totalArchived: number;
    triggeredBy?: string;
  }>;
}

interface ArchivedRecordRow {
  id: string;
  sourceCollection: ArchivableSource;
  recordId: string;
  recordDate: string;
  archivedAt: string;
  hasOffloadedPhotos: boolean;
  preview: Record<string, unknown>;
}

interface DataArchivePanelProps {
  readOnly?: boolean;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function DataArchivePanel({
  readOnly = false,
  onSuccess,
  onError,
}: DataArchivePanelProps) {
  const [summary, setSummary] = useState<ArchiveSummary | null>(null);
  const [records, setRecords] = useState<ArchivedRecordRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [runningArchive, setRunningArchive] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<ArchivableSource | "">("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(apiUrl("/api/data-archive/summary"), { credentials: "include" });
      if (!res.ok) throw await parseApiError(res, "Could not load archive summary.");
      setSummary((await res.json()) as ArchiveSummary);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not load archive summary.");
    } finally {
      setLoadingSummary(false);
    }
  }, [onError]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams();
      if (selectedSource) params.set("source", selectedSource);
      params.set("limit", "100");
      const res = await fetch(apiUrl(`/api/data-archive/records?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw await parseApiError(res, "Could not load archived records.");
      setRecords((await res.json()) as ArchivedRecordRow[]);
      setSelectedIds([]);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not load archived records.");
    } finally {
      setLoadingRecords(false);
    }
  }, [onError, selectedSource]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const sourceOptions = useMemo(() => {
    if (!summary?.labels) return [];
    return Object.entries(summary.labels) as Array<[ArchivableSource, string]>;
  }, [summary]);

  const handleRunArchive = async () => {
    if (readOnly) return;
    setRunningArchive(true);
    try {
      const res = await fetch(apiUrl("/api/data-archive/run"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw await parseApiError(res, "Archive job failed.");
      const run = await res.json();
      onSuccess?.(`Archive completed — ${run.totalArchived ?? 0} record(s) moved to cold storage.`);
      await loadSummary();
      await loadRecords();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Archive job failed.");
    } finally {
      setRunningArchive(false);
    }
  };

  const handleRestore = async (archiveIds: string[]) => {
    if (readOnly || archiveIds.length === 0) return;
    setRestoringId(archiveIds.length === 1 ? archiveIds[0] : "bulk");
    try {
      const res = await fetch(apiUrl("/api/data-archive/restore"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveIds }),
      });
      if (!res.ok) throw await parseApiError(res, "Restore failed.");
      const result = await res.json();
      onSuccess?.(`Restored ${result.restoredCount ?? 0} record(s) to active storage.`);
      await loadSummary();
      await loadRecords();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setRestoringId(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
            <Database size={18} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-extrabold text-slate-800">6-Month Data Archiving</h4>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Records older than{" "}
              <strong>{summary?.retentionMonths ?? 6} months</strong> are moved from hot MongoDB
              collections to cold archive storage. Visit photos are offloaded to disk to keep the
              database lean. Archived data is still queryable when you filter by older dates, and
              can be restored here when needed.
            </p>
            {summary && (
              <p className="mt-2 text-[11px] font-semibold text-violet-700">
                Cutoff: {formatDate(summary.cutoffDate)} · Auto-run:{" "}
                {summary.autoRunEnabled ? "enabled (daily)" : "disabled"}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void loadSummary()}
          disabled={loadingSummary}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          {loadingSummary ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={() => void handleRunArchive()}
            disabled={runningArchive || summary?.archiveInProgress}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60 cursor-pointer"
          >
            {runningArchive ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run Archive Now
          </button>
        )}
        {!readOnly && selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => void handleRestore(selectedIds)}
            disabled={restoringId === "bulk"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
          >
            {restoringId === "bulk" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArchiveRestore size={14} />
            )}
            Restore Selected ({selectedIds.length})
          </button>
        )}
      </div>

      {loadingSummary && !summary ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading archive summary...
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sourceOptions.map(([source, label]) => (
            <div key={source} className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-800 tabular-nums">
                    {summary.archivedCounts[source] ?? 0}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500">archived</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-700 tabular-nums">
                    {summary.hotEligibleCounts[source] ?? 0}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500">ready to archive</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {summary?.lastRun && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span className="font-bold text-slate-700">Last completed run:</span>{" "}
          {formatDate(summary.lastRun.completedAt)} — {summary.lastRun.totalArchived} record(s)
        </div>
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-violet-600" />
            <h4 className="text-sm font-extrabold text-slate-800">Archived Records</h4>
          </div>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value as ArchivableSource | "")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="">All sources</option>
            {sourceOptions.map(([source, label]) => (
              <option key={source} value={source}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {loadingRecords ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading archived records...
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No archived records yet. Data older than 6 months will appear here after the next archive run.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  {!readOnly && <th className="px-3 py-2 w-8" />}
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Record</th>
                  <th className="px-3 py-2">Record Date</th>
                  <th className="px-3 py-2">Archived</th>
                  <th className="px-3 py-2">Preview</th>
                  {!readOnly && <th className="px-3 py-2 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((row) => {
                  const previewText = Object.values(row.preview || {})
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(" · ");
                  return (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      {!readOnly && (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelected(row.id)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        {summary?.labels[row.sourceCollection] || row.sourceCollection}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{row.recordId}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Calendar size={11} />
                          {formatDate(row.recordDate)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                        {formatDate(row.archivedAt)}
                        {row.hasOffloadedPhotos && (
                          <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
                            photos
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-[220px] truncate">{previewText || "—"}</td>
                      {!readOnly && (
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void handleRestore([row.id])}
                            disabled={restoringId === row.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer disabled:opacity-60"
                          >
                            {restoringId === row.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <ArchiveRestore size={12} />
                            )}
                            Restore
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
