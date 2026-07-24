import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router';
import { UserCircle } from "lucide-react";
import { apiUrl, parseApiError } from "../../api";

export default function EmployeePortalLoginPage() {
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<{ companyName?: string }>({});

  useEffect(() => {
    fetch(apiUrl("/api/platform/tenant/branding"))
      .then((r) => r.json())
      .then(setBranding)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/employee-portal/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode, password }),
      });
      if (!res.ok) throw await parseApiError(res, "Login failed");
      const data = await res.json();
      localStorage.setItem("flexhrm_employee_token", data.token);
      navigate("/employee-portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-5">
        <div className="text-center">
          <UserCircle size={40} className="text-[#ff791a] mx-auto mb-2" />
          <h1 className="text-lg font-bold text-slate-800">Employee Portal</h1>
          <p className="text-xs text-slate-500 mt-1">{branding.companyName ?? "Flex HRM"}</p>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
        <input
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
          placeholder="Employee Code"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
        <p className="text-center text-xs text-slate-400">
          Portal access must be enabled by your HR admin.
        </p>
      </form>
    </div>
  );
}
