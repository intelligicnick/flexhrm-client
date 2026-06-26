import React, { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiUrl, parseApiError } from "../../api";
import CreateCompanyTrialModal from "./CreateCompanyTrialModal";
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";

interface TrialTenant {
  id: string;
  companyName: string;
  email: string;
  subdomain: string;
  status: string;
  trialEndsAt?: string;
  trialDays?: number;
  planId: string;
}

export default function PlatformTrialsPage() {
  const [trials, setTrials] = useState<TrialTenant[]>([]);
  const [expiring, setExpiring] = useState<TrialTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, expiringRes] = await Promise.all([
        fetch(apiUrl("/api/platform/tenants?pageSize=200"), { credentials: "include" }),
        fetch(apiUrl("/api/platform/tenants/trials/expiring?days=14"), { credentials: "include" }),
      ]);
      if (!allRes.ok) throw await parseApiError(allRes, "Failed to load trials");
      const allData = await allRes.json();
      const items: TrialTenant[] = allData.items ?? allData;
      setTrials(items.filter((t) => t.status === "trial"));
      if (expiringRes.ok) setExpiring(await expiringRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function extendTrial(id: string, days: number) {
    const res = await fetch(apiUrl(`/api/platform/tenants/${id}/extend-trial`), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    if (!res.ok) alert(await parseApiError(res, "Extension failed"));
    else void load();
  }

  function daysRemaining(trialEndsAt?: string) {
    if (!trialEndsAt) return "—";
    const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
    return days <= 0 ? "Expired" : `${days}d`;
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Trial Management"
        description="Monitor trials, extensions, and conversion tracking."
        action={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg"
          >
            <Plus size={14} /> Create Trial
          </button>
        }
      />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-slate-400 uppercase font-bold">Active Trials</div>
          <div className="text-3xl font-bold text-slate-800 mt-1">{trials.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-slate-400 uppercase font-bold">Expiring (14d)</div>
          <div className="text-3xl font-bold text-amber-600 mt-1">{expiring.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-slate-400 uppercase font-bold">Auto-Suspend</div>
          <div className="text-sm text-slate-600 mt-2">Trials auto-suspend on expiry via TrialReminderService</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left p-3">Company</th>
              <th className="text-left p-3">Plan</th>
              <th className="text-left p-3">Trial Ends</th>
              <th className="text-left p-3">Remaining</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="font-medium">{t.companyName}</div>
                  <div className="text-xs text-slate-400">{t.email}</div>
                </td>
                <td className="p-3 capitalize">{t.planId}</td>
                <td className="p-3 text-xs">{t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : "—"}</td>
                <td className="p-3"><StatusBadge status={daysRemaining(t.trialEndsAt) === "Expired" ? "suspended" : "trial"} /></td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {[7, 14, 30].map((d) => (
                      <button key={d} type="button" onClick={() => void extendTrial(t.id, d)} className="text-xs text-blue-600 font-bold hover:underline">
                        +{d}d
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateCompanyTrialModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => void load()} />
    </div>
  );
}
