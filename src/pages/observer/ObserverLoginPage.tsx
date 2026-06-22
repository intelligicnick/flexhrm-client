import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import PasswordInput from "../../components/PasswordInput";
import LoginCaptcha from "../../components/auth/LoginCaptcha";
import { useHRMS } from "../../context/HRMSContext";
import { apiUrl, parseApiError } from "../../api";
import { persistObserverToken } from "../../lib/observer-session";
import { Eye } from "lucide-react";

const inputClassName =
  "w-full px-3.5 py-3.5 border border-slate-200 rounded-xl focus:border-[#ff791a] focus:ring-2 focus:ring-orange-100 focus:outline-none text-base text-slate-800 transition bg-slate-50/50 touch-manipulation";

export default function ObserverLoginPage() {
  const navigate = useNavigate();
  const {
    isLoggedIn,
    authBootstrapping,
    usernameInput,
    setUsernameInput,
    passwordInput,
    setPasswordInput,
    captchaInput,
    setCaptchaInput,
    applySessionFromAuthMe,
    setIsLoggedIn,
  } = useHRMS();

  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);

  if (authBootstrapping) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#f4f6f9]">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isLoggedIn) {
    return <Navigate to="/observer" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = usernameInput.trim();
    if (!cleanUser) {
      setLoginError("Please enter a username.");
      return;
    }
    if (!captchaInput.id || !captchaInput.answer.trim()) {
      setLoginError("Please complete the security check.");
      return;
    }
    try {
      setIsLoggingIn(true);
      setLoginError(null);
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-FlexHrm-Client": "observer",
        },
        body: JSON.stringify({
          username: cleanUser,
          password: passwordInput,
          captchaId: captchaInput.id,
          captchaAnswer: captchaInput.answer.trim(),
        }),
      });
      if (!res.ok) {
        throw await parseApiError(res, "Incorrect username or password.");
      }
      const data = await res.json();
      if (data.token) {
        persistObserverToken(data.token);
      }
      localStorage.setItem("hrms_logged_in", "true");
      applySessionFromAuthMe(data);
      setIsLoggedIn(true);
      navigate("/observer", { replace: true });
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Login failed.");
      setCaptchaRefreshKey((key) => key + 1);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#0C1E4A] to-[#1a3568] flex flex-col items-center justify-center px-5 py-8 safe-area-top safe-area-bottom">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff791a] to-[#ff981a] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <Eye size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">Observer Admin</h1>
          <p className="text-sm text-slate-300 mt-1">View key numbers at a glance</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200/50 space-y-4"
        >
          {loginError && (
            <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {loginError}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5">Username</label>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className={inputClassName}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5">Password</label>
            <PasswordInput
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className={`${inputClassName} font-mono pr-12`}
              autoComplete="current-password"
              required
            />
          </div>

          <LoginCaptcha
            value={captchaInput}
            onChange={setCaptchaInput}
            refreshKey={captchaRefreshKey}
          />

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3.5 font-bold rounded-xl text-sm bg-[#ff791a] hover:bg-[#e4640c] text-white shadow-md transition disabled:opacity-70 min-h-[48px] cursor-pointer"
          >
            {isLoggingIn ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-400 mt-6 font-medium">
          Flex HRM · Read-only overview for admins
        </p>
      </div>
    </div>
  );
}
