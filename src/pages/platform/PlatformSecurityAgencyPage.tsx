import React from "react";
import { Building2, ShieldCheck, Users } from "lucide-react";
import { ErrorBanner, KpiCard, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";
import { usePlatformApi } from "../../hooks/usePlatformApi";

interface AgencyTenant {
  id: string;
  companyName: string;
  industry: string;
  employeeCount: number;
  planId: string;
  status: string;
}

interface SecurityAgencyData {
  totalAgencyTenants: number;
  totalEmployees: number;
  moduleUsage: Record<string, number>;
  moduleLabels: Record<string, string>;
  tenants: AgencyTenant[];
}

export default function PlatformSecurityAgencyPage() {
  const { data, loading, error } = usePlatformApi<SecurityAgencyData>("/api/platform/security-agency");

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorBanner message={error || "No data"} />;

  const moduleEntries = Object.entries(data.moduleUsage ?? {});

  return (
    <div>
      <PageHeader
        title="Security Agency Modules"
        description="Specialized modules for security agencies and facility management."
      />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Agency Tenants" value={data.totalAgencyTenants} icon={Building2} />
        <KpiCard label="Total Employees" value={data.totalEmployees} icon={Users} color="text-blue-600" />
        <KpiCard label="Active Modules" value={moduleEntries.filter(([, c]) => c > 0).length} icon={ShieldCheck} color="text-green-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold text-slate-800 mb-3">Module Adoption</h3>
          <div className="space-y-2">
            {moduleEntries.map(([key, count]) => (
              <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                <span>{data.moduleLabels?.[key] ?? key}</span>
                <span className="font-bold text-[#ff791a]">{count} tenants</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Industry</th>
                <th className="text-left p-3">Employees</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.tenants ?? []).map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{t.companyName}</td>
                  <td className="p-3 text-xs">{t.industry}</td>
                  <td className="p-3">{t.employeeCount ?? 0}</td>
                  <td className="p-3"><StatusBadge status={t.status} /></td>
                </tr>
              ))}
              {(data.tenants ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-slate-400">No agency tenants found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
