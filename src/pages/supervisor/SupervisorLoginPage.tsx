import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LogIn,
  ShieldAlert,
  Languages,
  Phone,
  Lock,
  Smartphone,
  Trash2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import PasswordInput from "../../components/PasswordInput";
import { apiUrl, formatNetworkFetchError } from "../../api";
import { getSupervisorDeviceId, getSupervisorDeviceName } from "../../lib/supervisor-device";
import {
  canScanInstalledApps,
  findInstalledBlockedApps,
  getInstalledApps,
  openAppUninstall,
  type DetectedBlockedApp,
} from "../../lib/supervisor-installed-apps";
import { clearSupervisorImpersonatedFlag } from "../../lib/supervisor-login";
import { SupervisorI18nProvider, useSupervisorI18n } from "./SupervisorI18nContext";

function LoginForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, lang, setLang } = useSupervisorI18n();
  const [blockedAppsPolicy, setBlockedAppsPolicy] = useState<string[]>([]);
  const [detectedBlockedApps, setDetectedBlockedApps] = useState<DetectedBlockedApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsScanning, setAppsScanning] = useState(false);
  const [canScanDevice, setCanScanDevice] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [deviceOtp, setDeviceOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsDeviceOtp, setNeedsDeviceOtp] = useState(
    () => searchParams.get("reason") === "device_mismatch",
  );
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installingApp, setInstallingApp] = useState(false);
  const [appInstalled, setAppInstalled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches,
  );

  const deviceId = getSupervisorDeviceId();
  const deviceName = getSupervisorDeviceName();

  const scanDeviceForBlockedApps = useCallback(async (policy: string[]): Promise<DetectedBlockedApp[]> => {
    setAppsScanning(true);
    try {
      const scanAvailable = canScanInstalledApps();
      setCanScanDevice(scanAvailable);

      if (!scanAvailable || policy.length === 0) {
        setDetectedBlockedApps([]);
        return [];
      }

      const installedApps = await getInstalledApps();
      const detected = findInstalledBlockedApps(policy, installedApps);
      setDetectedBlockedApps(detected);
      return detected;
    } catch {
      setDetectedBlockedApps([]);
      return [];
    } finally {
      setAppsScanning(false);
    }
  }, []);

  const fetchBlockedApps = useCallback(async () => {
    setAppsLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/supervisor/portal-policy"));
      let policy: string[] = [];
      if (res.ok) {
        const data = await res.json();
        policy = Array.isArray(data.blockedAppsToUninstall) ? data.blockedAppsToUninstall : [];
      }
      setBlockedAppsPolicy(policy);
      await scanDeviceForBlockedApps(policy);
    } catch {
      setBlockedAppsPolicy([]);
      setDetectedBlockedApps([]);
    } finally {
      setAppsLoading(false);
    }
  }, [scanDeviceForBlockedApps]);

  useEffect(() => {
    void fetchBlockedApps();
  }, [fetchBlockedApps]);

  const loginBlockedByApps = canScanDevice && detectedBlockedApps.length > 0;

  useEffect(() => {
    if (searchParams.get("reason") === "device_mismatch") {
      setNeedsDeviceOtp(true);
      setError(t("deviceMismatch"));
    }
  }, [searchParams, t]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setAppInstalled(true);
      setInstallPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPromptEvent) return;
    setInstallingApp(true);
    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setAppInstalled(true);
      }
      setInstallPromptEvent(null);
    } finally {
      setInstallingApp(false);
    }
  };

  const handleRescanApps = () => {
    void scanDeviceForBlockedApps(blockedAppsPolicy);
  };

  const handleUninstallApp = (packageName: string) => {
    openAppUninstall(packageName);
  };

  const renderBlockedAppsScan = () => {
    if (appsLoading || blockedAppsPolicy.length === 0) return null;

    if (appsScanning) {
      return (
        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span>{t("appsCheckScanning")}</span>
        </div>
      );
    }

    if (!canScanDevice) {
      return (
        <div className="space-y-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-xs text-amber-800 leading-relaxed">{t("appsCheckInstallAppHint")}</p>
          <ul className="space-y-1.5">
            {blockedAppsPolicy.map((app) => (
              <li
                key={app}
                className="flex items-center gap-2 text-xs font-semibold text-amber-900"
              >
                <Trash2 size={12} className="text-amber-600 shrink-0" />
                <span className="truncate">{app}</span>
              </li>
            ))}
          </ul>
          {!appInstalled && installPromptEvent && (
            <button
              type="button"
              onClick={() => void handleInstallApp()}
              disabled={installingApp}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs font-bold text-[#ff791a] shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Smartphone size={14} />
              {installingApp ? t("loading") : t("installFieldTeamApp")}
            </button>
          )}
        </div>
      );
    }

    if (detectedBlockedApps.length === 0) {
      return (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs">
          <CheckCircle2 size={14} className="shrink-0" />
          <span className="font-semibold">{t("appsCheckClear")}</span>
        </div>
      );
    }

    return (
      <div className="space-y-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
        <p className="text-xs font-semibold text-rose-700">{t("appsCheckFound")}</p>
        <ul className="space-y-2">
          {detectedBlockedApps.map((app) => (
            <li
              key={app.packageName}
              className="flex items-center justify-between gap-3 p-2.5 bg-white border border-rose-100 rounded-lg text-sm font-semibold text-rose-900"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Trash2 size={14} className="text-rose-500 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-xs">{app.appName || app.blockedEntry}</p>
                  <p className="text-[10px] font-mono text-rose-600/80 truncate">{app.packageName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleUninstallApp(app.packageName)}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase tracking-wide"
              >
                {t("appsCheckUninstall")}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500">{t("appsCheckUninstallHint")}</p>
        <button
          type="button"
          onClick={handleRescanApps}
          disabled={appsScanning}
          className="w-full py-2.5 border border-rose-200 rounded-lg text-[11px] font-bold text-rose-700 hover:bg-rose-100/50 flex items-center justify-center gap-2"
        >
          <Smartphone size={12} />
          {t("appsCheckRescan")}
        </button>
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (blockedAppsPolicy.length > 0 && canScanInstalledApps()) {
        const detected = await scanDeviceForBlockedApps(blockedAppsPolicy);
        if (detected.length > 0) {
          throw new Error(t("appsCheckFound"));
        }
      }
      const res = await fetch(apiUrl("/api/auth/supervisor/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          password,
          deviceId,
          deviceName,
          deviceOtp: needsDeviceOtp ? deviceOtp.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody?.message;
        const code =
          errBody?.code ||
          (typeof msg === "object" && msg?.code) ||
          (typeof msg === "string" && msg.includes("DEVICE_MISMATCH") ? "DEVICE_MISMATCH" : null);
        if (code === "DEVICE_MISMATCH" || (res.status === 403 && typeof msg === "object" && msg?.code === "DEVICE_MISMATCH")) {
          setNeedsDeviceOtp(true);
          throw new Error(t("deviceMismatch"));
        }
        throw new Error(
          typeof msg === "string"
            ? msg
            : typeof msg === "object" && msg?.message
              ? String(msg.message)
              : "Login failed.",
        );
      }
      const data = await res.json();
      clearSupervisorImpersonatedFlag();
      localStorage.setItem("hrms_supervisor_token", data.token);
      localStorage.setItem("hrms_supervisor_name", data.name || phone);
      localStorage.setItem("hrms_supervisor_id", data.supervisorId || "");
      navigate("/supervisor");
    } catch (err: unknown) {
      setError(formatNetworkFetchError(err, "Login failed.").message);
    } finally {
      setLoading(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div
      className="min-h-[100dvh] bg-[#f4f6f9] flex flex-col items-center justify-center p-4 font-sans"
      id="supervisor-login-layout"
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff791a] to-[#ff981a] text-white font-black text-2xl shadow-lg shadow-orange-200/50 mb-4">
            F
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Flex <span className="text-[#ff791a]">HRM</span>
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">{t("appTitle")}</p>
        </div>
        {children}
        {!appInstalled && installPromptEvent && step === "login" && (blockedAppsPolicy.length === 0 || canScanDevice) && (
          <button
            type="button"
            onClick={() => void handleInstallApp()}
            disabled={installingApp}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-[#ff791a] shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Smartphone size={16} />
            {installingApp ? t("loading") : t("installFieldTeamApp")}
          </button>
        )}
        {step === "login" && (
          <p className="text-[11px] text-slate-400 mt-6 text-center max-w-sm mx-auto leading-relaxed">
            {t("adminLoginHint")}
          </p>
        )}
      </div>
    </div>
  );

  return shell(
    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">{t("loginTitle")}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t("loginSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setLang(lang === "en" ? "hi" : "en")}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-slate-100"
        >
          <Languages size={12} />
          {lang === "en" ? "हिंदी" : "English"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4" id="supervisor-login-form">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs flex gap-2 items-start">
            <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px] shrink-0">!</span>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {needsDeviceOtp && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
            <div className="flex items-center gap-2 font-bold mb-1">
              <ShieldAlert size={14} />
              {t("deviceMismatch")}
            </div>
            <p>{t("deviceOtpHint")}</p>
          </div>
        )}

        {renderBlockedAppsScan()}

        <div>
          <label htmlFor="supervisor-login-phone" className="text-xs font-bold text-slate-600 block mb-1.5">
            {t("mobileNumber")}
          </label>
          <div className="relative">
            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="supervisor-login-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className="w-full pl-10 pr-4 py-3.5 border border-slate-200 rounded-xl focus:border-[#ff791a] focus:ring-2 focus:ring-orange-100 focus:outline-none text-base bg-slate-50/50"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="supervisor-login-password" className="text-xs font-bold text-slate-600 block mb-1.5">
            {t("password")}
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
            <PasswordInput
              id="supervisor-login-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-3.5 border border-slate-200 rounded-xl focus:border-[#ff791a] focus:ring-2 focus:ring-orange-100 focus:outline-none text-base font-mono bg-slate-50/50"
              required
            />
          </div>
        </div>

        {needsDeviceOtp && (
          <div>
            <label htmlFor="supervisor-device-otp" className="text-xs font-bold text-slate-600 block mb-1.5">
              {t("deviceOtp")}
            </label>
            <input
              id="supervisor-device-otp"
              type="text"
              inputMode="numeric"
              value={deviceOtp}
              onChange={(e) => setDeviceOtp(e.target.value)}
              placeholder="6-digit OTP from admin"
              className="w-full px-4 py-3.5 border border-amber-300 rounded-xl focus:border-[#ff791a] focus:outline-none text-base tracking-widest font-mono bg-amber-50/30"
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || appsScanning || loginBlockedByApps}
          className="w-full py-4 bg-[#ff791a] hover:bg-[#e4640c] text-white font-black rounded-2xl text-sm shadow-lg shadow-orange-200/50 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <LogIn size={18} />
          {loading ? t("signingIn") : appsScanning ? t("appsCheckScanning") : needsDeviceOtp ? t("verifyDevice") : t("signIn")}
        </button>
      </form>
    </div>,
  );
}

export default function SupervisorLoginPage() {
  return (
    <SupervisorI18nProvider>
      <LoginForm />
    </SupervisorI18nProvider>
  );
}
