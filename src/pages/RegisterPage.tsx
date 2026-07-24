import React, { useEffect, useState } from "react";
import { Link } from 'react-router';
import { Building2, CheckCircle } from "lucide-react";
import { apiUrl, parseApiError } from "../api";

interface Plan {
  id: string;
  name: string;
  maxEmployees: number;
  priceMonthly: number;
  features: string[];
}

export default function RegisterPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subdomain, setSubdomain] = useState("");
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    legalName: "",
    gstNumber: "",
    industry: "",
    companySize: "",
    address: "",
    state: "",
    country: "India",
    contactPerson: "",
    mobile: "",
    email: "",
    website: "",
    adminUsername: "",
    adminPassword: "",
    trialDays: 14,
  });

  useEffect(() => {
    fetch(apiUrl("/api/platform/register/plans"))
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainAvailable(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(apiUrl(`/api/platform/tenants/check-subdomain/${subdomain}`))
        .then((r) => r.json())
        .then((d) => setSubdomainAvailable(d.available))
        .catch(() => setSubdomainAvailable(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [subdomain]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/platform/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, subdomain: subdomain || undefined }),
      });
      if (!res.ok) throw await parseApiError(res, "Registration failed");
      const data = await res.json();
      localStorage.setItem("flexhrm_tenant_id", String(data.tenantId ?? ""));
      setSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <CheckCircle size={48} className="text-green-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-800">Welcome to Flex HRM!</h1>
          <p className="text-sm text-slate-600">{String(success.message)}</p>
          <div className="bg-slate-50 rounded-lg p-4 text-left text-xs space-y-1 font-mono">
            <div>Subdomain: <strong>{String(success.subdomain)}.flexhrm.com</strong></div>
            <div>Trial: <strong>{String(success.trialDays)} days</strong></div>
          </div>
          <Link to="/hrmlogin" className="block w-full py-3 bg-[#ff791a] text-white font-bold rounded-lg hover:bg-[#e4640c] transition">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Building2 size={40} className="text-[#ff791a] mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Register Your Company</h1>
          <p className="text-slate-400 text-sm mt-2">Start your free trial — no credit card required</p>
        </div>

        {plans.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {plans.slice(0, 4).map((p) => (
              <div key={p.id} className="bg-white/10 border border-white/20 rounded-xl p-3 text-center">
                <div className="text-white font-bold text-sm">{p.name}</div>
                <div className="text-[#ff791a] text-xs mt-1">
                  {p.maxEmployees === -1 ? "Unlimited" : `${p.maxEmployees} employees`}
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 space-y-4 shadow-2xl">
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Company Name *" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Legal Name" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="GST Number" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Contact Person *" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} required />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Mobile *" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
            <input type="email" className="border border-slate-200 rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder="Company Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })}>
              <option value={7}>7-day trial</option>
              <option value={14}>14-day trial</option>
              <option value={30}>30-day trial</option>
            </select>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="text-xs font-bold text-slate-500 uppercase">Choose Subdomain</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="yourcompany"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
              <span className="text-sm text-slate-400">.flexhrm.com</span>
            </div>
            {subdomainAvailable === true && <p className="text-xs text-green-600 mt-1">✓ Available</p>}
            {subdomainAvailable === false && <p className="text-xs text-red-500 mt-1">✗ Already taken</p>}
          </div>

          <div className="border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Admin Username *" value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} required />
            <input type="password" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Admin Password (min 8 chars) *" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required minLength={8} />
          </div>

          <button
            type="submit"
            disabled={loading || subdomainAvailable === false}
            className="w-full py-3 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-50 text-white font-bold rounded-lg transition"
          >
            {loading ? "Creating account…" : "Start Free Trial"}
          </button>

          <p className="text-center text-xs text-slate-400">
            Already have an account? <Link to="/hrmlogin" className="text-[#ff791a] font-bold">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
