import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from 'react-router';
import { MapPin, Navigation, RefreshCw } from "lucide-react";
import { apiUrl, parseApiError } from "../../api";

type Punch = {
  punchType: string;
  punchedAt: string;
  withinGeofence: boolean;
  officeLocation?: string;
};

export default function EmployeePortalHomePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [payslips, setPayslips] = useState<Record<string, unknown>[]>([]);
  const [todayPunches, setTodayPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [punchMsg, setPunchMsg] = useState("");
  const [gpsError, setGpsError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, payRes, punchRes] = await Promise.all([
        fetch(apiUrl("/api/employee-portal/me")),
        fetch(apiUrl("/api/employee-portal/payslips")),
        fetch(apiUrl("/api/attendance-punch/employee/today")),
      ]);
      if (meRes.status === 401) {
        localStorage.removeItem("flexhrm_employee_token");
        navigate("/employee-portal/login");
        return;
      }
      if (!meRes.ok) throw await parseApiError(meRes, "Failed to load profile");
      setProfile(await meRes.json());
      if (payRes.ok) setPayslips(await payRes.json());
      if (punchRes.ok) setTodayPunches(await punchRes.json());
    } catch {
      navigate("/employee-portal/login");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  function logout() {
    localStorage.removeItem("flexhrm_employee_token");
    navigate("/employee-portal/login");
  }

  async function handlePunch(punchType: "in" | "out") {
    setPunching(true);
    setPunchMsg("");
    setGpsError("");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("GPS not supported on this device"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const res = await fetch(apiUrl("/api/attendance-punch/employee/punch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          punchType,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          deviceInfo: navigator.userAgent.slice(0, 120),
        }),
      });
      if (!res.ok) throw await parseApiError(res, "Punch failed");
      const data = await res.json();
      setPunchMsg(
        data.withinGeofence
          ? `${punchType === "in" ? "Checked in" : "Checked out"} successfully${data.officeLocation ? ` at ${data.officeLocation}` : ""}`
          : `${punchType === "in" ? "Checked in" : "Checked out"} (outside geofence — flagged for review)`,
      );
      const punchRes = await fetch(apiUrl("/api/attendance-punch/employee/today"));
      if (punchRes.ok) setTodayPunches(await punchRes.json());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Punch failed";
      if (msg.toLowerCase().includes("geolocation") || msg.toLowerCase().includes("gps")) {
        setGpsError("Enable location access in your browser to punch attendance.");
      } else {
        setPunchMsg(msg);
      }
    } finally {
      setPunching(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
      </div>
    );
  }

  const lastPunch = todayPunches[todayPunches.length - 1];
  const nextPunchType: "in" | "out" = !lastPunch || lastPunch.punchType === "out" ? "in" : "out";

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-slate-800">{String(profile?.nameAsPerAadhar ?? "Employee")}</h1>
          <p className="text-xs text-slate-500">{String(profile?.employeeCode ?? "")} · {String(profile?.role ?? "")}</p>
        </div>
        <button onClick={logout} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm">
          Logout
        </button>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <Navigation size={16} className="text-[#ff791a]" /> GPS Attendance
          </div>
          <p className="text-xs text-slate-500">Punch in/out using your device location. Must be within office geofence.</p>
          {gpsError && <p className="text-xs text-red-600">{gpsError}</p>}
          {punchMsg && <p className="text-xs text-green-700 font-medium">{punchMsg}</p>}
          <button
            type="button"
            disabled={punching}
            onClick={() => void handlePunch(nextPunchType)}
            className="w-full py-3 rounded-lg bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            {punching ? <RefreshCw size={16} className="animate-spin" /> : <MapPin size={16} />}
            {punching ? "Getting location…" : nextPunchType === "in" ? "Punch In" : "Punch Out"}
          </button>
          {todayPunches.length > 0 && (
            <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
              <div className="font-semibold text-slate-600">Today&apos;s punches</div>
              {todayPunches.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>{p.punchType === "in" ? "In" : "Out"} · {new Date(p.punchedAt).toLocaleTimeString()}</span>
                  <span className={p.withinGeofence ? "text-green-600" : "text-amber-600"}>
                    {p.withinGeofence ? "On-site" : "Off-site"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-xs text-slate-500">Location</div>
            <div className="text-sm font-bold text-slate-800">{String(profile?.location ?? "—")}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-xs text-slate-500">Mobile</div>
            <div className="text-sm font-bold text-slate-800">{String(profile?.employeeMobile ?? "—")}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-bold text-slate-800 text-sm">Payslips</div>
          {payslips.length === 0 ? (
            <p className="p-4 text-sm text-slate-400 text-center">No payslips available yet</p>
          ) : (
            payslips.slice(0, 6).map((p) => (
              <div key={String(p.monthKey)} className="px-4 py-3 border-t border-slate-50 flex justify-between text-sm">
                <span className="font-medium">{String(p.monthKey)}</span>
                <span className={`font-bold ${p.paymentStatus === "Paid" ? "text-green-600" : "text-amber-600"}`}>
                  {String(p.paymentStatus ?? "Unpaid")}
                </span>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
