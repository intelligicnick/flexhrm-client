import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LogIn,
  ShieldAlert,
  Languages,
  Phone,
  Lock,
  Smartphone,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import PasswordInput from "../../components/PasswordInput";
import { apiUrl, formatNetworkFetchError } from "../../api";
import { getSupervisorDeviceId, getSupervisorDeviceName } from "../../lib/supervisor-device";
import {
  canScanInstalledApps,
  findInstalledBlockedApps,
  getInstalledApps,
  isFlexHrmNativeApp,
  openAppUninstall,
  type DetectedBlockedApp,
} from "../../lib/supervisor-installed-apps";
import { clearSupervisorImpersonatedFlag } from "../../lib/supervisor-login";
import { SupervisorI18nProvider, useSupervisorI18n } from "./SupervisorI18nContext";

function BlockedAppsDialog({
  apps,
  scanning,
  onUninstall,
  onRescan,
}: {
  apps: DetectedBlockedApp[];
  scanning: boolean;
  onUninstall: (packageName: string) => void;
  onRescan: () => void;
}) {
  const { t } = useSupervisorI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blocked-apps-dialog-title"
      >
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-rose-600" size={20} />
            </div>
            <h2 id="blocked-apps-dialog-title" className="text-base font-black text-slate-900">
              {t("appsCheckDialogTitle")}
            </h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{t("appsCheckDialogSubtitle")}</p>
        </div>

        <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
          {apps.map((app) => (
            <div
              key={app.packageName}
              className="flex items-center justify-between gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl"
            >
              <p className="text-sm font-bold text-slate-900 truncate min-w-0">
                {app.appName || app.blockedEntry}
              </p>
              <button
                type="button"
                onClick={() => onUninstall(app.packageName)}
                className="shrink-0 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold uppercase tracking-wide"
              >
                {t("appsCheckUninstall")}
              </button>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 space-y-3">
          <p className="text-[11px] text-slate-500 text-center">{t("appsCheckUninstallHint")}</p>
          <button
            type="button"
            onClick={onRescan}
            disabled={scanning}
            className="w-full py-3.5 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
            {scanning ? t("appsCheckScanning") : t("appsCheckRescan")}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const nativeApp = isFlexHrmNativeApp();

  const scanDeviceForBlockedApps = useCallback(async (policy: string[]): Promise<DetectedBlockedApp[]> => {
    if (nativeApp) {
      setCanScanDevice(true);
      setDetectedBlockedApps([]);
      return [];
    }
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
  }, [nativeApp]);

  const fetchBlockedApps = useCallback(async () => {
    if (nativeApp) {
      setBlockedAppsPolicy([]);
      setDetectedBlockedApps([]);
      setCanScanDevice(true);
      setAppsLoading(false);
      return;
    }
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
  }, [nativeApp, scanDeviceForBlockedApps]);

  useEffect(() => {
    void fetchBlockedApps();
  }, [fetchBlockedApps]);

  const mustPassAppsCheck = blockedAppsPolicy.length > 0;
  const showBlockedDialog = mustPassAppsCheck && canScanDevice && detectedBlockedApps.length > 0;
  const loginReady = !appsLoading && !showBlockedDialog;

  useEffect(() => {
    if (!showBlockedDialog) return;

    const rescan = () => {
      void scanDeviceForBlockedApps(blockedAppsPolicy);
    };

    window.addEventListener("focus", rescan);
    const onVisibility = () => {
      if (document.visibilityState === "visible") rescan();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", rescan);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [showBlockedDialog, blockedAppsPolicy, scanDeviceForBlockedApps]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!nativeApp && blockedAppsPolicy.length > 0) {
        if (!canScanInstalledApps()) {
          throw new Error(t("appsCheckNativeAppRequired"));
        }
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
        {!appInstalled && installPromptEvent && blockedAppsPolicy.length === 0 && (
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
        <p className="text-[11px] text-slate-400 mt-6 text-center max-w-sm mx-auto leading-relaxed">
          {t("adminLoginHint")}
        </p>
      </div>
    </div>
  );

  if (!nativeApp && appsLoading) {
    return shell(
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-10 flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin text-[#ff791a]" />
        <p className="text-sm font-semibold text-slate-500">{t("appsCheckScanning")}</p>
      </div>,
    );
  }

  return (
    <>
      {showBlockedDialog && (
        <BlockedAppsDialog
          apps={detectedBlockedApps}
          scanning={appsScanning}
          onUninstall={handleUninstallApp}
          onRescan={handleRescanApps}
        />
      )}
      {shell(
        <div
          className={`bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 overflow-hidden transition-opacity ${
            showBlockedDialog ? "opacity-40 pointer-events-none" : ""
          }`}
        >
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
                  disabled={!loginReady}
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
                  disabled={!loginReady}
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
                  disabled={!loginReady}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || appsScanning || !loginReady}
              className="w-full py-4 bg-[#ff791a] hover:bg-[#e4640c] text-white font-black rounded-2xl text-sm shadow-lg shadow-orange-200/50 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogIn size={18} />
              {loading ? t("signingIn") : needsDeviceOtp ? t("verifyDevice") : t("signIn")}
            </button>
          </form>
        </div>,
      )}
    </>
  );
}

export default function SupervisorLoginPage() {
  return (
    <SupervisorI18nProvider>
      <LoginForm />
    </SupervisorI18nProvider>
  );
}
