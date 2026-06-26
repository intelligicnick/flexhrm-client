import React from "react";
import { Smartphone } from "lucide-react";
import { ErrorBanner, LoadingSpinner, PageHeader } from "./PlatformShared";
import { platformPatch, usePlatformApi } from "../../hooks/usePlatformApi";

interface MobileApp {
  id: string;
  name: string;
  appType: string;
  currentVersion: string;
  minVersion: string;
  forceUpdate: boolean;
  pushEnabled: boolean;
  active: boolean;
}

export default function PlatformMobileAppsPage() {
  const { data: apps, loading, error, reload } = usePlatformApi<MobileApp[]>("/api/platform/mobile-apps");

  async function toggle(id: string, field: string, value: boolean) {
    await platformPatch(`/api/platform/mobile-apps/${id}`, { [field]: value });
    void reload();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Mobile App Management" description="Control app versions, force updates, and push notifications." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(apps ?? []).map((app) => (
          <div key={app.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone size={18} className="text-[#ff791a]" />
              <h3 className="font-bold text-slate-800">{app.name}</h3>
            </div>
            <div className="text-xs text-slate-500 space-y-1 mb-3">
              <div>Version: <strong>{app.currentVersion}</strong> (min {app.minVersion})</div>
              <div>Type: {app.appType}</div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm">
                Force Update
                <input type="checkbox" checked={app.forceUpdate} onChange={(e) => void toggle(app.id, "forceUpdate", e.target.checked)} />
              </label>
              <label className="flex items-center justify-between text-sm">
                Push Notifications
                <input type="checkbox" checked={app.pushEnabled} onChange={(e) => void toggle(app.id, "pushEnabled", e.target.checked)} />
              </label>
              <label className="flex items-center justify-between text-sm">
                Active
                <input type="checkbox" checked={app.active} onChange={(e) => void toggle(app.id, "active", e.target.checked)} />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
