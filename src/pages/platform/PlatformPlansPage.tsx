import React, { useCallback, useEffect, useState } from "react";
import { Archive, Copy, Plus, Save } from "lucide-react";
import { apiUrl, parseApiError } from "../../api";
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceQuarterly: number;
  priceHalfYearly: number;
  priceAnnual: number;
  priceLifetime: number;
  maxEmployees: number;
  maxBranches: number;
  maxDepartments: number;
  storageLimitMb: number;
  apiLimitPerMonth: number;
  maxAdminUsers: number;
  maxMobileUsers: number;
  active: boolean;
  moduleAccess: Record<string, boolean>;
  featureEntitlements: Record<string, boolean>;
}

const EMPTY_PLAN = {
  name: "",
  description: "",
  priceMonthly: 0,
  priceQuarterly: 0,
  priceHalfYearly: 0,
  priceAnnual: 0,
  priceLifetime: 0,
  maxEmployees: 50,
  maxBranches: 3,
  maxDepartments: 20,
  storageLimitMb: 1024,
  apiLimitPerMonth: 10000,
  maxAdminUsers: 3,
  maxMobileUsers: -1,
};

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/platform/plans?includeArchived=true"), { credentials: "include" });
      if (!res.ok) throw await parseApiError(res, "Failed to load plans");
      setPlans(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function selectPlan(plan: Plan) {
    setSelected(plan);
    setCreating(false);
    setForm({
      name: plan.name,
      description: plan.description,
      priceMonthly: plan.priceMonthly,
      priceQuarterly: plan.priceQuarterly,
      priceHalfYearly: plan.priceHalfYearly ?? 0,
      priceAnnual: plan.priceAnnual,
      priceLifetime: plan.priceLifetime ?? 0,
      maxEmployees: plan.maxEmployees,
      maxBranches: plan.maxBranches ?? 3,
      maxDepartments: plan.maxDepartments ?? 20,
      storageLimitMb: plan.storageLimitMb ?? 1024,
      apiLimitPerMonth: plan.apiLimitPerMonth ?? 10000,
      maxAdminUsers: plan.maxAdminUsers ?? 3,
      maxMobileUsers: plan.maxMobileUsers ?? -1,
    });
  }

  async function save() {
    setSaving(true);
    try {
      const url = creating
        ? apiUrl("/api/platform/plans")
        : apiUrl(`/api/platform/plans/${selected!.id}`);
      const res = await fetch(url, {
        method: creating ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw await parseApiError(res, "Save failed");
      await load();
      if (creating) {
        setCreating(false);
        setSelected(null);
        setForm(EMPTY_PLAN);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clonePlan(id: string) {
    const res = await fetch(apiUrl(`/api/platform/plans/${id}/clone`), { method: "POST", credentials: "include" });
    if (!res.ok) alert(await parseApiError(res, "Clone failed"));
    else void load();
  }

  async function archivePlan(id: string) {
    if (!confirm("Archive this plan?")) return;
    const res = await fetch(apiUrl(`/api/platform/plans/${id}/archive`), { method: "PATCH", credentials: "include" });
    if (!res.ok) alert(await parseApiError(res, "Archive failed"));
    else void load();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Plan Builder"
        description="Design subscription plans with pricing tiers and resource limits."
        action={
          <button
            type="button"
            onClick={() => { setCreating(true); setSelected(null); setForm(EMPTY_PLAN); }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg"
          >
            <Plus size={14} /> New Plan
          </button>
        }
      />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => selectPlan(plan)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selected?.id === plan.id ? "border-[#ff791a] bg-orange-50" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">{plan.name}</span>
                {!plan.active && <StatusBadge status="cancelled" />}
              </div>
              <div className="text-xs text-slate-500 mt-1">₹{plan.priceMonthly.toLocaleString()}/mo · {plan.maxEmployees === -1 ? "∞" : plan.maxEmployees} employees</div>
              <div className="flex gap-1 mt-2">
                <button type="button" onClick={(e) => { e.stopPropagation(); void clonePlan(plan.id); }} className="p-1 text-slate-400 hover:text-slate-600"><Copy size={14} /></button>
                {plan.active && !["starter", "professional", "business", "enterprise"].includes(plan.id) && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); void archivePlan(plan.id); }} className="p-1 text-slate-400 hover:text-red-500"><Archive size={14} /></button>
                )}
              </div>
            </button>
          ))}
        </div>

        {(selected || creating) && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <h3 className="font-bold text-slate-800">{creating ? "Create Plan" : `Edit: ${selected?.name}`}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Plan Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="border rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Pricing (INR)</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {(["priceMonthly", "priceQuarterly", "priceHalfYearly", "priceAnnual", "priceLifetime"] as const).map((key) => (
                  <div key={key}>
                    <label className="text-[10px] text-slate-400 capitalize">{key.replace("price", "").replace(/([A-Z])/g, " $1")}</label>
                    <input type="number" className="w-full border rounded-lg px-2 py-1.5 text-sm" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Limits (-1 = unlimited)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([
                  ["maxEmployees", "Employees"],
                  ["maxBranches", "Branches"],
                  ["maxDepartments", "Departments"],
                  ["storageLimitMb", "Storage (MB)"],
                  ["apiLimitPerMonth", "API/mo"],
                  ["maxAdminUsers", "Admin Users"],
                  ["maxMobileUsers", "Mobile Users"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-[10px] text-slate-400">{label}</label>
                    <input type="number" className="w-full border rounded-lg px-2 py-1.5 text-sm" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={saving || !form.name}
              onClick={() => void save()}
              className="flex items-center gap-1 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg disabled:opacity-50"
            >
              <Save size={14} /> {saving ? "Saving…" : "Save Plan"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
