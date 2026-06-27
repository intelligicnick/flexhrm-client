import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { apiUrl, parseApiError } from "../../api";
import { ErrorBanner, LoadingSpinner, PageHeader } from "./PlatformShared";
import { platformPost, usePlatformApi } from "../../hooks/usePlatformApi";

const REF_TYPES = [
  { key: "industries", label: "Industries" },
  { key: "countries", label: "Countries" },
  { key: "currencies", label: "Currencies" },
  { key: "timezones", label: "Time Zones" },
  { key: "languages", label: "Languages" },
] as const;

interface RefItem {
  type: string;
  key: string;
  label: string;
  parentKey?: string;
  sortOrder?: number;
  active?: boolean;
}

export default function PlatformSettingsPage() {
  const [activeType, setActiveType] = useState<string>("industries");
  const { data: items, loading, error, reload } = usePlatformApi<RefItem[]>(
    `/api/platform/settings/reference?type=${activeType}`,
    [activeType],
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: "", label: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await platformPost("/api/platform/settings/reference", { type: activeType, ...form });
    setShowForm(false);
    setForm({ key: "", label: "" });
    void reload();
  }

  async function remove(type: string, key: string) {
    if (!confirm(`Delete "${key}" from ${type}?`)) return;
    const res = await fetch(apiUrl(`/api/platform/settings/reference/${type}/${key}`), {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) alert(await parseApiError(res, "Delete failed"));
    else void reload();
  }

  return (
    <div>
      <PageHeader title="System Settings" description="Global reference data and platform configuration." />

      <div className="flex flex-wrap gap-2 mb-4">
        {REF_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveType(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeType === t.key ? "bg-[#ff791a] text-white" : "bg-white border text-slate-600 hover:border-[#ff791a]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg"
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form onSubmit={(e) => void create(e)} className="bg-white rounded-xl border p-4 mb-4 flex gap-3">
          <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Key (e.g. manufacturing)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required />
          <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
          <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg">Save</button>
          <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border text-sm rounded-lg">Cancel</button>
        </form>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Key</th>
                <th className="text-left p-3">Label</th>
                <th className="text-left p-3 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((item) => (
                <tr key={item.key} className="border-t border-slate-100">
                  <td className="p-3 font-mono text-xs">{item.key}</td>
                  <td className="p-3">{item.label}</td>
                  <td className="p-3">
                    <button type="button" onClick={() => void remove(item.type, item.key)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {(items ?? []).length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-slate-400">No items in this category</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
