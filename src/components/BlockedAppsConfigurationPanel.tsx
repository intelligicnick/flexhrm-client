import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { apiUrl, parseApiError } from "../api";
import ConfirmDialog from "./ui/ConfirmDialog";

function parseCommaSeparatedApps(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(",")) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result.slice(0, 50);
}

function mergeBlockedApps(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((app) => app.toLowerCase()));
  const merged = [...existing];
  for (const app of incoming) {
    const key = app.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(app);
  }
  return merged.slice(0, 50);
}

interface BlockedAppsConfigurationPanelProps {
  readOnly?: boolean;
}

export default function BlockedAppsConfigurationPanel({ readOnly = false }: BlockedAppsConfigurationPanelProps) {
  const [blockedApps, setBlockedApps] = useState<string[]>([]);
  const [newBlockedAppsInput, setNewBlockedAppsInput] = useState("");
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [savingBlockedApps, setSavingBlockedApps] = useState(false);
  const [blockedAppsError, setBlockedAppsError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/school-supervisors/portal-settings"));
        if (res.ok) {
          const data = await res.json();
          const apps = Array.isArray(data.blockedAppsToUninstall) ? data.blockedAppsToUninstall : [];
          setBlockedApps(apps);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const persistBlockedApps = async (nextApps: string[]) => {
    if (readOnly) return false;
    setSavingBlockedApps(true);
    setBlockedAppsError(null);
    try {
      const res = await fetch(apiUrl("/api/school-supervisors/portal-settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedAppsToUninstall: nextApps }),
      });
      if (!res.ok) throw await parseApiError(res, "Could not save blocked apps.");
      const data = await res.json();
      const savedApps = Array.isArray(data.blockedAppsToUninstall) ? data.blockedAppsToUninstall : nextApps;
      setBlockedApps(savedApps);
      setSelectedApps((prev) => prev.filter((app) => savedApps.includes(app)));
      return true;
    } catch (err: unknown) {
      setBlockedAppsError(err instanceof Error ? err.message : "Could not save blocked apps.");
      return false;
    } finally {
      setSavingBlockedApps(false);
    }
  };

  const handleAddBlockedApps = async () => {
    const incoming = mergeBlockedApps([], parseCommaSeparatedApps(newBlockedAppsInput));
    if (!incoming.length) return;
    const nextApps = mergeBlockedApps(blockedApps, incoming);
    const ok = await persistBlockedApps(nextApps);
    if (ok) setNewBlockedAppsInput("");
  };

  const handleBulkDelete = async () => {
    const nextApps = blockedApps.filter((app) => !selectedApps.includes(app));
    const ok = await persistBlockedApps(nextApps);
    if (ok) {
      setSelectedApps([]);
      setConfirmDeleteOpen(false);
    }
  };

  const toggleAppSelection = (app: string) => {
    setSelectedApps((prev) =>
      prev.includes(app) ? prev.filter((name) => name !== app) : [...prev, app],
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 max-w-xs">
        <p className="text-[10px] font-black uppercase tracking-wider text-rose-600/70">Blocked Apps</p>
        <p className="text-2xl font-black text-rose-700 mt-0.5">{blockedApps.length}</p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-white">
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
            <Trash2 size={18} className="text-rose-500" />
            Blocked apps before supervisor login
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Supervisors must confirm these blocked apps are removed from their device before signing in.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {blockedAppsError && (
            <p className="text-xs text-rose-600 font-semibold">{blockedAppsError}</p>
          )}

          {blockedApps.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {blockedApps.map((app) => {
                const isSelected = selectedApps.includes(app);
                return (
                  <li key={app}>
                    <label
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border cursor-pointer transition ${
                        isSelected
                          ? "bg-rose-100 border-rose-300 text-rose-900 ring-1 ring-rose-200"
                          : "bg-rose-50 border-rose-100 text-slate-700 hover:border-rose-200"
                      } ${readOnly ? "cursor-default" : ""}`}
                    >
                      {!readOnly && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAppSelection(app)}
                          className="rounded border-slate-300 text-rose-600 cursor-pointer"
                        />
                      )}
                      <span>{app}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-center text-xs text-slate-400 py-4">No blocked apps configured yet.</p>
          )}

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newBlockedAppsInput}
                onChange={(e) => setNewBlockedAppsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddBlockedApps();
                  }
                }}
                placeholder="App name (e.g. WhatsApp) or comma-separated list"
                className="flex-1 min-w-[200px] px-3 py-2 border border-rose-200 rounded-lg text-xs focus:outline-none focus:border-rose-400"
              />
              <button
                type="button"
                onClick={() => void handleAddBlockedApps()}
                disabled={savingBlockedApps || !newBlockedAppsInput.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-rose-200 bg-white text-xs font-bold text-slate-600 cursor-pointer disabled:opacity-50"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          )}

          <p className="text-[10px] text-slate-400">
            Each app is saved as a blocked app shown on the supervisor login screen.
            {!readOnly && blockedApps.length > 0 && " Select tags and use Delete to remove them."}
          </p>
        </div>

        {!readOnly && selectedApps.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={savingBlockedApps}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              <Trash2 size={14} /> Delete ({selectedApps.length})
            </button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Remove blocked apps"
        message={
          selectedApps.length === 1
            ? `Remove "${selectedApps[0]}" from the supervisor login blocked apps list?`
            : `Remove ${selectedApps.length} blocked apps from the supervisor login list?`
        }
        confirmLabel="Remove apps"
        variant="danger"
        isLoading={savingBlockedApps}
        onConfirm={() => void handleBulkDelete()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
