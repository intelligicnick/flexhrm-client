import React, { useCallback, useEffect, useState } from "react";
import {
  Copy,
  ExternalLink,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { apiUrl, parseApiError } from "../../api";
import CreateCompanyTrialModal from "./CreateCompanyTrialModal";
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";

interface Tenant {
  id: string;
  companyName: string;
  subdomain: string;
  status: string;
  email: string;
  planId: string;
  trialEndsAt?: string;
  employeeCount?: number;
  storageUsedMb?: number;
}

export default function PlatformCompaniesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/platform/tenants?pageSize=200"), { credentials: "include" });
      if (!res.ok) throw await parseApiError(res, "Failed to load companies");
      const data = await res.json();
      setTenants(data.items ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(id: string, endpoint: string, method = "PATCH", body?: unknown) {
    const res = await fetch(apiUrl(`/api/platform/tenants/${id}/${endpoint}`), {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) alert(await parseApiError(res, "Action failed"));
    else void load();
  }

  async function viewUsage(id: string) {
    setSelectedId(id);
    const res = await fetch(apiUrl(`/api/platform/tenants/${id}/usage`), { credentials: "include" });
    if (res.ok) setUsage(await res.json());
  }

  async function deleteTenant(id: string) {
    if (!confirm("Delete this company permanently?")) return;
    const res = await fetch(apiUrl(`/api/platform/tenants/${id}`), {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) alert(await parseApiError(res, "Delete failed"));
    else void load();
  }

  async function loginAs(id: string, tenantId: string) {
    const res = await fetch(apiUrl(`/api/platform/tenants/${id}/impersonate`), {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      alert(await parseApiError(res, "Impersonation failed"));
      return;
    }
    localStorage.setItem("flexhrm_tenant_id", tenantId);
    window.open("/dashboard", "_blank");
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Company Management"
        description="Create, monitor, and manage tenant companies across the platform."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg hover:bg-[#e4640c]"
            >
              <Plus size={14} /> Create Company
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Subdomain</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Employees</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3">
                    <div className="font-medium text-slate-800">{t.companyName}</div>
                    <div className="text-xs text-slate-400">{t.email}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{t.subdomain}.flexhrm.com</td>
                  <td className="p-3 capitalize">{t.planId}</td>
                  <td className="p-3">{t.employeeCount ?? 0}</td>
                  <td className="p-3"><StatusBadge status={t.status} /></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {t.status !== "active" && (
                        <button title="Activate" onClick={() => void action(t.id, "activate")} className="p-1 text-green-600 hover:bg-green-50 rounded">
                          <PlayCircle size={16} />
                        </button>
                      )}
                      {t.status === "active" && (
                        <button title="Suspend" onClick={() => void action(t.id, "suspend")} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <PauseCircle size={16} />
                        </button>
                      )}
                      {t.status === "trial" && (
                        <button title="Extend +14d" onClick={() => void action(t.id, "extend-trial", "PATCH", { days: 14 })} className="px-1.5 text-xs text-blue-600 font-bold">
                          +14d
                        </button>
                      )}
                      <button title="Usage" onClick={() => void viewUsage(t.id)} className="p-1 text-slate-500 hover:bg-slate-100 rounded text-xs font-bold">Stats</button>
                      <button title="Login as admin" onClick={() => void loginAs(t.id, t.id)} className="p-1 text-[#ff791a] hover:bg-orange-50 rounded">
                        <ExternalLink size={16} />
                      </button>
                      <button title="Clone" onClick={() => void action(t.id, "clone", "POST", { companyName: `${t.companyName} Copy` })} className="p-1 text-slate-500 hover:bg-slate-100 rounded">
                        <Copy size={16} />
                      </button>
                      <button title="Force logout" onClick={() => void action(t.id, "force-logout", "POST")} className="p-1 text-slate-500 hover:bg-slate-100 rounded">
                        <LogOut size={16} />
                      </button>
                      {t.id !== "default" && (
                        <button title="Delete" onClick={() => void deleteTenant(t.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && usage && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4 text-sm">
          <h3 className="font-bold text-slate-800 mb-2">Usage Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><span className="text-slate-400">Employees:</span> <strong>{String(usage.employeeCount)}</strong></div>
            <div><span className="text-slate-400">Storage:</span> <strong>{String(usage.storageUsedMb)} MB</strong></div>
            <div><span className="text-slate-400">Plan:</span> <strong>{String(usage.planName)}</strong></div>
            <div><span className="text-slate-400">Trial days left:</span> <strong>{String(usage.trialDaysRemaining)}</strong></div>
          </div>
          <button type="button" onClick={() => { setSelectedId(null); setUsage(null); }} className="mt-2 text-xs text-slate-500 hover:underline">Close</button>
        </div>
      )}

      <CreateCompanyTrialModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => void load()} />
    </div>
  );
}
