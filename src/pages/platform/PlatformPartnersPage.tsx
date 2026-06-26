import React, { useState } from "react";
import { Plus } from "lucide-react";
import { ErrorBanner, LoadingSpinner, PageHeader } from "./PlatformShared";
import { platformPatch, platformPost, usePlatformApi } from "../../hooks/usePlatformApi";

interface Partner {
  id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  commissionPercent: number;
  status: string;
  region: string;
  tenantCount: number;
  totalRevenue: number;
  whiteLabelEnabled: boolean;
}

export default function PlatformPartnersPage() {
  const { data: partners, loading, error, reload } = usePlatformApi<Partner[]>("/api/platform/partners");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "reseller",
    email: "",
    phone: "",
    commissionPercent: 10,
    region: "",
    whiteLabelEnabled: false,
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await platformPost("/api/platform/partners", form);
    setShowForm(false);
    setForm({ name: "", type: "reseller", email: "", phone: "", commissionPercent: 10, region: "", whiteLabelEnabled: false });
    void reload();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Reseller & Partners"
        description="Reseller, franchise, and partner commission management."
        action={
          <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg">
            <Plus size={14} /> Add Partner
          </button>
        }
      />
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form onSubmit={(e) => void create(e)} className="bg-white rounded-xl border p-4 mb-4 grid grid-cols-2 gap-3">
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className="border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="reseller">Reseller</option>
            <option value="partner">Partner</option>
            <option value="franchise">Franchise</option>
          </select>
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="number" className="border rounded-lg px-3 py-2 text-sm" placeholder="Commission %" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.whiteLabelEnabled} onChange={(e) => setForm({ ...form, whiteLabelEnabled: e.target.checked })} />
            White Label Enabled
          </label>
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg">Save Partner</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border text-sm rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left p-3">Partner</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Commission</th>
              <th className="text-left p-3">Tenants</th>
              <th className="text-left p-3">Revenue</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(partners ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.email}{p.region ? ` · ${p.region}` : ""}</div>
                </td>
                <td className="p-3 capitalize">{p.type}</td>
                <td className="p-3">{p.commissionPercent}%</td>
                <td className="p-3">{p.tenantCount ?? 0}</td>
                <td className="p-3">₹{(p.totalRevenue ?? 0).toLocaleString()}</td>
                <td className="p-3">
                  <select
                    className="text-xs border rounded px-1"
                    value={p.status}
                    onChange={(e) => void platformPatch(`/api/platform/partners/${p.id}`, { status: e.target.value }).then(() => reload())}
                  >
                    {["active", "inactive", "suspended"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {(partners ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">No partners yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
