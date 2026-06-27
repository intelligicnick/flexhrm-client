import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { apiUrl, parseApiError } from "../../api";
import { setCsrfToken } from "../../lib/csrf";

export default function PlatformLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/platform/auth/me"), { credentials: "include" })
      .then((r) => { if (r.ok) navigate("/platform/dashboard"); })
      .catch(() => {});
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/platform/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw await parseApiError(res, "Login failed");
      const data = await res.json();
      if (typeof data.csrfToken === "string") setCsrfToken(data.csrfToken);
      navigate("/platform/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-5">
        <div className="text-center">
          <Shield size={36} className="text-[#ff791a] mx-auto mb-2" />
          <h1 className="text-lg font-bold text-slate-800">Platform Super Admin</h1>
          <p className="text-xs text-slate-500 mt-1">Flex HRM SaaS Management — create & manage company trials</p>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
        <input
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
