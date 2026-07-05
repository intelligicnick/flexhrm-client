import React from "react";
import PasswordInput from "../PasswordInput";
import LoginCaptcha from "./LoginCaptcha";
import { useAuthContext } from "../../context/AuthContext";

const inputClassName =
  "w-full px-3.5 py-3.5 border border-slate-200 rounded-xl focus:border-[#ff791a] focus:ring-2 focus:ring-orange-100 focus:outline-none text-base text-slate-800 transition bg-slate-50/50 touch-manipulation";

const passwordInputClassName = `${inputClassName} font-mono pr-12`;

export default function LoginPage() {
  const {
    loginView,
    loginError,
    usernameInput,
    setUsernameInput,
    passwordInput,
    setPasswordInput,
    captchaInput,
    setCaptchaInput,
    captchaRefreshKey,
    handleLoginSubmit,
    openForgotPassword,
    openRequestNewResetCode,
    forgotError,
    forgotMessage,
    forgotUsername,
    setForgotUsername,
    handleForgotPasswordSubmit,
    backToSignIn,
    resetError,
    resetSuccess,
    issuedResetToken,
    resetTokenInput,
    setResetTokenInput,
    resetNewPassword,
    setResetNewPassword,
    resetConfirmPassword,
    setResetConfirmPassword,
    handleResetPasswordSubmit,
    isLoggingIn,
    isSendingResetCode,
    isUpdatingPassword,
  } = useAuthContext();

  const primaryCtaClass = (busy: boolean) =>
    [
      "w-full py-3.5 sm:py-4 font-bold rounded-xl sm:rounded-2xl text-sm shadow-md transition flex items-center justify-center gap-1.5 touch-manipulation min-h-[48px]",
      busy
        ? "bg-[#d45a0a] text-white shadow-orange-500/10 cursor-wait"
        : "bg-[#ff791a] hover:bg-[#e4640c] active:bg-[#d45a0a] text-white shadow-orange-500/20 active:scale-[0.98] cursor-pointer",
      "disabled:opacity-80 disabled:cursor-not-allowed",
    ].join(" ");

  const labelClassName = "text-xs sm:text-sm font-bold text-slate-600 block mb-1.5";

  return (
    <div
      className="min-h-[100dvh] bg-slate-100 flex flex-col items-center justify-center px-4 py-6 sm:py-8 font-sans relative overflow-x-hidden safe-area-top safe-area-bottom"
      id="login-layout"
    >
      <div className="pointer-events-none absolute top-0 right-0 w-48 h-48 sm:w-96 sm:h-96 bg-orange-100 rounded-full filter blur-3xl opacity-50 -mr-16 -mt-16 sm:-mr-20 sm:-mt-20" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-48 h-48 sm:w-96 sm:h-96 bg-blue-50 rounded-full filter blur-3xl opacity-50 -ml-16 -mb-16 sm:-ml-20 sm:-mb-20" />

      <div
        className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative z-10 animate-fade-in my-auto"
        id="login-card-container"
      >
        <div className="px-5 py-6 sm:p-8 border-b border-slate-100 bg-[#fbfbfb] text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-[#ff791a] to-[#ff981a] flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-md transform rotate-12 shrink-0">
              F
            </div>
            <div className="text-left leading-none min-w-0">
              <span className="text-slate-800 font-extrabold text-lg sm:text-xl tracking-tight block">
                Flex <span className="text-[#ff791a]" id="logo-orange-text">HRM</span>
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">
                an Intelligic product
              </span>
            </div>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
            {loginView === "signin" && "Onboarding Portal Login"}
            {loginView === "forgot" && "Forgot Password"}
            {loginView === "reset" && "Reset Password"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed max-w-sm mx-auto">
            {loginView === "signin" && "Provide your credentials to access the bulk HRMS database"}
            {loginView === "forgot" && "Enter your username or recovery email to receive a one-time reset code"}
            {loginView === "reset" && "Enter your reset code and choose a new password"}
          </p>
        </div>

        {loginView === "signin" && (
          <form onSubmit={handleLoginSubmit} className="px-5 py-6 sm:p-8 space-y-4 sm:space-y-5" id="login-credentials-form">
            {loginError && (
              <div
                className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-sm flex gap-2 items-start animate-shake"
                id="login-error-toast"
              >
                <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px] shrink-0">🚩</span>
                <span className="font-semibold leading-snug">{loginError}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-username-field" className={labelClassName}>
                Username
              </label>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. admin"
                className={inputClassName}
                id="login-username-field"
              />
            </div>

            <div>
              <label htmlFor="login-password-field" className={labelClassName}>
                Password
              </label>
              <PasswordInput
                name="password"
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className={passwordInputClassName}
                id="login-password-field"
              />
            </div>

            <LoginCaptcha
              key={captchaRefreshKey}
              value={captchaInput}
              onChange={setCaptchaInput}
              disabled={isLoggingIn}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none min-h-[44px] sm:min-h-0">
                <input
                  id="login-keep-logged-in"
                  name="keepLoggedIn"
                  type="checkbox"
                  className="rounded text-[#ff791a] focus:ring-[#ff791a] w-4 h-4 shrink-0"
                  defaultChecked
                />
                <span className="text-sm text-slate-500">Keep me logged in</span>
              </label>
              <button
                type="button"
                className="text-sm text-[#ff791a] hover:underline font-semibold cursor-pointer text-left sm:text-right min-h-[44px] sm:min-h-0 flex items-center touch-manipulation"
                onClick={openForgotPassword}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className={primaryCtaClass(isLoggingIn)}
              id="login-submit-button"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Logging in..." : "Sign In"}
            </button>
          </form>
        )}

        {loginView === "forgot" && (
          <form onSubmit={handleForgotPasswordSubmit} className="px-5 py-6 sm:p-8 space-y-4 sm:space-y-5" id="forgot-password-form">
            {forgotError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-sm flex gap-2 items-start animate-shake">
                <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px] shrink-0">🚩</span>
                <span className="font-semibold leading-snug">{forgotError}</span>
              </div>
            )}
            {forgotMessage && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm font-semibold leading-snug">
                {forgotMessage}
              </div>
            )}

            <div>
              <label htmlFor="forgot-username-field" className={labelClassName}>
                Username or Email
              </label>
              <input
                type="text"
                name="username"
                autoComplete="username email"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                placeholder="Username or registered recovery email"
                className={inputClassName}
                id="forgot-username-field"
              />
            </div>

            <button type="submit" className={primaryCtaClass(isSendingResetCode)} disabled={isSendingResetCode}>
              {isSendingResetCode ? "Sending..." : "Send Reset Code"}
            </button>

            <button
              type="button"
              onClick={backToSignIn}
              className="w-full py-3 text-slate-500 hover:text-slate-700 font-semibold rounded-xl text-sm transition cursor-pointer min-h-[44px] touch-manipulation"
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {loginView === "reset" && (
          <form onSubmit={handleResetPasswordSubmit} className="px-5 py-6 sm:p-8 space-y-4 sm:space-y-5" id="reset-password-form">
            {resetError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-sm flex gap-2 items-start animate-shake">
                <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px] shrink-0">🚩</span>
                <span className="font-semibold leading-snug">{resetError}</span>
              </div>
            )}
            {resetSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm font-semibold leading-snug">
                {resetSuccess}
              </div>
            )}
            {forgotMessage && !issuedResetToken && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm font-semibold leading-snug">
                {forgotMessage}
              </div>
            )}
            {issuedResetToken && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-900 text-sm">
                <span className="font-bold block mb-1">Your reset code (valid 15 minutes):</span>
                <span className="font-mono text-lg sm:text-xl tracking-widest font-black break-all">{issuedResetToken}</span>
              </div>
            )}

            <div>
              <label htmlFor="reset-username-field" className={labelClassName}>
                Username
              </label>
              <input
                type="text"
                name="username"
                value={forgotUsername || usernameInput}
                onChange={(e) => setForgotUsername(e.target.value)}
                readOnly={!!issuedResetToken}
                className={`${inputClassName} disabled:bg-slate-50`}
                id="reset-username-field"
              />
            </div>

            <div>
              <label htmlFor="reset-token-field" className={labelClassName}>
                Reset Code
              </label>
              <input
                type="text"
                name="resetToken"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={resetTokenInput}
                onChange={(e) => setResetTokenInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                className={`${inputClassName} font-mono tracking-widest`}
                id="reset-token-field"
              />
            </div>

            <div>
              <label htmlFor="reset-new-password-field" className={labelClassName}>
                New Password
              </label>
              <PasswordInput
                name="newPassword"
                autoComplete="new-password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={passwordInputClassName}
                id="reset-new-password-field"
              />
            </div>

            <div>
              <label htmlFor="reset-confirm-password-field" className={labelClassName}>
                Confirm New Password
              </label>
              <PasswordInput
                name="confirmNewPassword"
                autoComplete="new-password"
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className={passwordInputClassName}
                id="reset-confirm-password-field"
              />
            </div>

            <button type="submit" className={primaryCtaClass(isUpdatingPassword)} disabled={isUpdatingPassword}>
              {isUpdatingPassword ? "Updating..." : "Update Password"}
            </button>

            <button
              type="button"
              onClick={openRequestNewResetCode}
              className="w-full py-3 text-slate-500 hover:text-slate-700 font-semibold rounded-xl text-sm transition cursor-pointer min-h-[44px] touch-manipulation"
            >
              ← Request a new code
            </button>
          </form>
        )}

        <div className="px-4 py-3 sm:p-4 bg-slate-50/70 border-t border-slate-100 text-center text-[11px] sm:text-xs text-slate-400 leading-relaxed">
          🔒 Secured locally. CSV layout compatibility verification enabled.
        </div>
      </div>
    </div>
  );
}
