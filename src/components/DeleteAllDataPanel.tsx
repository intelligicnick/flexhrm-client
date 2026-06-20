import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { apiUrl, parseApiError } from "../api";

interface DeleteAllDataPanelProps {
  readOnly?: boolean;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

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

interface BackupModulePreview extends BackupModuleSummary {
  fields: string[];
  fieldCount: number;
}

interface BackupSummary {
  collectionCounts: Record<string, number>;
  modules: BackupModuleSummary[];
  totalDocuments: number;
}

interface BackupPreview {
  tables: number;
  totalRows: number;
  totalFields: number;
  modules: BackupModulePreview[];
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

function PreviewStatCard({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string | number;
  accent?: "slate" | "sky" | "rose";
}) {
  const accentClass =
    accent === "sky"
      ? "text-sky-700 bg-sky-50 border-sky-100"
      : accent === "rose"
        ? "text-rose-700 bg-rose-50 border-rose-100"
        : "text-slate-700 bg-slate-50 border-slate-100";

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accentClass}`}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-black mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

export default function DeleteAllDataPanel({
  readOnly = false,
  onSuccess,
  onError,
}: DeleteAllDataPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [backupFirst, setBackupFirst] = useState(true);
  const [typedText, setTypedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [moduleSearch, setModuleSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(apiUrl("/api/backup-restore/summary"), { credentials: "include" });
      if (!res.ok) throw await parseApiError(res, "Could not load module list.");
      const data = (await res.json()) as BackupSummary;
      setSummary(data);
      setSelectedModules((prev) =>
        prev.length > 0 ? prev : (data.modules ?? []).map((item) => item.id),
      );
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not load module list.");
    } finally {
      setLoadingSummary(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (selectedModules.length === 0) {
      setPreview(null);
      return;
    }

    const controller = new AbortController();
    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        const params = new URLSearchParams();
        params.set("modules", selectedModules.join(","));
        const res = await fetch(apiUrl(`/api/backup-restore/summary?${params}`), {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw await parseApiError(res, "Could not load delete preview.");
        const data = (await res.json()) as BackupSummary;
        const selected = (data.modules ?? []).filter((item) => selectedModules.includes(item.id));
        setPreview({
          tables: selected.length,
          totalRows: selected.reduce((sum, item) => sum + item.count, 0),
          totalFields: 0,
          modules: selected.map((item) => ({
            ...item,
            fields: [],
            fieldCount: 0,
          })),
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        onError?.(err instanceof Error ? err.message : "Could not load backup preview.");
      } finally {
        if (!controller.signal.aborted) setLoadingPreview(false);
      }
    };

    void loadPreview();
    return () => controller.abort();
  }, [selectedModules, onError]);

  const modules = useMemo(() => summary?.modules ?? [], [summary]);

  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q),
    );
  }, [modules, moduleSearch]);

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

  const allSelected = useMemo(
    () => modules.length > 0 && selectedModules.length === modules.length,
    [modules.length, selectedModules.length],
  );

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((item) => item !== moduleId) : [...prev, moduleId],
    );
  };

  const toggleCategory = (categoryItems: BackupModuleSummary[], selectAll: boolean) => {
    const ids = categoryItems.map((item) => item.id);
    setSelectedModules((prev) => {
      if (selectAll) return [...new Set([...prev, ...ids])];
      return prev.filter((id) => !ids.includes(id));
    });
  };

  const toggleExpanded = (moduleId: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId],
    );
  };

  const closeDialog = () => {
    if (isDeleting) return;
    setDialogOpen(false);
    setTypedText("");
    setBackupFirst(true);
  };

  const downloadBackup = async () => {
    const params = new URLSearchParams();
    if (selectedModules.length > 0) {
      params.set("modules", selectedModules.join(","));
    }
    const route = params.toString()
      ? `/api/backup-restore/export?${params.toString()}`
      : "/api/backup-restore/export";
    const res = await fetch(apiUrl(route), { credentials: "include" });
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
  };

  const handleDeleteAllData = async () => {
    if (typedText !== "DELETE" || readOnly || selectedModules.length === 0) return;
    setIsDeleting(true);
    try {
      if (backupFirst) {
        await downloadBackup();
      }
      const res = await fetch(apiUrl("/api/backup-restore/clear-all"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeSessions: false, modules: selectedModules }),
      });
      if (!res.ok) throw await parseApiError(res, "Could not delete all data.");
      const result = await res.json();
      onSuccess?.(
        `Selected module data deleted successfully — ${result.clearedDocuments ?? 0} row(s) cleared from ${result.clearedCollections?.length ?? 0} table(s).`,
      );
      closeDialog();
      await loadSummary();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not delete all data.");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderPreviewSummary = (compact = false) => {
    if (loadingPreview && !preview) {
      return (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 size={14} className="animate-spin" /> Calculating backup size...
        </div>
      );
    }
    if (!preview) return null;

    return (
      <div className="space-y-3">
        <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
          <PreviewStatCard label="Tables" value={preview.tables} accent="sky" />
          <PreviewStatCard label="Rows" value={preview.totalRows.toLocaleString("en-IN")} />
          <PreviewStatCard label="Columns" value={preview.totalFields.toLocaleString("en-IN")} accent="rose" />
        </div>

        {!compact && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
              <Database size={16} className="text-sky-600" />
              <h5 className="text-sm font-extrabold text-slate-800">Backup Preview by Table</h5>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2 w-8" />
                    <th className="px-3 py-2">Table</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Rows</th>
                    <th className="px-3 py-2 text-right">Columns</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.modules.map((item) => {
                    const expanded = expandedModules.includes(item.id);
                    return (
                      <React.Fragment key={item.id}>
                        <tr className="border-t border-slate-100 hover:bg-slate-50/60">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(item.id)}
                              className="rounded p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                              aria-label={expanded ? "Hide columns" : "Show columns"}
                            >
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-800">{item.label}</p>
                            <p className="text-[10px] font-mono text-slate-400">{item.id}</p>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{item.categoryLabel}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-700 tabular-nums">
                            {item.count.toLocaleString("en-IN")}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-700 tabular-nums">
                            {item.fieldCount}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-t border-slate-50 bg-slate-50/50">
                            <td colSpan={5} className="px-4 py-3">
                              {item.fields.length === 0 ? (
                                <p className="text-[11px] text-slate-500">No columns — table is empty.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {item.fields.map((field) => (
                                    <span
                                      key={field}
                                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-mono text-slate-600"
                                    >
                                      {field}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-extrabold text-slate-800">Delete All Data</h4>
            <p className="mt-1 text-xs text-slate-700 leading-relaxed">
              Select tables to delete. Review the backup preview below — tables, rows, and columns —
              before confirming. Login sessions are preserved.
            </p>
            <p className="mt-2 text-[11px] font-semibold text-rose-700">
              Use this only when you are resetting selected modules or the full system.
            </p>
          </div>
        </div>
      </div>

      {loadingSummary ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
          <Loader2 size={14} className="animate-spin" /> Loading tables...
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-white">
              <h5 className="font-extrabold text-slate-900 flex items-center gap-2">
                <Trash2 size={16} className="text-rose-500" />
                Select tables to delete
              </h5>
              <p className="text-xs text-slate-400 mt-0.5">
                Click tags to select modules. Selected tables will be backed up (optional) and permanently deleted.
              </p>
            </div>

            <div className="px-5 py-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedModules(modules.map((item) => item.id))}
                  disabled={readOnly || modules.length === 0}
                  className="text-[11px] font-bold text-rose-700 hover:text-rose-800 disabled:opacity-50 cursor-pointer"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModules([])}
                  disabled={readOnly}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="relative max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                placeholder="Search tables..."
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs font-medium text-slate-700"
              />
            </div>

            {groupedModules.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No tables match your search.</p>
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {groupedModules.map((group) => {
                  const categoryAllSelected = group.items.every((item) =>
                    selectedModules.includes(item.id),
                  );
                  return (
                    <div key={group.category}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          {group.label}
                        </p>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => toggleCategory(group.items, !categoryAllSelected)}
                            className="text-[10px] font-bold text-rose-700 hover:text-rose-800 cursor-pointer"
                          >
                            {categoryAllSelected ? "Clear" : "Select all"}
                          </button>
                        )}
                      </div>
                      <ul className="flex flex-wrap gap-2">
                        {group.items.map((item) => {
                          const isSelected = selectedModules.includes(item.id);
                          return (
                            <li key={item.id}>
                              <label
                                title={`${item.id} · ${item.count} row(s)`}
                                className={[
                                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border transition",
                                  readOnly ? "cursor-default" : "cursor-pointer",
                                  isSelected
                                    ? "bg-rose-100 border-rose-300 text-rose-900 ring-1 ring-rose-200"
                                    : "bg-rose-50 border-rose-100 text-slate-700 hover:border-rose-200",
                                ].join(" ")}
                              >
                                {!readOnly && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleModule(item.id)}
                                    className="rounded border-slate-300 text-rose-600 cursor-pointer"
                                  />
                                )}
                                <span>{item.label}</span>
                                <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                  ({item.count})
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[10px] text-slate-400">
              {selectedModules.length} of {modules.length} table{modules.length !== 1 ? "s" : ""} selected
              {allSelected ? " (all)" : ""}. Hover a tag to see collection name and row count.
            </p>
            </div>
          </div>

          {selectedModules.length > 0 && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-sky-600" />
                <h5 className="text-sm font-extrabold text-slate-800">
                  {backupFirst ? "Data That Will Be Backed Up & Deleted" : "Data That Will Be Deleted"}
                </h5>
              </div>
              {renderPreviewSummary()}
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          disabled={readOnly || selectedModules.length === 0 || loadingSummary}
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
        >
          <Trash2 size={14} />
          Delete Selected Data
        </button>
      </div>

      {dialogOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={closeDialog} aria-hidden />
            <div
              className="relative w-full max-w-lg animate-fade-in rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-all-data-title"
            >
              <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-rose-100 bg-rose-50 px-5 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <Trash2 size={18} className="shrink-0 text-rose-600" />
                  <h3 id="delete-all-data-title" className="text-sm font-extrabold text-slate-900">
                    Confirm Delete
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isDeleting}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-700 disabled:opacity-50"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={backupFirst}
                    onChange={(e) => setBackupFirst(e.target.checked)}
                    disabled={isDeleting}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                  />
                  <span className="text-xs text-slate-700 inline-flex items-center gap-1.5">
                    <Download size={12} />
                    Take a backup before deleting selected tables
                  </span>
                </label>

                {renderPreviewSummary(true)}

                <div>
                  <label htmlFor="delete-all-data-input" className="mb-1.5 block text-xs font-bold text-slate-600">
                    Type <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-rose-700">DELETE</span>{" "}
                    to confirm
                  </label>
                  <input
                    id="delete-all-data-input"
                    type="text"
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                    autoFocus
                    disabled={isDeleting}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 transition focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400/30 disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={isDeleting}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAllData()}
                    disabled={isDeleting || typedText !== "DELETE" || selectedModules.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {isDeleting ? "Deleting..." : "Delete selected data"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
