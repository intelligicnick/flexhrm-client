import React, { useCallback, useEffect, useState } from "react";
import { apiUrl, parseApiError } from "../../api";
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";

interface Tenant {
  id: string;
  companyName: string;
  planId: string;
  status: string;
}

interface Plan {
  id: string;
  name: string;
}

export default function PlatformSubscriptionsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        fetch(apiUrl("/api/platform/tenants?pageSize=200"), { credentials: "include" }),
        fetch(apiUrl("/api/platform/plans"), { credentials: "include" }),
      ]);
      if (!tenantsRes.ok) throw await parseApiError(tenantsRes, "Failed to load tenants");
      if (!plansRes.ok) throw await parseApiError(plansRes, "Failed to load plans");
      const tenantData = await tenantsRes.json();
      setTenants(tenantData.items ?? tenantData);
      setPlans(await plansRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function assignPlan(tenantId: string, planId: string) {
    const res = await fetch(apiUrl(`/api/platform/tenants/${tenantId}/plan`), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    if (!res.ok) alert(await parseApiError(res, "Failed to assign plan"));
    else void load();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Subscription Management"
        description="Assign, upgrade, downgrade, and manage tenant subscriptions."
      />
      {error && <ErrorBanner message={error} />}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left p-3">Company</th>
              <th className="text-left p-3">Current Plan</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Change Plan</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{t.companyName}</td>
                <td className="p-3 capitalize">{t.planId}</td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className="p-3">
                  <select
                    className="border rounded-lg px-2 py-1 text-xs"
                    value={t.planId}
                    onChange={(e) => void assignPlan(t.id, e.target.value)}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
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
