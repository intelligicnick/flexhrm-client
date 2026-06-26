import React from "react";
import { Database, HardDrive, Server, Shield } from "lucide-react";
import { ErrorBanner, KpiCard, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";
import { usePlatformApi } from "../../hooks/usePlatformApi";

interface TenantControl {
  tenants: Array<{
    id: string;
    companyName: string;
    subdomain: string;
    status: string;
    planId: string;
    employeeCount: number;
    storageUsedMb: number;
    subscriptionStatus: string;
    databaseAllocation: string;
    isolation: string;
    health: string;
  }>;
  totalTenants: number;
  dedicatedDbTenants: number;
  totalStorageMb: number;
}

export default function PlatformTenantControlPage() {
  const { data, loading, error } = usePlatformApi<TenantControl>("/api/platform/tenant-control");

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorBanner message={error || "No data"} />;

  return (
    <div>
      <PageHeader title="Multi-Tenant SaaS Control Center" description="Tenant provisioning, isolation, resource allocation, and health monitoring." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Tenants" value={data.totalTenants} icon={Database} color="text-blue-600" />
        <KpiCard label="Dedicated DB" value={data.dedicatedDbTenants} icon={Server} color="text-indigo-600" />
        <KpiCard label="Total Storage" value={`${Math.round(data.totalStorageMb / 1024)} GB`} icon={HardDrive} />
        <KpiCard label="Isolation" value="tenantId" icon={Shield} sub="Query scoping active" />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
            <th className="text-left p-3">Tenant</th><th className="text-left p-3">Plan</th><th className="text-left p-3">DB</th><th className="text-left p-3">Employees</th><th className="text-left p-3">Storage</th><th className="text-left p-3">Health</th>
          </tr></thead>
          <tbody>
            {data.tenants.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="p-3"><div className="font-medium">{t.companyName}</div><div className="text-xs text-slate-400 font-mono">{t.subdomain}</div></td>
                <td className="p-3 capitalize">{t.planId}</td>
                <td className="p-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.databaseAllocation === "dedicated" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>{t.databaseAllocation}</span></td>
                <td className="p-3">{t.employeeCount}</td>
                <td className="p-3">{t.storageUsedMb} MB</td>
                <td className="p-3"><StatusBadge status={t.health === "healthy" ? "active" : "suspended"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
