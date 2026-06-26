import React, { useState } from "react";
import { Key, Plus } from "lucide-react";
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";
import { platformPatch, platformPost, usePlatformApi } from "../../hooks/usePlatformApi";

interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  rateLimitPerMonth: number;
  usageCount: number;
  active: boolean;
  lastUsedAt?: string;
}

export default function PlatformApiPage() {
  const { data: keys, loading, error, reload } = usePlatformApi<ApiKey[]>("/api/platform/api-management/keys");
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState<{ tenantId: string; name: string; apiKey?: string }>({ tenantId: "", name: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const result = await platformPost("/api/platform/api-management/keys", { tenantId: newKey.tenantId, name: newKey.name });
    setNewKey({ tenantId: "", name: "", apiKey: result.apiKey as string });
    void reload();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key?")) return;
    await platformPatch(`/api/platform/api-management/keys/${id}/revoke`);
    void reload();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="API Management" description="API keys, usage tracking, rate limits, and webhooks." action={
        <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg"><Plus size={14} /> Create Key</button>
      } />
      {error && <ErrorBanner message={error} />}

      {newKey.apiKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <div className="text-sm font-bold text-green-800 mb-1">API Key Created — copy now, it won't be shown again</div>
          <code className="text-xs bg-white px-2 py-1 rounded border">{newKey.apiKey}</code>
          <button type="button" onClick={() => setNewKey({ tenantId: "", name: "" })} className="block mt-2 text-xs text-green-700 hover:underline">Dismiss</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={(e) => void create(e)} className="bg-white rounded-xl border p-4 mb-4 flex gap-3">
          <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Tenant ID" value={newKey.tenantId} onChange={(e) => setNewKey({ ...newKey, tenantId: e.target.value })} required />
          <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Key Name" value={newKey.name} onChange={(e) => setNewKey({ ...newKey, name: e.target.value })} required />
          <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg">Create</button>
          <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border text-sm rounded-lg">Cancel</button>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
            <th className="text-left p-3">Name</th><th className="text-left p-3">Tenant</th><th className="text-left p-3">Prefix</th><th className="text-left p-3">Usage</th><th className="text-left p-3">Status</th><th className="text-left p-3">Actions</th>
          </tr></thead>
          <tbody>
            {(keys ?? []).map((k) => (
              <tr key={k.id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{k.name}</td>
                <td className="p-3 text-xs font-mono">{k.tenantId}</td>
                <td className="p-3 font-mono text-xs">{k.keyPrefix}…</td>
                <td className="p-3">{k.usageCount}/{k.rateLimitPerMonth}</td>
                <td className="p-3"><StatusBadge status={k.active ? "active" : "cancelled"} /></td>
                <td className="p-3">{k.active && <button type="button" onClick={() => void revoke(k.id)} className="text-xs text-red-500 font-bold hover:underline">Revoke</button>}</td>
              </tr>
            ))}
            {(keys ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">No API keys yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
