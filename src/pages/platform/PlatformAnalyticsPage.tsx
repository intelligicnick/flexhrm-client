import React from "react";
import { BarChart3, Building2, DollarSign, TrendingDown, TrendingUp, Users } from "lucide-react";
import { ErrorBanner, KpiCard, LoadingSpinner, PageHeader } from "./PlatformShared";
import { usePlatformApi } from "../../hooks/usePlatformApi";

interface AnalyticsData {
  revenue: {
    totalRevenue: number;
    mrr: number;
    arr: number;
    activeSubscriptions: number;
    pastDue: number;
  };
  tenants: Record<string, number>;
  subscriptionsByPlan: { _id: string; count: number }[];
  leadsByStatus: { _id: string; count: number }[];
  ticketsByStatus: { _id: string; count: number }[];
  churnRate: number;
  trialConversionRate: number;
  employeeGrowth: number;
}

function StatusBreakdown({ title, items }: { title: string; items: { _id: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-bold text-slate-800 mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item._id ?? "unknown"}>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span className="capitalize">{(item._id ?? "unknown").replace(/_/g, " ")}</span>
              <span>{item.count}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#ff791a] rounded-full" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">No data yet</p>}
      </div>
    </div>
  );
}

export default function PlatformAnalyticsPage() {
  const { data, loading, error } = usePlatformApi<AnalyticsData>("/api/platform/analytics");

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorBanner message={error || "No data"} />;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div>
      <PageHeader title="Reporting & Analytics" description="Revenue, churn, usage, and growth analytics." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Total Revenue" value={fmt(data.revenue.totalRevenue)} icon={DollarSign} />
        <KpiCard label="MRR" value={fmt(data.revenue.mrr)} icon={TrendingUp} color="text-green-600" />
        <KpiCard label="ARR" value={fmt(data.revenue.arr)} icon={BarChart3} color="text-blue-600" />
        <KpiCard label="Churn Rate" value={`${data.churnRate}%`} icon={TrendingDown} color="text-red-600" />
        <KpiCard label="Trial Conversion" value={`${data.trialConversionRate}%`} icon={Building2} color="text-amber-600" />
        <KpiCard label="Employee Growth (30d)" value={data.employeeGrowth} icon={Users} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusBreakdown title="Subscriptions by Plan" items={data.subscriptionsByPlan ?? []} />
        <StatusBreakdown title="Leads by Status" items={data.leadsByStatus ?? []} />
        <StatusBreakdown title="Tickets by Status" items={data.ticketsByStatus ?? []} />
      </div>
    </div>
  );
}
