import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from 'react-router';
import {
  Building2,
  DollarSign,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { apiUrl, parseApiError } from "../../api";
import CreateCompanyTrialModal from "./CreateCompanyTrialModal";

interface Tenant {
  id: string;
  companyName: string;
  subdomain: string;
  status: string;
  email: string;
  planId: string;
  trialEndsAt?: string;
}

interface DashboardData {
  tenants: Record<string, number>;
  revenue: Record<string, number>;
  activeTrials: number;
  churnRate: number;
}

export default function PlatformDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch(apiUrl("/api/platform/auth/me"), { credentials: "include" });
      if (!meRes.ok) {
        navigate("/platform/login");
        return;
      }
      const [dashRes, tenantsRes] = await Promise.all([
        fetch(apiUrl("/api/platform/dashboard"), { credentials: "include" }),
        fetch(apiUrl("/api/platform/tenants?pageSize=100"), { credentials: "include" }),
      ]);
      if (!dashRes.ok) throw await parseApiError(dashRes, "Failed to load dashboard");
      if (!tenantsRes.ok) throw await parseApiError(tenantsRes, "Failed to load tenants");
      setDashboard(await dashRes.json());
      const tenantData = await tenantsRes.json();
      setTenants(tenantData.items ?? tenantData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAction(id: string, action: "suspend" | "activate" | "extend") {
    const url =
      action === "extend"
        ? `/api/platform/tenants/${id}/extend-trial`
        : `/api/platform/tenants/${id}/${action}`;
    const body = action === "extend" ? JSON.stringify({ days: 14 }) : undefined;
    const res = await fetch(apiUrl(url), {
      method: "PATCH",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    if (!res.ok) alert(await parseApiError(res, "Action failed"));
    else void load();
  }

  async function logout() {
    await fetch(apiUrl("/api/platform/auth/logout"), { method: "POST", credentials: "include" });
    navigate("/platform/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">Flex HRM Platform</h1>
          <p className="text-xs text-slate-400">Super Admin Console</p>
        </div>
        <button onClick={() => void logout()} className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
          <LogOut size={16} /> Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Companies", value: dashboard.tenants.total ?? 0, icon: Building2, color: "text-blue-600" },
              { label: "Active Trials", value: dashboard.activeTrials, icon: TrendingUp, color: "text-amber-600" },
              { label: "Active Subscriptions", value: dashboard.revenue.activeSubscriptions ?? 0, icon: Users, color: "text-green-600" },
              { label: "Total Revenue", value: `₹${(dashboard.revenue.totalRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-[#ff791a]" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <kpi.icon size={14} className={kpi.color} /> {kpi.label}
                </div>
                <div className="text-2xl font-bold text-slate-800">{kpi.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Companies</h2>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1 text-xs text-[#ff791a] font-bold hover:underline"
            >
              <Plus size={14} /> Create Trial
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Subdomain</th>
                <th className="text-left p-3">Plan</th>
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
                  <td className="p-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      t.status === "active" ? "bg-green-100 text-green-700"
                        : t.status === "trial" ? "bg-amber-100 text-amber-700"
                          : t.status === "suspended" ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                    }`}>{t.status}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {t.status !== "active" && (
                        <button onClick={() => void handleAction(t.id, "activate")} title="Activate" className="text-green-600 hover:text-green-800">
                          <PlayCircle size={16} />
                        </button>
                      )}
                      {t.status === "active" && (
                        <button onClick={() => void handleAction(t.id, "suspend")} title="Suspend" className="text-red-500 hover:text-red-700">
                          <PauseCircle size={16} />
                        </button>
                      )}
                      {t.status === "trial" && (
                        <button onClick={() => void handleAction(t.id, "extend")} className="text-xs text-blue-600 font-bold hover:underline">
                          +14d
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <CreateCompanyTrialModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => void load()}
      />
    </div>
  );
}
