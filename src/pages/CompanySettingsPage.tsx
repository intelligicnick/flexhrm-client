import React, { useCallback, useEffect, useState } from "react";
import { MapPin, Palette, Workflow, MessageCircle } from "lucide-react";
import { apiUrl, parseApiError } from "../api";

type Geofence = {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export default function CompanySettingsPage() {
  const [branding, setBranding] = useState({
    logoUrl: "",
    primaryColor: "#ff791a",
    customDomain: "",
    emailFromName: "",
    emailFromAddress: "",
  });
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [workflows, setWorkflows] = useState<Record<string, unknown>[]>([]);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [geoForm, setGeoForm] = useState({
    name: "",
    location: "",
    latitude: "",
    longitude: "",
    radiusMeters: "200",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, geoRes, wfRes, waRes] = await Promise.all([
        fetch(apiUrl("/api/tenant/settings"), { credentials: "include" }),
        fetch(apiUrl("/api/attendance-punch/geofences"), { credentials: "include" }),
        fetch(apiUrl("/api/workflows"), { credentials: "include" }),
        fetch(apiUrl("/api/whatsapp/status"), { credentials: "include" }),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const b = data.branding ?? {};
        setBranding({
          logoUrl: String(b.logoUrl ?? ""),
          primaryColor: String(b.primaryColor ?? "#ff791a"),
          customDomain: String(b.customDomain ?? ""),
          emailFromName: String(b.emailFromName ?? ""),
          emailFromAddress: String(b.emailFromAddress ?? ""),
        });
      }
      if (geoRes.ok) setGeofences(await geoRes.json());
      if (wfRes.ok) setWorkflows(await wfRes.json());
      if (waRes.ok) {
        const wa = await waRes.json();
        setWhatsappEnabled(!!wa.enabled);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(apiUrl("/api/tenant/settings/branding"), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to save branding");
      setMessage("Branding saved. Login page will reflect your company colors.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addGeofence(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(apiUrl("/api/attendance-punch/geofences"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: geoForm.name,
          location: geoForm.location,
          latitude: parseFloat(geoForm.latitude),
          longitude: parseFloat(geoForm.longitude),
          radiusMeters: parseInt(geoForm.radiusMeters, 10) || 200,
        }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to add geofence");
      setGeoForm({ name: "", location: "", latitude: "", longitude: "", radiusMeters: "200" });
      void load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Geofence failed");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-2">
      <div>
        <h2 className="text-lg font-extrabold text-slate-800">Company Settings</h2>
        <p className="text-sm text-slate-500">White-label branding, GPS geofences, and automation workflows.</p>
      </div>

      {message && (
        <div className="text-sm px-4 py-2 rounded-lg bg-orange-50 text-orange-800 border border-orange-100">{message}</div>
      )}

      <form onSubmit={saveBranding} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Palette size={18} className="text-[#ff791a]" /> Branding
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-600">
            Logo URL
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={branding.logoUrl} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Primary Color
            <input type="color" className="mt-1 w-full h-10 border rounded-lg" value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
            Custom Domain
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" placeholder="hr.yourcompany.com" value={branding.customDomain} onChange={(e) => setBranding({ ...branding, customDomain: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Email From Name
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={branding.emailFromName} onChange={(e) => setBranding({ ...branding, emailFromName: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Email From Address
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={branding.emailFromAddress} onChange={(e) => setBranding({ ...branding, emailFromAddress: e.target.value })} />
          </label>
        </div>
        <button type="submit" disabled={saving} className="px-4 py-2 bg-[#ff791a] text-white text-sm font-bold rounded-lg disabled:opacity-60">
          {saving ? "Saving…" : "Save Branding"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <MapPin size={18} className="text-[#ff791a]" /> Office Geofences
        </div>
        {geofences.length === 0 ? (
          <p className="text-sm text-slate-400">No geofences yet. Add one so employees can GPS punch in.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {geofences.map((g) => (
              <li key={g.id} className="flex justify-between border-b border-slate-50 pb-2">
                <span className="font-medium">{g.name} {g.location ? `· ${g.location}` : ""}</span>
                <span className="text-slate-400">{g.radiusMeters}m radius</span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addGeofence} className="grid grid-cols-2 gap-2 text-xs">
          <input required placeholder="Office name" className="border rounded-lg px-2 py-2" value={geoForm.name} onChange={(e) => setGeoForm({ ...geoForm, name: e.target.value })} />
          <input placeholder="Location label" className="border rounded-lg px-2 py-2" value={geoForm.location} onChange={(e) => setGeoForm({ ...geoForm, location: e.target.value })} />
          <input required placeholder="Latitude" className="border rounded-lg px-2 py-2" value={geoForm.latitude} onChange={(e) => setGeoForm({ ...geoForm, latitude: e.target.value })} />
          <input required placeholder="Longitude" className="border rounded-lg px-2 py-2" value={geoForm.longitude} onChange={(e) => setGeoForm({ ...geoForm, longitude: e.target.value })} />
          <input placeholder="Radius (m)" className="border rounded-lg px-2 py-2" value={geoForm.radiusMeters} onChange={(e) => setGeoForm({ ...geoForm, radiusMeters: e.target.value })} />
          <button type="submit" className="bg-slate-800 text-white rounded-lg font-bold">Add Geofence</button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Workflow size={18} className="text-[#ff791a]" /> Automation Rules
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MessageCircle size={14} /> WhatsApp {whatsappEnabled ? "connected" : "not configured"}
          </div>
        </div>
        {workflows.length === 0 ? (
          <p className="text-sm text-slate-400">Default workflows are seeded on company registration.</p>
        ) : (
          workflows.map((w) => (
            <div key={String(w.id)} className="text-sm flex justify-between border-b border-slate-50 py-2">
              <span className="font-medium">{String(w.name)}</span>
              <span className="text-slate-400">{String(w.trigger)} → {String(w.action)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
