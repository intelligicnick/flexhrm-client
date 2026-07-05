import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Ban,
  Loader2,
  RefreshCw,
  X,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { apiUrl } from "../api";

export type FirewallIntent =
  | "api_access"
  | "login_attempt"
  | "registration_probe"
  | "platform_probe"
  | "health_probe"
  | "malicious_scan"
  | "unknown";

export interface FirewallLogEntry {
  id: string;
  timestamp: string;
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  region: string;
  isp: string;
  method: string;
  path: string;
  userAgent: string;
  intent: FirewallIntent;
  blocked: boolean;
  blockReason: string;
  username: string;
}

export interface FirewallBlockEntry {
  ip: string;
  reason: string;
  source: string;
  blockedBy: string;
  active: boolean;
}

export interface FirewallStats {
  totalVisits24h: number;
  blocked24h: number;
  suspicious24h: number;
  foreign24h: number;
  activeBlocks: number;
  whitelistedIps: number;
  indiaOnlyEnabled: boolean;
  failClosedGeo: boolean;
}

export interface FirewallSettings {
  indiaOnlyEnabled: boolean;
  autoBlockScans: boolean;
  logAllRequests: boolean;
  failClosedGeo: boolean;
  loginMaxAttempts: number;
  loginLockoutMinutes: number;
}

export interface FirewallWhitelistEntry {
  ip: string;
  label: string;
  addedBy: string;
}

function intentLabel(intent: FirewallIntent): string {
  const map: Record<FirewallIntent, string> = {
    api_access: "Normal Access",
    login_attempt: "Login Attempt",
    registration_probe: "Registration Probe",
    platform_probe: "Platform Probe",
    health_probe: "Health Check",
    malicious_scan: "Suspicious Scan",
    unknown: "Unknown",
  };
  return map[intent] || intent;
}

function intentColor(intent: FirewallIntent): string {
  if (intent === "malicious_scan") return "text-rose-600 bg-rose-50";
  if (intent === "login_attempt" || intent === "registration_probe") return "text-amber-700 bg-amber-50";
  return "text-slate-600 bg-slate-50";
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface FirewallPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function FirewallPanel({ open, onClose }: FirewallPanelProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<FirewallStats | null>(null);
  const [logs, setLogs] = useState<FirewallLogEntry[]>([]);
  const [blocks, setBlocks] = useState<FirewallBlockEntry[]>([]);
  const [settings, setSettings] = useState<FirewallSettings | null>(null);
  const [whitelist, setWhitelist] = useState<FirewallWhitelistEntry[]>([]);
  const [blockingIp, setBlockingIp] = useState<string | null>(null);
  const [whitelistIp, setWhitelistIp] = useState("");
  const [whitelistLabel, setWhitelistLabel] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, logsRes, blocksRes, settingsRes, whitelistRes] = await Promise.all([
        fetch(apiUrl("/api/firewall/stats"), { credentials: "include" }),
        fetch(apiUrl("/api/firewall/logs"), { credentials: "include" }),
        fetch(apiUrl("/api/firewall/blocks"), { credentials: "include" }),
        fetch(apiUrl("/api/firewall/settings"), { credentials: "include" }),
        fetch(apiUrl("/api/firewall/whitelist"), { credentials: "include" }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
      if (blocksRes.ok) setBlocks(await blocksRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (whitelistRes.ok) setWhitelist(await whitelistRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadData();
  }, [open, loadData]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  const toggleSetting = async (key: keyof FirewallSettings, value: boolean | number) => {
    const res = await fetch(apiUrl("/api/firewall/settings"), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSettings(updated);
      if (stats) {
        setStats({
          ...stats,
          indiaOnlyEnabled: updated.indiaOnlyEnabled,
          failClosedGeo: updated.failClosedGeo,
        });
      }
    }
  };

  const addWhitelist = async () => {
    const ip = whitelistIp.trim();
    if (!ip) return;
    await fetch(apiUrl("/api/firewall/whitelist"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, label: whitelistLabel.trim() || "Trusted IP" }),
    });
    setWhitelistIp("");
    setWhitelistLabel("");
    await loadData();
  };

  const removeWhitelist = async (ip: string) => {
    await fetch(apiUrl(`/api/firewall/whitelist/${encodeURIComponent(ip)}`), {
      method: "DELETE",
      credentials: "include",
    });
    await loadData();
  };

  const blockIp = async (ip: string) => {
    setBlockingIp(ip);
    try {
      await fetch(apiUrl("/api/firewall/blocks"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, reason: "Blocked from firewall panel" }),
      });
      await loadData();
    } finally {
      setBlockingIp(null);
    }
  };

  const unblockIp = async (ip: string) => {
    await fetch(apiUrl(`/api/firewall/blocks/${encodeURIComponent(ip)}`), {
      method: "DELETE",
      credentials: "include",
    });
    await loadData();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-end p-4 md:p-6 bg-black/30 backdrop-blur-[2px]">
      <div
        ref={panelRef}
        className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 animate-fade-in"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-orange-400" />
            <div>
              <p className="text-sm font-bold">Security Firewall</p>
              <p className="text-[10px] text-slate-300">Visitor monitor · India-only access</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void loadData()}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {loading && !stats ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              Loading firewall data…
            </div>
          ) : (
            <>
              {stats && (
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    icon={<Globe size={14} />}
                    label="Visits (24h)"
                    value={stats.totalVisits24h}
                  />
                  <StatCard
                    icon={<Ban size={14} />}
                    label="Blocked (24h)"
                    value={stats.blocked24h}
                    accent="rose"
                  />
                  <StatCard
                    icon={<ShieldAlert size={14} />}
                    label="Suspicious"
                    value={stats.suspicious24h}
                    accent="amber"
                  />
                  <StatCard
                    icon={<MapPin size={14} />}
                    label="Foreign IPs"
                    value={stats.foreign24h}
                    accent="orange"
                  />
                </div>
              )}

              {settings && (
                <div className="rounded-xl border border-slate-200 p-3 space-y-2.5 bg-slate-50/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Firewall Rules
                  </p>
                  <ToggleRow
                    label="India-only access"
                    description="Block visitors outside India"
                    checked={settings.indiaOnlyEnabled}
                    onChange={(v) => void toggleSetting("indiaOnlyEnabled", v)}
                  />
                  <ToggleRow
                    label="Fail-closed geo"
                    description="Block when country cannot be verified"
                    checked={settings.failClosedGeo}
                    onChange={(v) => void toggleSetting("failClosedGeo", v)}
                  />
                  <ToggleRow
                    label="Auto-block scans"
                    description="Block suspicious probe patterns"
                    checked={settings.autoBlockScans}
                    onChange={(v) => void toggleSetting("autoBlockScans", v)}
                  />
                  <ToggleRow
                    label="Log all requests"
                    description="Record every visitor in firewall log"
                    checked={settings.logAllRequests}
                    onChange={(v) => void toggleSetting("logAllRequests", v)}
                  />
                  <div className="pt-1 border-t border-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Login protection
                    </p>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-600">Max failed attempts</span>
                      <select
                        value={settings.loginMaxAttempts}
                        onChange={(e) => void toggleSetting("loginMaxAttempts", Number(e.target.value))}
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs"
                      >
                        {[3, 5, 8, 10].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs mt-2">
                      <span className="text-slate-600">Lockout duration</span>
                      <select
                        value={settings.loginLockoutMinutes}
                        onChange={(e) => void toggleSetting("loginLockoutMinutes", Number(e.target.value))}
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs"
                      >
                        {[15, 30, 60, 120].map((n) => (
                          <option key={n} value={n}>{n} min</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-emerald-200 p-3 space-y-2 bg-emerald-50/40">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Trusted IP whitelist ({whitelist.length})
                </p>
                <p className="text-[10px] text-slate-500">
                  Whitelisted IPs bypass geo block (e.g. admin working abroad).
                </p>
                <div className="flex gap-2">
                  <input
                    value={whitelistIp}
                    onChange={(e) => setWhitelistIp(e.target.value)}
                    placeholder="IP address"
                    className="flex-1 border border-slate-200 rounded-md px-2 py-1 text-xs font-mono"
                  />
                  <input
                    value={whitelistLabel}
                    onChange={(e) => setWhitelistLabel(e.target.value)}
                    placeholder="Label"
                    className="w-24 border border-slate-200 rounded-md px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void addWhitelist()}
                    className="px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-bold"
                  >
                    Add
                  </button>
                </div>
                {whitelist.map((w) => (
                  <div key={w.ip} className="flex items-center justify-between text-xs px-2 py-1.5 bg-white rounded-md border border-emerald-100">
                    <div>
                      <span className="font-mono font-bold text-slate-800">{w.ip}</span>
                      {w.label && <span className="text-slate-500 ml-2">{w.label}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeWhitelist(w.ip)}
                      className="text-rose-600 text-[10px] font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {blocks.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Blocked IPs ({blocks.length})
                  </p>
                  <div className="space-y-1.5">
                    {blocks.map((b) => (
                      <div
                        key={b.ip}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-100 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-rose-800">{b.ip}</p>
                          <p className="text-[10px] text-rose-600 truncate">{b.reason}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void unblockIp(b.ip)}
                          className="shrink-0 px-2 py-1 rounded-md bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 text-[10px] font-bold"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Recent Visitors
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No visitors logged yet</p>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className={`px-3 py-2 rounded-lg border text-xs ${
                          log.blocked
                            ? "bg-rose-50/60 border-rose-100"
                            : "bg-white border-slate-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-slate-800">{log.ip}</span>
                              {log.countryCode && log.countryCode !== "IN" && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-700">
                                  {log.countryCode}
                                </span>
                              )}
                              {log.blocked && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                                  BLOCKED
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {[log.city, log.region, log.country].filter(Boolean).join(", ") || "Unknown location"}
                              {log.isp ? ` · ${log.isp}` : ""}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {log.method} {log.path}
                            </p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${intentColor(log.intent)}`}
                            >
                              {intentLabel(log.intent)}
                            </span>
                            <span className="text-[9px] text-slate-400">{formatWhen(log.timestamp)}</span>
                            {!log.blocked && (
                              <button
                                type="button"
                                disabled={blockingIp === log.ip}
                                onClick={() => void blockIp(log.ip)}
                                className="text-[9px] font-bold text-rose-600 hover:underline disabled:opacity-50"
                              >
                                {blockingIp === log.ip ? "…" : "Block"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
          {settings?.indiaOnlyEnabled ? (
            <>
              <ShieldCheck size={12} className="text-green-600" />
              India-only {settings.failClosedGeo ? "+ fail-closed" : ""} active
            </>
          ) : (
            <>
              <AlertTriangle size={12} className="text-amber-600" />
              India-only restriction disabled
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: "rose" | "amber" | "orange";
}) {
  const accentClass =
    accent === "rose"
      ? "text-rose-700 bg-rose-50 border-rose-100"
      : accent === "amber"
        ? "text-amber-700 bg-amber-50 border-amber-100"
        : accent === "orange"
          ? "text-orange-700 bg-orange-50 border-orange-100"
          : "text-slate-700 bg-white border-slate-100";

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accentClass}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
        {icon}
        {label}
      </div>
      <p className="text-xl font-black mt-1">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <div>
        <p className="text-xs font-bold text-slate-800">{label}</p>
        <p className="text-[10px] text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition shrink-0 ${
          checked ? "bg-[#ff791a]" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
    </label>
  );
}

interface FirewallProfileMenuItemProps {
  onClick: () => void;
}

export function FirewallProfileMenuItem({ onClick }: FirewallProfileMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
      id="firewall-profile-menu-btn"
    >
      <Shield size={14} className="text-emerald-600" />
      Security Firewall
    </button>
  );
}
