import React, { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { apiUrl, parseApiError } from "../../api";
import { ErrorBanner, LoadingSpinner, PageHeader } from "./PlatformShared";

interface CatalogItem {
  key: string;
  label: string;
}

interface Plan {
  id: string;
  name: string;
  moduleAccess: Record<string, boolean>;
}

export default function PlatformModulesPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<CatalogItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [access, setAccess] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, catalogRes] = await Promise.all([
        fetch(apiUrl("/api/platform/plans"), { credentials: "include" }),
        fetch(apiUrl("/api/platform/plans/catalog"), { credentials: "include" }),
      ]);
      if (!plansRes.ok) throw await parseApiError(plansRes, "Failed to load plans");
      const planList: Plan[] = await plansRes.json();
      const catalog = await catalogRes.json();
      setPlans(planList);
      setModules(catalog.modules ?? []);
      if (planList.length > 0) {
        setSelectedPlanId(planList[0].id);
        setAccess(planList[0].moduleAccess ?? {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (plan) setAccess(plan.moduleAccess ?? {});
  }, [selectedPlanId, plans]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/platform/plans/${selectedPlanId}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleAccess: access }),
      });
      if (!res.ok) throw await parseApiError(res, "Save failed");
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function toggleAll(enabled: boolean) {
    const next: Record<string, boolean> = {};
    for (const mod of modules) next[mod.key] = enabled;
    setAccess(next);
  }

  if (loading) return <LoadingSpinner />;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <div>
      <PageHeader
        title="Module Management"
        description="Enable or disable HRMS modules per subscription plan."
        action={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
          </button>
        }
      />
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap gap-2 mb-4">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedPlanId(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
              selectedPlanId === p.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {selectedPlan && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => toggleAll(true)} className="text-xs text-green-600 font-bold hover:underline">Enable All</button>
            <button type="button" onClick={() => toggleAll(false)} className="text-xs text-red-500 font-bold hover:underline">Disable All</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {modules.map((mod) => (
              <label key={mod.key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!access[mod.key]}
                  onChange={(e) => setAccess({ ...access, [mod.key]: e.target.checked })}
                />
                <span className="text-sm text-slate-700">{mod.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
