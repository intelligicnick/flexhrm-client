import React, { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { apiUrl } from "../api";

interface GeoFirewallGateProps {
  children: React.ReactNode;
}

export default function GeoFirewallGate({ children }: GeoFirewallGateProps) {
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/firewall/check"), { credentials: "include" });
        if (res.status === 403) {
          if (!cancelled) {
            setBlocked(true);
            setChecking(false);
          }
          return;
        }
        if (!res.ok) {
          if (!cancelled) setChecking(false);
          return;
        }
        const data = (await res.json()) as { allowed?: boolean };
        if (!cancelled) {
          setBlocked(data.allowed === false);
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
          <p className="text-sm">Verifying access…</p>
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
          <h1 className="text-xl font-bold text-white">Access Restricted</h1>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
