import React from "react";
import { ErrorBanner, LoadingSpinner, PageHeader } from "./PlatformShared";
import { usePlatformApi } from "../../hooks/usePlatformApi";

interface Addon {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  moduleKey: string;
  featureKey: string;
  subscriberCount: number;
  active: boolean;
}

export default function PlatformMarketplacePage() {
  const { data: addons, loading, error } = usePlatformApi<Addon[]>("/api/platform/marketplace/addons");

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Marketplace" description="Add-on modules and premium extensions for tenants." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(addons ?? []).map((a) => (
          <div key={a.id} className="bg-white rounded-xl border p-4 hover:border-[#ff791a] transition-colors">
            <h3 className="font-bold text-slate-800">{a.name}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-3">{a.description || `${a.moduleKey || a.featureKey} add-on`}</p>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-[#ff791a]">₹{a.priceMonthly.toLocaleString()}<span className="text-xs text-slate-400">/mo</span></span>
              <span className="text-xs text-slate-400">{a.subscriberCount} subscribers</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
