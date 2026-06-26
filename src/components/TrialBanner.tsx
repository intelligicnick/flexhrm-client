import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { apiUrl } from "../api";

interface TenantBranding {
  companyName?: string;
  status?: string;
  trialDaysRemaining?: number;
  showUpgradePrompt?: boolean;
}

export default function TrialBanner() {
  const [info, setInfo] = useState<TenantBranding | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/platform/tenant/branding"), { credentials: "include" })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (dismissed || !info?.showUpgradePrompt || info.status !== "trial") return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-amber-900">
        <AlertTriangle size={16} />
        <span>
          <strong>{info.trialDaysRemaining ?? 0} day(s)</strong> left in your trial.
          Upgrade to keep access to all features.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link to="/register" className="text-xs font-bold text-[#ff791a] hover:underline">
          View Plans
        </Link>
        <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-900">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
