import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  Download,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { apiUrl, parseApiError } from "../api";
import TypeToConfirmDialog from "./ui/TypeToConfirmDialog";

type BackupModuleCategory =
  | "core_hr"
  | "payroll"
  | "school"
  | "tenders"
  | "capture"
  | "system"
  | "archive";

interface BackupModuleSummary {
  id: string;
  label: string;
  category: BackupModuleCategory;
  categoryLabel: string;
  count: number;
}

interface BackupSummary {
  collectionCounts: Record<string, number>;
  modules: BackupModuleSummary[];
  totalDocuments: number;
  lastBackup?: {
    createdAt: string;
    createdBy: string;
    totalDocuments: number;
    collectionCount: number;
  };
}

interface BackupPayload {
  version: string;
  createdAt: string;
  createdBy: string;
  filters?: {
    fromDate?: string;
    toDate?: string;
    modules?: string[];
  };
  collections: Record<string, unknown[]>;
  stats: Record<string, number>;
}

interface BackupAndRestorePanelProps {
  readOnly?: boolean;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const CATEGORY_ORDER: BackupModuleCategory[] = [
  "core_hr",
  "payroll",
  "school",
  "tenders",
  "capture",
  "system",
  "archive",
];

export default function BackupAndRestorePanel({
  readOnly = false,
  onSuccess,
  onError,
}: BackupAndRestorePanelProps) {
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<BackupPayload | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [moduleSearch, setModuleSearch] = useState("");
  const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(apiUrl("/api/backup-restore/summary"), { credentials: "include" });
      if (!res.ok) throw await parseApiError(res, "Could not load backup summary.");
      setSummary((await res.json()) as BackupSummary);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not load backup summary.");
    } finally {
      setLoadingSummary(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const modules = useMemo(() => summary?.modules ?? [], [summary]);

  const hasDateFilter = Boolean(fromDate || toDate);

  const displayModules = useMemo(
    () =>
      modules.map((item) => ({
        ...item,
        count: hasDateFilter ? (moduleCounts[item.id] ?? 0) : item.count,
      })),
    [modules, moduleCounts, hasDateFilter],
  );

  useEffect(() => {
    if (!summary) return;
    if (!fromDate && !toDate) {
      setModuleCounts({});
      return;
    }
    if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) return;

    const timer = window.setTimeout(async () => {
      setLoadingCounts(true);
      try {
        const params = new URLSearchParams();
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        const res = await fetch(apiUrl(`/api/backup-restore/summary?${params}`), {
          credentials: "include",
        });
        if (!res.ok) throw await parseApiError(res, "Could not load filtered counts.");
        const filtered = (await res.json()) as BackupSummary;
        const counts: Record<string, number> = {};
        for (const item of filtered.modules ?? []) {
          counts[item.id] = item.count;
        }
        setModuleCounts(counts);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Could not load filtered counts.");
      } finally {
        setLoadingCounts(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [fromDate, toDate, summary, onError]);

  useEffect(() => {
    if (modules.length === 0) return;
    setSelectedModules((prev) => (prev.length > 0 ? prev : modules.map((item) => item.id)));
  }, [modules]);

  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return displayModules;
    return displayModules.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q),
    );
  }, [displayModules, moduleSearch]);

  const groupedModules = useMemo(() => {
    const groups = new Map<string, BackupModuleSummary[]>();
    for (const item of filteredModules) {
      const existing = groups.get(item.category) ?? [];
      existing.push(item);
      groups.set(item.category, existing);
    }
    return CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => ({
      category,
      label: groups.get(category)?.[0]?.categoryLabel ?? category,
      items: groups.get(category) ?? [],
    }));
  }, [filteredModules]);

  const selectedStats = useMemo(() => {
    const selected = displayModules.filter((item) => selectedModules.includes(item.id));
    return {
      modules: selected.length,
      documents: selected.reduce((sum, item) => sum + item.count, 0),
    };
  }, [displayModules, selectedModules]);

  const formatDate = (value?: string) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  };

  const handleDownloadBackup = async () => {
    if (readOnly) return;
    if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
      onError?.("To Date must be on or after From Date.");
      return;
    }
    if (selectedModules.length === 0) {
      onError?.("Select at least one table/module to download backup.");
      return;
    }
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      params.set("modules", selectedModules.join(","));
      const res = await fetch(apiUrl(`/api/backup-restore/export?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw await parseApiError(res, "Backup export failed.");

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `flexhrm-backup-${Date.now()}.json`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      onSuccess?.(
        `Backup downloaded — ${selectedStats.modules} table(s), ${selectedStats.documents} document(s).`,
      );
      await loadSummary();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Backup export failed.");
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || readOnly) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      if (!parsed.collections || typeof parsed.collections !== "object") {
        throw new Error("Invalid backup file — missing collection data.");
      }
      setPendingRestore(parsed);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not read backup file.");
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore || readOnly) return;
    setRestoring(true);
    try {
      const res = await fetch(apiUrl("/api/backup-restore/restore"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collections: pendingRestore.collections,
          includeSessions: false,
        }),
      });
      if (!res.ok) throw await parseApiError(res, "Restore failed.");
      const result = await res.json();
      onSuccess?.(
        `Restore completed — ${result.restoredDocuments ?? 0} document(s) across ${result.restoredCollections?.length ?? 0} table(s).`,
      );
      setPendingRestore(null);
      await loadSummary();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setRestoring(false);
    }
  };

  const pendingRestoreStats = useMemo(() => {
    if (!pendingRestore?.stats) return null;
    const collections = Object.keys(pendingRestore.stats).length;
    const documents = Object.values(pendingRestore.stats).reduce((sum, count) => sum + count, 0);
    return { collections, documents };
  }, [pendingRestore]);

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((item) => item !== moduleId) : [...prev, moduleId],
    );
  };

  const toggleCategory = (categoryItems: BackupModuleSummary[], selectAll: boolean) => {
    const ids = categoryItems.map((item) => item.id);
    setSelectedModules((prev) => {
      if (selectAll) {
        return [...new Set([...prev, ...ids])];
      }
      return prev.filter((id) => !ids.includes(id));
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
            <Database size={18} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-extrabold text-slate-800">Database Backup & Restore</h4>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Choose which tables to include, optionally filter by date range, then download a JSON
              backup. Restoring replaces data in each table from the backup file. Active login
              sessions are preserved during restore.
            </p>
            {summary?.lastBackup && (
              <p className="mt-2 text-[11px] font-semibold text-sky-700">
                Last backup: {formatDate(summary.lastBackup.createdAt)} by{" "}
                {summary.lastBackup.createdBy} · {summary.lastBackup.totalDocuments} document(s)
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
          <>
            <button
              type="button"
              onClick={() => void handleDownloadBackup()}
              disabled={downloading || selectedModules.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-60 cursor-pointer"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download Backup ({selectedStats.modules})
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 cursor-pointer"
            >
              {restoring ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Restore from File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleFileSelected(event)}
            />
          </>
        )}
      </div>

      {loadingSummary && !summary ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading backup tables...
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tables</p>
              <p className="mt-1 text-xl font-black text-slate-800 tabular-nums">{modules.length}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selected</p>
              <p className="mt-1 text-xl font-black text-sky-700 tabular-nums">
                {selectedStats.modules}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {hasDateFilter ? "Selected Docs (in range)" : "Selected Docs"}
              </p>
              <p className="mt-1 text-xl font-black text-slate-800 tabular-nums inline-flex items-center gap-2">
                {loadingCounts && hasDateFilter ? (
                  <Loader2 size={16} className="animate-spin text-sky-600" />
                ) : null}
                {selectedStats.documents}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                From Date
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                To Date
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                />
              </label>
            </div>
            {hasDateFilter && (
              <p className="text-[11px] font-semibold text-sky-700">
                Counts update to show only records within the selected date range.
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={moduleSearch}
                  onChange={(event) => setModuleSearch(event.target.value)}
                  placeholder="Search tables..."
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs font-medium text-slate-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[11px] font-bold text-sky-700 hover:text-sky-800 cursor-pointer"
                  onClick={() => setSelectedModules(displayModules.map((item) => item.id))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  onClick={() => setSelectedModules([])}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
              <HardDriveDownload size={16} className="text-sky-600" />
              <h4 className="text-sm font-extrabold text-slate-800">Select Tables to Backup</h4>
            </div>

            {groupedModules.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No tables match your search.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {groupedModules.map((group) => {
                  const allSelected = group.items.every((item) =>
                    selectedModules.includes(item.id),
                  );
                  const someSelected = group.items.some((item) =>
                    selectedModules.includes(item.id),
                  );
                  return (
                    <div key={group.category}>
                      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/80">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(input) => {
                              if (input) input.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={() => toggleCategory(group.items, !allSelected)}
                            className="rounded border-slate-300"
                          />
                          <span className="text-xs font-extrabold text-red-600">
                            {group.label}
                          </span>
                        </label>
                        <span className="text-[10px] font-bold text-slate-500">
                          {group.items.length} table(s)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
                        {group.items.map((item) => (
                          <label
                            key={item.id}
                            className={[
                              "bg-white px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-sky-50/40",
                              selectedModules.includes(item.id) ? "bg-sky-50/30" : "",
                            ].join(" ")}
                          >
                            <span className="inline-flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={selectedModules.includes(item.id)}
                                onChange={() => toggleModule(item.id)}
                                className="rounded border-slate-300 shrink-0"
                              />
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold text-slate-700 truncate">
                                  {item.label}
                                </span>
                                <span className="block text-[10px] font-mono text-slate-400 truncate">
                                  {item.id}
                                </span>
                              </span>
                            </span>
                            <span className="text-xs font-black text-slate-500 tabular-nums shrink-0 inline-flex items-center gap-1">
                              {loadingCounts && hasDateFilter ? (
                                <Loader2 size={12} className="animate-spin text-sky-500" />
                              ) : null}
                              {item.count}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      <TypeToConfirmDialog
        open={!!pendingRestore}
        title="Restore database backup"
        message={
          pendingRestore && pendingRestoreStats
            ? `This will permanently replace data in ${pendingRestoreStats.collections} table(s) with ${pendingRestoreStats.documents} document(s) from the backup created on ${formatDate(pendingRestore.createdAt)}. Active login sessions will be kept.`
            : ""
        }
        requiredConfirmText="RESTORE"
        confirmLabel="Restore backup"
        isLoading={restoring}
        onConfirm={() => void handleConfirmRestore()}
        onCancel={() => setPendingRestore(null)}
      />
    </div>
  );
}
