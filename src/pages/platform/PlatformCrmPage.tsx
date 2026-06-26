import React, { useState } from "react";
import { Plus } from "lucide-react";
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";
import { platformPatch, platformPost, usePlatformApi } from "../../hooks/usePlatformApi";

interface Lead {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  status: string;
  estimatedValue: number;
  industry: string;
}

export default function PlatformCrmPage() {
  const { data: leads, loading, error, reload } = usePlatformApi<Lead[]>("/api/platform/crm/leads");
  const { data: pipeline } = usePlatformApi<{ pipeline: Record<string, number>; total: number }>("/api/platform/crm/pipeline");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ companyName: "", contactPerson: "", email: "", phone: "", industry: "", estimatedValue: 0 });

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    await platformPost("/api/platform/crm/leads", form);
    setShowForm(false);
    setForm({ companyName: "", contactPerson: "", email: "", phone: "", industry: "", estimatedValue: 0 });
    void reload();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="CRM & Sales" description="Leads, demos, quotations, and sales pipeline." action={
        <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg"><Plus size={14} /> Add Lead</button>
      } />
      {error && <ErrorBanner message={error} />}

      {pipeline && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
          {Object.entries(pipeline.pipeline).map(([status, count]) => (
            <div key={status} className="bg-white rounded-xl border p-3 text-center">
              <div className="text-xs text-slate-400 capitalize">{status}</div>
              <div className="text-xl font-bold text-slate-800">{count}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={(e) => void createLead(e)} className="bg-white rounded-xl border p-4 mb-4 grid grid-cols-2 gap-3">
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Company *" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Contact *" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} required />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          <input type="number" className="border rounded-lg px-3 py-2 text-sm" placeholder="Value" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: Number(e.target.value) })} />
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg">Save Lead</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border text-sm rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
            <th className="text-left p-3">Company</th><th className="text-left p-3">Contact</th><th className="text-left p-3">Value</th><th className="text-left p-3">Status</th><th className="text-left p-3">Actions</th>
          </tr></thead>
          <tbody>
            {(leads ?? []).map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="p-3"><div className="font-medium">{l.companyName}</div><div className="text-xs text-slate-400">{l.industry}</div></td>
                <td className="p-3"><div>{l.contactPerson}</div><div className="text-xs text-slate-400">{l.email}</div></td>
                <td className="p-3">₹{(l.estimatedValue ?? 0).toLocaleString()}</td>
                <td className="p-3"><StatusBadge status={l.status} /></td>
                <td className="p-3">
                  <select className="text-xs border rounded px-1 py-0.5" value={l.status} onChange={(e) => void platformPatch(`/api/platform/crm/leads/${l.id}/status`, { status: e.target.value }).then(() => reload())}>
                    {["new", "prospect", "demo", "quotation", "negotiation", "won", "lost"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
