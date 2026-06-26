import React, { useCallback, useEffect, useState } from "react";
import { apiUrl, parseApiError } from "../../api";
import { ErrorBanner, KpiCard, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";
import { AlertTriangle, DollarSign, Receipt } from "lucide-react";

interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  total: number;
  status: string;
  createdAt?: string;
}

interface Payment {
  id: string;
  tenantId: string;
  amount: number;
  status: string;
  gateway: string;
  createdAt?: string;
}

export default function PlatformBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [failed, setFailed] = useState<Payment[]>([]);
  const [revenue, setRevenue] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"invoices" | "payments" | "failed">("invoices");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, payRes, failRes, revRes] = await Promise.all([
        fetch(apiUrl("/api/platform/billing/admin/invoices"), { credentials: "include" }),
        fetch(apiUrl("/api/platform/billing/admin/payments"), { credentials: "include" }),
        fetch(apiUrl("/api/platform/billing/admin/failed-payments"), { credentials: "include" }),
        fetch(apiUrl("/api/platform/billing/revenue"), { credentials: "include" }),
      ]);
      if (invRes.ok) setInvoices(await invRes.json());
      if (payRes.ok) setPayments(await payRes.json());
      if (failRes.ok) setFailed(await failRes.json());
      if (revRes.ok) setRevenue(await revRes.json());
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

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  return (
    <div>
      <PageHeader title="Billing & Finance" description="Invoices, payments, and revenue across all tenants." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Revenue" value={fmt(revenue.totalRevenue ?? 0)} icon={DollarSign} />
        <KpiCard label="MRR" value={fmt(revenue.mrr ?? 0)} icon={DollarSign} color="text-green-600" />
        <KpiCard label="Invoices" value={revenue.invoiceCount ?? 0} icon={Receipt} color="text-blue-600" />
        <KpiCard label="Failed Payments" value={failed.length} icon={AlertTriangle} color="text-red-600" />
      </div>

      <div className="flex gap-2 mb-4">
        {(["invoices", "payments", "failed"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${
              tab === t ? "bg-slate-900 text-white" : "bg-white border border-slate-200"
            }`}
          >
            {t === "failed" ? "Failed Payments" : t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">Tenant</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {(tab === "invoices" ? invoices : tab === "payments" ? payments : failed).map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="p-3 font-mono text-xs">{("invoiceNumber" in row ? row.invoiceNumber : row.id) as string}</td>
                <td className="p-3 text-xs">{row.tenantId}</td>
                <td className="p-3">{fmt(row.total ?? row.amount ?? 0)}</td>
                <td className="p-3"><StatusBadge status={row.status} /></td>
                <td className="p-3 text-xs">{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
