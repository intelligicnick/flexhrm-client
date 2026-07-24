import React from "react";
import { Construction } from "lucide-react";
import { useLocation } from 'react-router';
import { getPlatformModule } from "./platformModules";
import { PageHeader } from "./PlatformShared";

export default function PlatformModulePlaceholder() {
  const location = useLocation();
  const mod = getPlatformModule(location.pathname);

  if (!mod) {
    return <div className="text-slate-500">Module not found.</div>;
  }

  return (
    <div>
      <PageHeader title={mod.label} description={mod.description} />

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Construction size={40} className="text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-700 mb-1">Coming in Next Phase</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          This module is registered in the platform admin navigation. Backend infrastructure and UI will be built out incrementally.
        </p>
      </div>

      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
        <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">Planned Capabilities</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {mod.capabilities.map((cap) => (
            <div key={cap} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff791a] mt-1.5 shrink-0" />
              {cap}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
