import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LogIn,
  ShieldAlert,
  Languages,
  Phone,
  Lock,
} from "lucide-react";
import PasswordInput from "../../components/PasswordInput";
import { apiUrl, formatNetworkFetchError } from "../../api";
import { getApiBase } from "../../env";
import { debugSessionLog, getDebugSessionLogs } from "../../lib/debug-session-log";
import { getSupervisorDeviceId, getSupervisorDeviceName } from "../../lib/supervisor-device";
import { supervisorFetch } from "../../lib/supervisor-fetch";
import { clearSupervisorImpersonatedFlag } from "../../lib/supervisor-login";
import {
  clearSupervisorSession,
  ensureSupervisorSessionReady,
  getSupervisorToken,
  persistSupervisorSession,
  restoreSupervisorSessionFromNative,
} from "../../lib/supervisor-session";
import { SupervisorI18nProvider, useSupervisorI18n } from "./SupervisorI18nContext";
import SupervisorBlockedAppsGate from "./SupervisorBlockedAppsGate";
import { SupervisorActionButton } from "./SupervisorUI";

function extractErrorCode(errBody: Record<string, unknown>): string | null {
  const msg = errBody?.message;
  return (
    (typeof errBody?.code === "string" ? errBody.code : null) ||
    (typeof msg === "object" && msg && "code" in msg
      ? String((msg as { code?: string }).code || "")
      : null) ||
    (typeof msg === "string" && msg.includes("DEVICE_MISMATCH") ? "DEVICE_MISMATCH" : null) ||
    (typeof msg === "string" && msg.includes("DEVICE_ALREADY_REGISTERED")
      ? "DEVICE_ALREADY_REGISTERED"
      : null)
  );
}

function extractRegisteredToName(errBody: Record<string, unknown>): string {
  const msg = errBody?.message;
  if (typeof errBody?.registeredToName === "string" && errBody.registeredToName.trim()) {
    return errBody.registeredToName.trim();
  }
  if (typeof msg === "object" && msg && "registeredToName" in msg) {
    const name = String((msg as { registeredToName?: string }).registeredToName || "").trim();
    if (name) return name;
  }
  return "";
}

function LoginForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, lang, setLang } = useSupervisorI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [deviceOtp, setDeviceOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringSession, setRestoringSession] = useState(false);
  const [needsDeviceOtp, setNeedsDeviceOtp] = useState(
    () => searchParams.get("reason") === "device_mismatch",
  );
  const [needsDeviceTransferConfirm, setNeedsDeviceTransferConfirm] = useState(false);
  const [registeredToName, setRegisteredToName] = useState("");
  const [confirmDeviceTransfer, setConfirmDeviceTransfer] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const deviceId = getSupervisorDeviceId();
  const deviceName = getSupervisorDeviceName();

  useEffect(() => {
    const apiBase = getApiBase();
    const loginUrl = apiUrl("/api/auth/supervisor/login");
    // #region agent log
    debugSessionLog(
      "SupervisorLoginPage.tsx:mount",
      "login page ready",
      {
        apiBase,
        loginUrl,
        origin: window.location.origin,
        userAgent: navigator.userAgent,
        hasNativeBridge: Boolean(window.FlexHrmAndroid?.getApiBase),
        nativeApiBase: window.FlexHrmAndroid?.getApiBase?.() || "",
      },
      "B",
    );
    // #endregion
    setDebugInfo(`API: ${apiBase || "(empty)"}`);
  }, []);

  useEffect(() => {
    if (searchParams.get("reason") === "device_mismatch") {
      setNeedsDeviceOtp(true);
      setError(t("deviceMismatch"));
    }
  }, [searchParams, t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      restoreSupervisorSessionFromNative();
      await ensureSupervisorSessionReady();
      const token = getSupervisorToken();
      if (!token) return;

      if (!cancelled) setRestoringSession(true);
      try {
        const res = await supervisorFetch("/api/auth/supervisor/me");
        if (cancelled) return;
        if (res.ok) {
          navigate("/supervisor", { replace: true });
          return;
        }
        if (res.status === 401 || res.status === 403) {
          clearSupervisorSession();
        }
      } catch {
        if (!cancelled && getSupervisorToken()) {
          navigate("/supervisor", { replace: true });
        }
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const completeLogin = async (opts?: { confirmTransfer?: boolean }) => {
    const loginUrl = apiUrl("/api/auth/supervisor/login");
    // #region agent log
    debugSessionLog(
      "SupervisorLoginPage.tsx:completeLogin",
      "login attempt start",
      {
        loginUrl,
        apiBase: getApiBase(),
        deviceIdPresent: Boolean(deviceId),
      },
      "D",
    );
    // #endregion
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.trim(),
        password,
        deviceId,
        deviceName,
        deviceOtp: needsDeviceOtp ? deviceOtp.trim() : undefined,
        confirmDeviceTransfer: opts?.confirmTransfer || confirmDeviceTransfer || undefined,
      }),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const code = extractErrorCode(errBody);
      if (
        code === "DEVICE_MISMATCH" ||
        (res.status === 403 && typeof errBody?.message === "object" && (errBody.message as { code?: string })?.code === "DEVICE_MISMATCH")
      ) {
        setNeedsDeviceOtp(true);
        throw new Error(t("deviceMismatch"));
      }
      if (code === "DEVICE_ALREADY_REGISTERED") {
        const name = extractRegisteredToName(errBody);
        setRegisteredToName(name);
        setNeedsDeviceTransferConfirm(true);
        setConfirmDeviceTransfer(false);
        throw new Error(
          name
            ? t("deviceAlreadyRegisteredNamed").replace("{name}", name)
            : t("deviceAlreadyRegistered"),
        );
      }
      const msg = errBody?.message;
      throw new Error(
        typeof msg === "string"
          ? msg
          : typeof msg === "object" && msg && "message" in msg
            ? String((msg as { message?: string }).message || "Login failed.")
            : "Login failed.",
      );
    }
    const data = await res.json();
    clearSupervisorImpersonatedFlag();
    persistSupervisorSession({
      token: data.token,
      name: data.name || phone,
      supervisorId: data.supervisorId || "",
    });
    navigate("/supervisor");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await completeLogin();
    } catch (err: unknown) {
      const formatted = formatNetworkFetchError(err, "Login failed.");
      const logs = getDebugSessionLogs();
      const last = logs[logs.length - 1];
      // #region agent log
      debugSessionLog(
        "SupervisorLoginPage.tsx:handleSubmit",
        "login attempt failed",
        {
          errorName: err instanceof Error ? err.name : typeof err,
          errorMessage: err instanceof Error ? err.message : String(err),
          formattedMessage: formatted.message,
          lastFetchLog: last?.data ?? null,
        },
        "D",
      );
      // #endregion
      setDebugInfo(
        `API: ${getApiBase() || "(empty)"} | ${formatted.message}${
          last?.data?.errorMessage ? ` | raw: ${String(last.data.errorMessage)}` : ""
        }`,
      );
      setError(formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    setLoading(true);
    setError(null);
    setConfirmDeviceTransfer(true);
    try {
      await completeLogin({ confirmTransfer: true });
    } catch (err: unknown) {
      setError(formatNetworkFetchError(err, "Login failed.").message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTransfer = () => {
    setNeedsDeviceTransferConfirm(false);
    setConfirmDeviceTransfer(false);
    setRegisteredToName("");
    setError(null);
  };

  const transferMessage = registeredToName
    ? t("deviceAlreadyRegisteredNamed").replace("{name}", registeredToName)
    : t("deviceAlreadyRegistered");

  return (
    <div
      className="min-h-[100dvh] bg-[#f4f6f9] flex flex-col items-center justify-center p-4 font-sans"
      id="supervisor-login-layout"
    >
      {restoringSession ? (
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
          <p className="text-sm font-medium">{t("loading")}</p>
        </div>
      ) : (
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
            {error && !needsDeviceTransferConfirm && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs flex gap-2 items-start">
                <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px] shrink-0">!</span>
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {needsDeviceTransferConfirm && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-semibold">{transferMessage}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <SupervisorActionButton
                    type="button"
                    loading={loading}
                    loadingText={t("signingIn")}
                    fullWidth
                    className="py-3 rounded-xl text-sm font-black"
                    onClick={() => void handleConfirmTransfer()}
                  >
                    {t("confirmRegisterDevice")}
                  </SupervisorActionButton>
                  <button
                    type="button"
                    onClick={handleCancelTransfer}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t("cancelRegisterDevice")}
                  </button>
                </div>
              </div>
            )}

            {needsDeviceOtp && !needsDeviceTransferConfirm && (
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
                  disabled={needsDeviceTransferConfirm}
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
                  disabled={needsDeviceTransferConfirm}
                />
              </div>
            </div>

            {needsDeviceOtp && !needsDeviceTransferConfirm && (
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

            {!needsDeviceTransferConfirm && (
              <SupervisorActionButton
                type="submit"
                loading={loading}
                loadingText={t("signingIn")}
                fullWidth
                className="py-4 rounded-2xl text-sm font-black"
                icon={<LogIn size={18} />}
              >
                {needsDeviceOtp ? t("verifyDevice") : t("signIn")}
              </SupervisorActionButton>
            )}
          </form>
        </div>

        <p className="text-[11px] text-slate-400 mt-6 text-center max-w-sm mx-auto leading-relaxed">
          {t("adminLoginHint")}
        </p>
        {debugInfo && (
          <p className="text-[10px] text-slate-500 mt-3 text-center max-w-sm mx-auto leading-relaxed break-all font-mono">
            Debug: {debugInfo}
          </p>
        )}
      </div>
      )}
    </div>
  );
}

export default function SupervisorLoginPage() {
  return (
    <SupervisorI18nProvider>
      <SupervisorBlockedAppsGate>
        <LoginForm />
      </SupervisorBlockedAppsGate>
    </SupervisorI18nProvider>
  );
}
