import React, { useEffect, useState } from "react";
import { ShieldAlert, Globe, MapPin } from "lucide-react";
import { apiUrl } from "../api";

interface GeoCheckResult {
  allowed: boolean;
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  reason: string;
}

interface GeoFirewallGateProps {
  children: React.ReactNode;
}

export default function GeoFirewallGate({ children }: GeoFirewallGateProps) {
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState<GeoCheckResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/firewall/check"), { credentials: "include" });
        if (res.status === 403) {
          const data = (await res.json().catch(() => ({}))) as GeoCheckResult & { message?: string };
          if (!cancelled) {
            setBlocked({
              allowed: false,
              ip: data.ip || "",
              country: data.country || "Unknown",
              countryCode: data.countryCode || "",
              city: data.city || "",
              reason: data.reason || data.message || "Access denied by firewall",
            });
            setChecking(false);
          }
          return;
        }
        if (!res.ok) {
          if (!cancelled) setChecking(false);
          return;
        }
        const data = (await res.json()) as GeoCheckResult;
        if (!cancelled) {
          if (!data.allowed) {
            setBlocked(data);
          }
          setChecking(false);
        }
      } catch {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
          <p className="text-sm">Verifying access region…</p>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-md w-full bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 flex items-center justify-center mb-5">
            <ShieldAlert size={32} className="text-rose-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Access Restricted</h1>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            This portal is only available from India. Your connection was blocked by the security firewall.
          </p>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-left space-y-2 mb-6">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Globe size={14} className="text-orange-400 shrink-0" />
              <span>
                Detected region:{" "}
                <strong className="text-white">
                  {blocked.country || "Unknown"}
                  {blocked.countryCode ? ` (${blocked.countryCode})` : ""}
                </strong>
              </span>
            </div>
            {blocked.city && (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <MapPin size={14} className="text-orange-400 shrink-0" />
                <span>
                  City: <strong className="text-white">{blocked.city}</strong>
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              IP: {blocked.ip}
            </div>
          </div>
          {blocked.reason && (
            <p className="text-xs text-slate-500">{blocked.reason}</p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
