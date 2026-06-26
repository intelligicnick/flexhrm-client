import React, { useEffect, useState } from "react";
import { CheckCircle, X } from "lucide-react";
import { apiUrl, parseApiError } from "../../api";

interface Plan {
  id: string;
  name: string;
}

interface CreateCompanyTrialModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const INITIAL_FORM = {
  companyName: "",
  legalName: "",
  gstNumber: "",
  industry: "",
  contactPerson: "",
  mobile: "",
  email: "",
  address: "",
  state: "",
  country: "India",
  adminUsername: "",
  adminPassword: "",
  trialDays: 14,
  planId: "starter",
  sendWelcomeEmail: true,
};

export default function CreateCompanyTrialModal({
  open,
  onClose,
  onCreated,
}: CreateCompanyTrialModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subdomain, setSubdomain] = useState("");
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (!open) return;
    fetch(apiUrl("/api/platform/register/plans"))
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
  }, [open]);

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

  function resetAndClose() {
    setForm(INITIAL_FORM);
    setSubdomain("");
    setSubdomainAvailable(null);
    setError("");
    setSuccess(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/platform/tenants"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, subdomain: subdomain || undefined }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to create trial");
      const data = await res.json();
      setSuccess(data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trial");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Create Company Trial</h2>
            <p className="text-xs text-slate-500 mt-0.5">Provision a new tenant with admin access</p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <CheckCircle size={40} className="text-green-500 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800">Trial Created</h3>
              <p className="text-sm text-slate-600 mt-1">{String(success.message)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-xs space-y-1.5 font-mono">
              <div>Company: <strong>{String(success.companyName)}</strong></div>
              <div>Tenant ID: <strong>{String(success.tenantId)}</strong></div>
              <div>Subdomain: <strong>{String(success.subdomain)}.flexhrm.com</strong></div>
              <div>Plan: <strong>{String(success.plan)}</strong></div>
              <div>Trial: <strong>{String(success.trialDays)} days</strong></div>
              <div>Admin: <strong>{String(success.adminUsername)}</strong></div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("flexhrm_tenant_id", String(success.tenantId ?? ""));
                  window.open("/hrmlogin", "_blank");
                }}
                className="flex-1 py-2.5 bg-[#ff791a] text-white font-bold rounded-lg hover:bg-[#e4640c] text-sm"
              >
                Open Company Login
              </button>
              <button
                type="button"
                onClick={resetAndClose}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 text-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Company Name *"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                required
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Legal Name"
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Contact Person *"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                required
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Mobile *"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                required
              />
              <input
                type="email"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm md:col-span-2"
                placeholder="Company Email *"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="GST Number"
                value={form.gstNumber}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
              />
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Industry"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
              <select
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={form.planId}
                onChange={(e) => setForm({ ...form, planId: e.target.value })}
              >
                {(plans.length > 0 ? plans : [
                  { id: "starter", name: "Starter" },
                  { id: "professional", name: "Professional" },
                  { id: "business", name: "Business" },
                  { id: "enterprise", name: "Enterprise" },
                ]).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={form.trialDays}
                onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })}
              >
                <option value={7}>7-day trial</option>
                <option value={14}>14-day trial</option>
                <option value={15}>15-day trial</option>
                <option value={30}>30-day trial</option>
                <option value={60}>60-day trial</option>
                <option value={90}>90-day trial</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Subdomain</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="yourcompany (auto-generated if empty)"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                />
                <span className="text-sm text-slate-400">.flexhrm.com</span>
              </div>
              {subdomainAvailable === true && <p className="text-xs text-green-600 mt-1">Available</p>}
              {subdomainAvailable === false && <p className="text-xs text-red-500 mt-1">Already taken</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Admin Username *"
                value={form.adminUsername}
                onChange={(e) => setForm({ ...form, adminUsername: e.target.value })}
                required
              />
              <input
                type="password"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Admin Password (min 8 chars) *"
                value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                required
                minLength={8}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.sendWelcomeEmail}
                onChange={(e) => setForm({ ...form, sendWelcomeEmail: e.target.checked })}
              />
              Send welcome email to company contact
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={resetAndClose}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || subdomainAvailable === false}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg text-sm"
              >
                {loading ? "Creating…" : "Create Trial"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
