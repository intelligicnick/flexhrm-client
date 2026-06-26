import React, { useState } from "react";
import { ErrorBanner, LoadingSpinner, PageHeader } from "./PlatformShared";
import { platformPatch, usePlatformApi } from "../../hooks/usePlatformApi";

interface TenantBranding {
  id: string;
  companyName: string;
  subdomain: string;
  planId: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    customDomain?: string;
    emailFromName?: string;
    emailFromAddress?: string;
  };
}

export default function PlatformWhiteLabelPage() {
  const { data: tenants, loading, error, reload } = usePlatformApi<TenantBranding[]>("/api/platform/white-label");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ logoUrl: "", primaryColor: "#ff791a", customDomain: "", emailFromName: "", emailFromAddress: "" });

  function startEdit(t: TenantBranding) {
    setEditId(t.id);
    setForm({
      logoUrl: t.branding?.logoUrl ?? "",
      primaryColor: t.branding?.primaryColor ?? "#ff791a",
      customDomain: t.branding?.customDomain ?? "",
      emailFromName: t.branding?.emailFromName ?? "",
      emailFromAddress: t.branding?.emailFromAddress ?? "",
    });
  }

  async function save() {
    if (!editId) return;
    await platformPatch(`/api/platform/white-label/${editId}`, form);
    setEditId(null);
    void reload();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="White Label Management" description="Company logos, themes, custom domains, and email branding." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(tenants ?? []).map((t) => (
          <div key={t.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: t.branding?.primaryColor ?? "#ff791a" }}>
                {t.companyName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-slate-800">{t.companyName}</div>
                <div className="text-xs text-slate-400">{t.subdomain}.flexhrm.com</div>
              </div>
            </div>
            {t.branding?.customDomain && <div className="text-xs text-blue-600 mb-2">{t.branding.customDomain}</div>}
            <button type="button" onClick={() => startEdit(t)} className="text-xs text-[#ff791a] font-bold hover:underline">Edit Branding</button>
          </div>
        ))}
      </div>

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-bold">Edit Branding</h3>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Logo URL" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
            <input type="color" className="w-full h-10 border rounded-lg" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Custom Domain" value={form.customDomain} onChange={(e) => setForm({ ...form, customDomain: e.target.value })} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Email From Name" value={form.emailFromName} onChange={(e) => setForm({ ...form, emailFromName: e.target.value })} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Email From Address" value={form.emailFromAddress} onChange={(e) => setForm({ ...form, emailFromAddress: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => void save()} className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-lg text-sm">Save</button>
              <button type="button" onClick={() => setEditId(null)} className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
