import React, { useState } from "react";
import { Plus } from "lucide-react";
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";
import { platformPatch, platformPost, usePlatformApi } from "../../hooks/usePlatformApi";

interface Ticket {
  id: string;
  tenantId: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt?: string;
}

export default function PlatformSupportPage() {
  const { data: tickets, loading, error, reload } = usePlatformApi<Ticket[]>("/api/platform/support/tickets");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenantId: "", subject: "", description: "", priority: "medium" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await platformPost("/api/platform/support/tickets", form);
    setShowForm(false);
    void reload();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Support Desk" description="Ticket management, SLA tracking, and customer success." action={
        <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg"><Plus size={14} /> New Ticket</button>
      } />
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form onSubmit={(e) => void create(e)} className="bg-white rounded-xl border p-4 mb-4 space-y-3">
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Tenant ID" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border text-sm rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
            <th className="text-left p-3">Subject</th><th className="text-left p-3">Tenant</th><th className="text-left p-3">Priority</th><th className="text-left p-3">Status</th><th className="text-left p-3">Update</th>
          </tr></thead>
          <tbody>
            {(tickets ?? []).map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{t.subject}</td>
                <td className="p-3 text-xs font-mono">{t.tenantId}</td>
                <td className="p-3 capitalize">{t.priority}</td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className="p-3">
                  <select className="text-xs border rounded px-1" value={t.status} onChange={(e) => void platformPatch(`/api/platform/support/tickets/${t.id}/status`, { status: e.target.value }).then(() => reload())}>
                    {["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {(tickets ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No tickets yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
