import React, { useState } from "react";
import { Plus } from "lucide-react";
import { ErrorBanner, LoadingSpinner, PageHeader } from "./PlatformShared";
import { platformPost, usePlatformApi } from "../../hooks/usePlatformApi";

interface Template {
  id: string;
  type: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  active: boolean;
}

interface CommStatus {
  email: { configured: boolean; provider: string };
  sms: { configured: boolean; provider: string };
  whatsapp: { configured: boolean; provider: string };
  push: { configured: boolean; provider: string };
}

export default function PlatformCommunicationsPage() {
  const { data: templates, loading, error, reload } = usePlatformApi<Template[]>("/api/platform/communications/templates");
  const { data: status } = usePlatformApi<CommStatus>("/api/platform/communications/status");
  const [tab, setTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "email", name: "", subject: "", body: "", category: "general" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await platformPost("/api/platform/communications/templates", form);
    setShowForm(false);
    void reload();
  }

  if (loading) return <LoadingSpinner />;

  const filtered = (templates ?? []).filter((t) => tab === "all" || t.type === tab);

  return (
    <div>
      <PageHeader title="Communication Center" description="Email, SMS, WhatsApp templates and broadcast messaging." action={
        <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg"><Plus size={14} /> New Template</button>
      } />
      {error && <ErrorBanner message={error} />}

      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Object.entries(status).map(([channel, info]) => (
            <div key={channel} className="bg-white rounded-xl border p-3">
              <div className="text-xs text-slate-400 uppercase">{channel}</div>
              <div className={`text-sm font-bold ${info.configured ? "text-green-600" : "text-amber-600"}`}>
                {info.configured ? "Configured" : "Not configured"}
              </div>
              <div className="text-[10px] text-slate-400">{info.provider}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {["all", "email", "sms", "whatsapp", "push"].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${tab === t ? "bg-slate-900 text-white" : "bg-white border"}`}>{t}</button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={(e) => void create(e)} className="bg-white rounded-xl border p-4 mb-4 space-y-3">
          <select className="border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="push">Push</option>
          </select>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Template Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          {form.type === "email" && <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border text-sm rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-800">{t.name}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">{t.type}</span>
            </div>
            {t.subject && <div className="text-xs text-slate-500 mb-1">Subject: {t.subject}</div>}
            <div className="text-xs text-slate-400 line-clamp-2">{t.body || "No body"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
