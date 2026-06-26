import React, { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Smartphone } from "lucide-react";
import { apiUrl } from "../../api";
import { isSupervisorWebDevHost } from "../../env";
import {
  canScanInstalledApps,
  type DetectedBlockedApp,
  findInstalledBlockedApps,
  getInstalledApps,
  isFlexHrmNativeApp,
  openAppUninstall,
} from "../../lib/supervisor-installed-apps";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import { SupervisorActionButton } from "./SupervisorUI";

type GatePhase = "scanning" | "blocked" | "clear" | "native_required";

const BLOCKED_APPS_CACHE_KEY = "hrms_supervisor_blocked_apps_cache";

function loadCachedBlockedApps(): string[] {
  try {
    const raw = localStorage.getItem(BLOCKED_APPS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function saveCachedBlockedApps(apps: string[]): void {
  try {
    localStorage.setItem(BLOCKED_APPS_CACHE_KEY, JSON.stringify(apps));
  } catch {
    /* ignore */
  }
}

export default function SupervisorBlockedAppsGate({ children }: { children: React.ReactNode }) {
  const { t } = useSupervisorI18n();
  const nativeApp = isFlexHrmNativeApp();
  const webDev = isSupervisorWebDevHost();
  const [phase, setPhase] = useState<GatePhase>(nativeApp || webDev ? "clear" : "scanning");
  const [detected, setDetected] = useState<DetectedBlockedApp[]>([]);

  const runScan = useCallback(async () => {
    if (nativeApp || webDev) {
      setDetected([]);
      setPhase("clear");
      return;
    }

    setPhase("scanning");
    try {
      let blocked: string[] = [];
      try {
        const res = await fetch(apiUrl("/api/auth/supervisor/portal-policy"));
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.blockedAppsToUninstall)) {
            blocked = data.blockedAppsToUninstall;
            if (blocked.length > 0) {
              saveCachedBlockedApps(blocked);
            }
          }
        }
      } catch {
        blocked = loadCachedBlockedApps();
      }

      if (blocked.length === 0) {
        blocked = loadCachedBlockedApps();
      }

      if (!canScanInstalledApps()) {
        if (nativeApp) {
          setDetected([]);
          setPhase("clear");
          return;
        }
        setPhase("native_required");
        return;
      }

      const installed = await getInstalledApps();
      const found = findInstalledBlockedApps(blocked, installed);
      if (found.length > 0) {
        setDetected(found);
        setPhase("blocked");
      } else {
        setDetected([]);
        setPhase("clear");
      }
    } catch {
      if (nativeApp) {
        setDetected([]);
        setPhase("clear");
        return;
      }
      setPhase("native_required");
    }
  }, [nativeApp, webDev]);

  useEffect(() => {
    if (!nativeApp && !webDev) void runScan();
  }, [nativeApp, webDev, runScan]);

  useEffect(() => {
    if (nativeApp || webDev) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runScan();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [nativeApp, webDev, runScan]);

  if (phase === "scanning") {
    return (
      <div className="min-h-[100dvh] bg-[#f4f6f9] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-600">{t("appsCheckScanning")}</p>
      </div>
    );
  }

  if (phase === "native_required") {
    return (
      <div className="min-h-[100dvh] bg-[#f4f6f9] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl border border-amber-200 shadow-xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 mb-4">
            <Smartphone size={28} />
          </div>
          <h2 className="text-lg font-black text-slate-900 mb-2">{t("appsCheckDialogTitle")}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{t("appsCheckPwaNotEnough")}</p>
        </div>
      </div>
    );
  }

  if (phase === "blocked") {
    return (
      <div className="min-h-[100dvh] bg-[#f4f6f9] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-rose-200 shadow-xl overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-rose-100 bg-rose-50/60">
            <div className="flex items-center gap-2 text-rose-700 font-black text-lg">
              <ShieldAlert size={20} />
              {t("appsCheckDialogTitle")}
            </div>
            <p className="text-xs text-rose-700/80 mt-2 leading-relaxed">
              {detected.length === 1
                ? `${detected[0].appName || detected[0].blockedEntry} is installed on your device. Please remove it to proceed.`
                : t("appsCheckDialogSubtitle")}
            </p>
          </div>

          <div className="p-4 space-y-3">
            {detected.map((app) => (
              <div
                key={app.packageName}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">
                    {app.appName || app.blockedEntry}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{app.packageName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openAppUninstall(app.packageName)}
                  className="shrink-0 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 cursor-pointer"
                >
                  {t("appsCheckUninstall")}
                </button>
              </div>
            ))}
          </div>

          <div className="px-4 pb-5 space-y-3">
            <p className="text-[11px] text-slate-500 text-center">{t("appsCheckUninstallHint")}</p>
            <SupervisorActionButton
              type="button"
              onClick={() => void runScan()}
              loading={phase === "scanning"}
              loadingText={t("loading")}
              fullWidth
              className="py-3.5 text-sm font-black"
            >
              {t("appsCheckRescan")}
            </SupervisorActionButton>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
