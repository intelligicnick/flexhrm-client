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
  isAndroidDevice,
  openAppUninstall,
  type DetectedBlockedApp,
} from "../../lib/supervisor-installed-apps";
import { clearSupervisorImpersonatedFlag } from "../../lib/supervisor-login";
import { SupervisorI18nProvider, useSupervisorI18n } from "./SupervisorI18nContext";

type LoginStep = "apps" | "login" | "device";

function LoginForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, lang, setLang } = useSupervisorI18n();
  const [step, setStep] = useState<LoginStep>("apps");
  const [blockedAppsPolicy, setBlockedAppsPolicy] = useState<string[]>([]);
  const [detectedBlockedApps, setDetectedBlockedApps] = useState<DetectedBlockedApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsScanning, setAppsScanning] = useState(false);
  const [canScanDevice, setCanScanDevice] = useState(false);
  const [appsConfirmed, setAppsConfirmed] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [deviceOtp, setDeviceOtp] = useState("");
  const [needsDeviceOtp, setNeedsDeviceOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceRegistering, setDeviceRegistering] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installingApp, setInstallingApp] = useState(false);
  const [appInstalled, setAppInstalled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches,
  );

  const deviceId = getSupervisorDeviceId();
  const deviceName = getSupervisorDeviceName();

  const scanDeviceForBlockedApps = useCallback(async (policy: string[]) => {
    setAppsScanning(true);
    try {
      const scanAvailable = canScanInstalledApps();
      setCanScanDevice(scanAvailable);

      if (!scanAvailable || policy.length === 0) {
        setDetectedBlockedApps([]);
        return;
      }

      const installedApps = await getInstalledApps();
      setDetectedBlockedApps(findInstalledBlockedApps(policy, installedApps));
    } catch {
      setDetectedBlockedApps([]);
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

  const requiresManualAppsConfirm =
    blockedAppsPolicy.length > 0 && !canScanDevice && isAndroidDevice();

  const appsGateActive =
    blockedAppsPolicy.length > 0 &&
    (canScanDevice ? detectedBlockedApps.length > 0 : requiresManualAppsConfirm);

  useEffect(() => {
    if (!appsLoading && !appsScanning && !appsGateActive) {
      setStep("login");
    }
  }, [appsLoading, appsScanning, appsGateActive]);

  useEffect(() => {
    const requestedStep = searchParams.get("step");
    const token = localStorage.getItem("hrms_supervisor_token");
    if (requestedStep === "device" && token) {
      setStep("device");
    }
  }, [searchParams]);

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

  const handleAppsContinue = () => {
    if (requiresManualAppsConfirm && !appsConfirmed) return;
    if (canScanDevice && detectedBlockedApps.length > 0) return;
    setStep("login");
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

      if (data.needsDeviceRegistration) {
        setStep("device");
        return;
      }
      navigate("/supervisor");
    } catch (err: unknown) {
      setError(formatNetworkFetchError(err, "Login failed.").message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDevice = async () => {
    const token = localStorage.getItem("hrms_supervisor_token");
    if (!token) {
      setStep("login");
      setError("Please sign in first.");
      return;
    }
    setDeviceRegistering(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/supervisor/register-device"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
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
          null;
        if (code === "DEVICE_MISMATCH") {
          setNeedsDeviceOtp(true);
          throw new Error(t("deviceMismatch"));
        }
        throw new Error(
          typeof msg === "string"
            ? msg
            : typeof msg === "object" && msg?.message
              ? String(msg.message)
              : "Device registration failed.",
        );
      }
      setDeviceRegistered(true);
    } catch (err: unknown) {
      setError(formatNetworkFetchError(err, "Device registration failed.").message);
    } finally {
      setDeviceRegistering(false);
    }
  };

  const handleContinueToApp = () => {
    navigate("/supervisor");
  };

  const handleBackToLogin = () => {
    localStorage.removeItem("hrms_supervisor_token");
    localStorage.removeItem("hrms_supervisor_name");
    localStorage.removeItem("hrms_supervisor_id");
    setStep("login");
    setDeviceRegistered(false);
    setNeedsDeviceOtp(false);
    setDeviceOtp("");
    setError(null);
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
        {!appInstalled && installPromptEvent && step === "login" && (
          <button
            type="button"
            onClick={() => void handleInstallApp()}
            disabled={installingApp}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-[#ff791a] shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Smartphone size={16} />
            {installingApp ? t("loading") : "Install Field Team App"}
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

  if (step === "apps") {
    return shell(
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">{t("appsCheckTitle")}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t("appsCheckSubtitle")}</p>
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
        <div className="p-6 space-y-4">
          {appsLoading || appsScanning ? (
            <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">{appsScanning ? t("appsCheckScanning") : t("loading")}</span>
            </div>
          ) : blockedAppsPolicy.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-4">{t("appsCheckEmpty")}</p>
          ) : canScanDevice ? (
            detectedBlockedApps.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-700">{t("appsCheckClear")}</p>
                <p className="text-xs text-slate-500">{t("appsCheckClearHint")}</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-rose-700">{t("appsCheckFound")}</p>
                <ul className="space-y-2">
                  {detectedBlockedApps.map((app) => (
                    <li
                      key={app.packageName}
                      className="flex items-center justify-between gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-semibold text-rose-900"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Trash2 size={16} className="text-rose-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate">{app.appName || app.blockedEntry}</p>
                          <p className="text-[10px] font-mono text-rose-600/80 truncate">{app.packageName}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUninstallApp(app.packageName)}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase tracking-wide"
                      >
                        {t("appsCheckUninstall")}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">{t("appsCheckUninstallHint")}</p>
                <button
                  type="button"
                  onClick={handleRescanApps}
                  disabled={appsScanning}
                  className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <Smartphone size={14} />
                  {t("appsCheckRescan")}
                </button>
              </>
            )
          ) : requiresManualAppsConfirm ? (
            <>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
                {t("appsCheckManualHint")}
              </p>
              <ul className="space-y-2">
                {blockedAppsPolicy.map((app) => (
                  <li
                    key={app}
                    className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-semibold text-rose-900"
                  >
                    <Trash2 size={16} className="text-rose-500 shrink-0" />
                    {app}
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={appsConfirmed}
                  onChange={(e) => setAppsConfirmed(e.target.checked)}
                  className="mt-0.5 accent-[#ff791a]"
                />
                <span className="text-xs font-semibold text-slate-700">{t("appsCheckConfirm")}</span>
              </label>
            </>
          ) : (
            <p className="text-sm text-slate-600 text-center py-4">{t("appsCheckEmpty")}</p>
          )}
          <button
            type="button"
            onClick={handleAppsContinue}
            disabled={
              appsLoading ||
              appsScanning ||
              (requiresManualAppsConfirm && !appsConfirmed) ||
              (canScanDevice && detectedBlockedApps.length > 0)
            }
            className="w-full py-4 bg-[#ff791a] hover:bg-[#e4640c] text-white font-black rounded-2xl text-sm shadow-lg shadow-orange-200/50 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {t("appsCheckContinue")}
          </button>
        </div>
      </div>,
    );
  }

  if (step === "device") {
    return shell(
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-900">{t("registerDeviceTitle")}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t("registerDeviceSubtitle")}</p>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs flex gap-2 items-start">
              <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px] shrink-0">!</span>
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {deviceRegistered ? (
            <div className="text-center py-4 space-y-4">
              <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
              <p className="text-sm font-bold text-emerald-700">{t("deviceRegisteredSuccess")}</p>
              <button
                type="button"
                onClick={handleContinueToApp}
                className="w-full py-4 bg-[#ff791a] hover:bg-[#e4640c] text-white font-black rounded-2xl text-sm shadow-lg shadow-orange-200/50"
              >
                {t("continueToApp")}
              </button>
            </div>
          ) : (
            <>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <Smartphone className="text-[#ff791a] shrink-0" size={24} />
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">{t("thisDeviceName")}</p>
                    <p className="text-sm font-bold text-slate-900">{deviceName}</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-mono break-all">{deviceId}</p>
              </div>

              <p className="text-xs text-slate-500">{t("registerDeviceHint")}</p>

              {needsDeviceOtp && (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <ShieldAlert size={14} />
                      {t("deviceMismatch")}
                    </div>
                    <p>{t("deviceOtpHint")}</p>
                  </div>
                  <div>
                    <label htmlFor="supervisor-device-otp-register" className="text-xs font-bold text-slate-600 block mb-1.5">
                      {t("deviceOtp")}
                    </label>
                    <input
                      id="supervisor-device-otp-register"
                      type="text"
                      inputMode="numeric"
                      value={deviceOtp}
                      onChange={(e) => setDeviceOtp(e.target.value)}
                      placeholder="6-digit OTP from admin"
                      className="w-full px-4 py-3.5 border border-amber-300 rounded-xl focus:border-[#ff791a] focus:outline-none text-base tracking-widest font-mono bg-amber-50/30"
                    />
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={handleRegisterDevice}
                disabled={deviceRegistering || (needsDeviceOtp && !deviceOtp.trim())}
                className="w-full py-4 bg-[#ff791a] hover:bg-[#e4640c] text-white font-black rounded-2xl text-sm shadow-lg shadow-orange-200/50 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deviceRegistering ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t("registeringDevice")}
                  </>
                ) : (
                  <>
                    <Smartphone size={18} />
                    {t("registerDeviceButton")}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full py-3 text-slate-500 font-bold text-sm hover:text-slate-700"
              >
                {t("backToLogin")}
              </button>
            </>
          )}
        </div>
      </div>,
    );
  }

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
          disabled={loading}
          className="w-full py-4 bg-[#ff791a] hover:bg-[#e4640c] text-white font-black rounded-2xl text-sm shadow-lg shadow-orange-200/50 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <LogIn size={18} />
          {loading ? t("signingIn") : needsDeviceOtp ? t("verifyDevice") : t("signIn")}
        </button>

        {appsGateActive && (
          <button
            type="button"
            onClick={() => {
              setAppsConfirmed(false);
              setStep("apps");
              void scanDeviceForBlockedApps(blockedAppsPolicy);
            }}
            className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            ← {t("appsCheckTitle")}
          </button>
        )}
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
