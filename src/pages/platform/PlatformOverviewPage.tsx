import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  Clock,
  DollarSign,
  HardDrive,
  Headphones,
  Server,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { apiUrl, parseApiError } from "../../api";
import { ErrorBanner, KpiCard, LoadingSpinner } from "./PlatformShared";

interface DashboardData {
  tenants: Record<string, number>;
  platform: {
    totalEmployees: number;
    storageUsedMb: number;
    expiringTrials: number;
    newSignups: number;
    renewalsDue: number;
  };
  revenue: {
    totalRevenue: number;
    mrr: number;
    arr: number;
    activeSubscriptions: number;
    pastDue: number;
  };
  supportTickets: number;
  pendingPayments: number;
  serverHealth: { status: string; uptime: number; memoryMb: number };
}

export default function PlatformOverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/platform/dashboard"), { credentials: "include" });
      if (!res.ok) throw await parseApiError(res, "Failed to load dashboard");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorBanner message={error || "No data"} />;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const uptimeHours = Math.round(data.serverHealth.uptime / 3600);

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      <section>
        <h3 className="text-xs font-bold uppercase text-slate-400 mb-3">Companies</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Total Companies" value={data.tenants.total ?? 0} icon={Building2} color="text-blue-600" />
          <KpiCard label="Active" value={data.tenants.active ?? 0} icon={Activity} color="text-green-600" />
          <KpiCard label="Trial" value={data.tenants.trial ?? 0} icon={TrendingUp} color="text-amber-600" />
          <KpiCard label="Expiring Trials" value={data.platform.expiringTrials} icon={Clock} color="text-orange-600" />
          <KpiCard label="Suspended" value={data.tenants.suspended ?? 0} icon={AlertTriangle} color="text-red-600" />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase text-slate-400 mb-3">Revenue & Growth</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total Revenue" value={fmt(data.revenue.totalRevenue ?? 0)} icon={DollarSign} />
          <KpiCard label="MRR" value={fmt(data.revenue.mrr ?? 0)} icon={TrendingUp} color="text-green-600" />
          <KpiCard label="ARR" value={fmt(data.revenue.arr ?? 0)} icon={TrendingUp} color="text-emerald-600" />
          <KpiCard label="Active Subscriptions" value={data.revenue.activeSubscriptions ?? 0} icon={Users} color="text-blue-600" />
          <KpiCard label="New Signups (30d)" value={data.platform.newSignups} icon={Zap} color="text-violet-600" />
          <KpiCard label="Renewals Due" value={data.platform.renewalsDue} icon={Clock} color="text-amber-600" />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase text-slate-400 mb-3">Platform Usage</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Total Employees"
            value={(data.platform.totalEmployees ?? 0).toLocaleString()}
            icon={Users}
            color="text-indigo-600"
          />
          <KpiCard
            label="Storage Used"
            value={`${Math.round((data.platform.storageUsedMb ?? 0) / 1024)} GB`}
            icon={HardDrive}
            color="text-slate-600"
          />
          <KpiCard label="Support Tickets" value={data.supportTickets} icon={Headphones} color="text-blue-600" />
          <KpiCard label="Pending Payments" value={data.pendingPayments} icon={AlertTriangle} color="text-red-600" />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase text-slate-400 mb-3">Infrastructure</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Server size={14} className="text-green-600" /> Server Health
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-bold text-slate-800 capitalize">{data.serverHealth.status}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Uptime: {uptimeHours}h · Memory: {data.serverHealth.memoryMb} MB</p>
          </div>
          <KpiCard label="Past Due Subscriptions" value={data.revenue.pastDue ?? 0} icon={AlertTriangle} color="text-red-500" />
          <KpiCard label="API Usage Today" value="—" icon={Zap} sub="Tracking enabled in Phase 3" />
        </div>
      </section>
    </div>
  );
}
