import React, { useCallback, useEffect, useState } from "react";
import { CalendarOff, CheckCircle, Clock, Plus, XCircle } from "lucide-react";
import { apiUrl, parseApiError } from "../api";

interface LeaveType {
  id: string;
  name: string;
  code: string;
  defaultDays: number;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  appliedBy: string;
}

export default function LeavePage() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    days: 1,
    reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [typesRes, reqRes] = await Promise.all([
        fetch(apiUrl("/api/leave/types"), { credentials: "include" }),
        fetch(apiUrl("/api/leave/requests?pageSize=100"), { credentials: "include" }),
      ]);
      if (!typesRes.ok) throw await parseApiError(typesRes, "Failed to load leave types");
      if (!reqRes.ok) throw await parseApiError(reqRes, "Failed to load leave requests");
      setTypes(await typesRes.json());
      const reqData = await reqRes.json();
      setRequests(reqData.items ?? reqData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leave data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(apiUrl("/api/leave/requests"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      alert(await parseApiError(res, "Failed to apply leave"));
      return;
    }
    setShowForm(false);
    setForm({ employeeId: "", leaveTypeId: "", startDate: "", endDate: "", days: 1, reason: "" });
    void load();
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? prompt("Rejection reason:") ?? "" : "";
    const res = await fetch(apiUrl(`/api/leave/requests/${id}/${action}`), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      alert(await parseApiError(res, `Failed to ${action} leave`));
      return;
    }
    void load();
  }

  const statusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle size={14} className="text-green-600" />;
    if (status === "rejected") return <XCircle size={14} className="text-red-500" />;
    return <Clock size={14} className="text-amber-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CalendarOff size={20} className="text-[#ff791a]" />
            Leave Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">Apply, approve, and track employee leave requests</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg transition"
        >
          <Plus size={14} /> Apply Leave
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {types.map((t) => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-bold text-slate-500 uppercase">{t.code}</div>
            <div className="text-sm font-bold text-slate-800 mt-1">{t.name}</div>
            <div className="text-xs text-slate-400 mt-1">{t.defaultDays} days/year</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleApply} className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-800">Apply Leave</h3>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Employee ID"
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              required
            />
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={form.leaveTypeId}
              onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
              required
            >
              <option value="">Select leave type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
            </div>
            <input type="number" min={1} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Days" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} required />
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-[#ff791a] text-white text-sm font-bold rounded-lg">Submit</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="text-left p-3">Employee</th>
              <th className="text-left p-3">Dates</th>
              <th className="text-left p-3">Days</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">No leave requests yet</td></tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3 font-medium text-slate-700">{r.employeeId}</td>
                  <td className="p-3 text-slate-600">{r.startDate} → {r.endDate}</td>
                  <td className="p-3">{r.days}</td>
                  <td className="p-3 flex items-center gap-1 capitalize">{statusIcon(r.status)} {r.status}</td>
                  <td className="p-3">
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => void handleAction(r.id, "approve")} className="text-xs text-green-600 font-bold hover:underline">Approve</button>
                        <button onClick={() => void handleAction(r.id, "reject")} className="text-xs text-red-500 font-bold hover:underline">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
