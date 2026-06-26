import React from "react";
import { Database, HardDrive, Server } from "lucide-react";
import { ErrorBanner, KpiCard, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";
import { usePlatformApi } from "../../hooks/usePlatformApi";

interface TenantRow {
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
}

interface TenantControlData {
  tenants: TenantRow[];
  totalTenants: number;
  dedicatedDbTenants: number;
  totalStorageMb: number;
}

export default function PlatformTenantsPage() {
  const { data, loading, error } = usePlatformApi<TenantControlData>("/api/platform/tenant-control");

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorBanner message={error || "No data"} />;

  return (
    <div>
      <PageHeader title="Multi-Tenant Control" description="Tenant provisioning, isolation, and resource allocation." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Total Tenants" value={data.totalTenants} icon={Server} />
        <KpiCard label="Dedicated DB" value={data.dedicatedDbTenants} icon={Database} color="text-indigo-600" />
        <KpiCard label="Total Storage" value={`${data.totalStorageMb} MB`} icon={HardDrive} />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left p-3">Company</th>
              <th className="text-left p-3">Plan</th>
              <th className="text-left p-3">Employees</th>
              <th className="text-left p-3">Storage</th>
              <th className="text-left p-3">DB Allocation</th>
              <th className="text-left p-3">Health</th>
            </tr>
          </thead>
          <tbody>
            {(data.tenants ?? []).map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="font-medium">{t.companyName}</div>
                  <div className="text-xs text-slate-400 font-mono">{t.subdomain}</div>
                </td>
                <td className="p-3 capitalize">{t.planId}</td>
                <td className="p-3">{t.employeeCount ?? 0}</td>
                <td className="p-3">{t.storageUsedMb ?? 0} MB</td>
                <td className="p-3 capitalize">{t.databaseAllocation}</td>
                <td className="p-3">
                  <StatusBadge status={t.health === "healthy" ? "active" : t.health} />
                </td>
              </tr>
            ))}
            {(data.tenants ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">No tenants yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
