import React from "react";
import { ErrorBanner, KpiCard, LoadingSpinner, PageHeader } from "./PlatformShared";
import { usePlatformApi } from "../../hooks/usePlatformApi";
import { Shield, Users, AlertTriangle } from "lucide-react";

interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  tenantId: string;
  timestamp: string;
}

interface SecurityOverview {
  activeSessions: number;
  platformSessions: number;
  failedLogins: number;
  mfaEnabled: boolean;
}

export default function PlatformAuditPage() {
  const { data: logs, loading, error } = usePlatformApi<AuditLog[]>("/api/platform/audit/logs");
  const { data: security } = usePlatformApi<SecurityOverview>("/api/platform/audit/security");

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Audit & Security" description="Login logs, activity tracking, and security controls." />
      {error && <ErrorBanner message={error} />}

      {security && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Active Sessions" value={security.activeSessions} icon={Users} color="text-blue-600" />
          <KpiCard label="Platform Sessions" value={security.platformSessions} icon={Shield} color="text-indigo-600" />
          <KpiCard label="Failed Logins" value={security.failedLogins} icon={AlertTriangle} color="text-red-600" />
          <KpiCard label="MFA" value={security.mfaEnabled ? "Enabled" : "Planned"} icon={Shield} />
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
            <th className="text-left p-3">Time</th><th className="text-left p-3">Actor</th><th className="text-left p-3">Action</th><th className="text-left p-3">Target</th>
          </tr></thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="p-3 text-xs">{new Date(l.timestamp).toLocaleString()}</td>
                <td className="p-3">{l.actor}</td>
                <td className="p-3 font-mono text-xs">{l.action}</td>
                <td className="p-3 text-xs text-slate-500">{l.target || l.tenantId}</td>
              </tr>
            ))}
            {(logs ?? []).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No audit logs yet — platform actions will be recorded here</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
