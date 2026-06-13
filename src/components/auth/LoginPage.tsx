import React from "react";
import PasswordInput from "../PasswordInput";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useHRMS } from "../../context/HRMSContext";

export default function LoginPage() {
  const {
    loginView,
    loginError,
    usernameInput,
    setUsernameInput,
    passwordInput,
    setPasswordInput,
    handleLoginSubmit,
    openForgotPassword,
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
    setLoginView,
  } = useHRMS();

  return (
              <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden" id="login-layout">
                <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100 rounded-full filter blur-3xl opacity-50 -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 rounded-full filter blur-3xl opacity-50 -ml-20 -mb-20"></div>
    
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative z-10 animate-fade-in" id="login-card-container">
                  <div className="p-8 border-b border-slate-100 bg-[#fbfbfb] text-center">
                    {/* FlexHRM stylized logo */}
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff791a] to-[#ff981a] flex items-center justify-center text-white font-black text-2xl shadow-md transform rotate-12">
                        F
                      </div>
                      <div className="text-left leading-none">
                        <span className="text-slate-800 font-extrabold text-xl tracking-tight block">Flex <span className="text-[#ff791a]" id="logo-orange-text">HRM</span></span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">an Intelligic product</span>
                      </div>
                    </div>
                
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                      {loginView === "signin" && "Onboarding Portal Login"}
                      {loginView === "forgot" && "Forgot Password"}
                      {loginView === "reset" && "Reset Password"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {loginView === "signin" && "Provide your credentials to access the bulk HRMS database"}
                      {loginView === "forgot" && "Enter your username or recovery email to receive a one-time reset code"}
                      {loginView === "reset" && "Enter your reset code and choose a new password"}
                    </p>
                  </div>
    
                  {loginView === "signin" && (
                  <form onSubmit={handleLoginSubmit} className="p-8 space-y-4" id="login-credentials-form">
                    {loginError && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex gap-2 items-center animate-shake" id="login-error-toast">
                        <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px]">🚩</span>
                        <span className="font-semibold">{loginError}</span>
                      </div>
                    )}
    
                    <div>
                      <label htmlFor="login-username-field" className="text-xs font-bold text-slate-600 block mb-1">Username</label>
                      <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="e.g. admin"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition"
                        id="login-username-field"
                      />
                    </div>
    
                    <div>
                      <label htmlFor="login-password-field" className="text-xs font-bold text-slate-600 block mb-1">Password</label>
                      <PasswordInput
                        name="password"
                        autoComplete="current-password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition font-mono"
                        id="login-password-field"
                      />
                    </div>
    
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input id="login-keep-logged-in" name="keepLoggedIn" type="checkbox" className="rounded text-[#ff791a] focus:ring-[#ff791a] w-3.5 h-3.5" defaultChecked />
                        <span className="text-xs text-slate-500">Keep me logged in</span>
                      </label>
                      <button
                        type="button"
                        className="text-xs text-[#ff791a] hover:underline font-semibold cursor-pointer"
                        onClick={openForgotPassword}
                      >
                        Forgot password?
                      </button>
                    </div>
    
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-md shadow-orange-500/20 active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      id="login-submit-button"
                    >
                      Sign In
                    </button>
                  </form>
                  )}
    
                  {loginView === "forgot" && (
                  <form onSubmit={handleForgotPasswordSubmit} className="p-8 space-y-4" id="forgot-password-form">
                    {forgotError && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex gap-2 items-center animate-shake">
                        <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px]">🚩</span>
                        <span className="font-semibold">{forgotError}</span>
                      </div>
                    )}
                    {forgotMessage && (
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-xs font-semibold">
                        {forgotMessage}
                      </div>
                    )}
    
                    <div>
                      <label htmlFor="forgot-username-field" className="text-xs font-bold text-slate-600 block mb-1">Username or Email</label>
                      <input
                        type="text"
                        name="username"
                        autoComplete="username email"
                        value={forgotUsername}
                        onChange={(e) => setForgotUsername(e.target.value)}
                        placeholder="Username or registered recovery email"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition"
                        id="forgot-username-field"
                      />
                    </div>
    
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-md shadow-orange-500/20 active:scale-98 transition cursor-pointer"
                    >
                      Send Reset Code
                    </button>
    
                    <button
                      type="button"
                      onClick={backToSignIn}
                      className="w-full py-2 text-slate-500 hover:text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
                    >
                      ← Back to Sign In
                    </button>
                  </form>
                  )}
    
                  {loginView === "reset" && (
                  <form onSubmit={handleResetPasswordSubmit} className="p-8 space-y-4" id="reset-password-form">
                    {resetError && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex gap-2 items-center animate-shake">
                        <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px]">🚩</span>
                        <span className="font-semibold">{resetError}</span>
                      </div>
                    )}
                    {resetSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs font-semibold">
                        {resetSuccess}
                      </div>
                    )}
                    {issuedResetToken && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-900 text-xs">
                        <span className="font-bold block mb-1">Your reset code (valid 15 minutes):</span>
                        <span className="font-mono text-lg tracking-widest font-black">{issuedResetToken}</span>
                      </div>
                    )}
    
                    <div>
                      <label htmlFor="reset-username-field" className="text-xs font-bold text-slate-600 block mb-1">Username</label>
                      <input
                        type="text"
                        name="username"
                        value={forgotUsername || usernameInput}
                        onChange={(e) => setForgotUsername(e.target.value)}
                        readOnly={!!issuedResetToken}
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition disabled:bg-slate-50"
                        id="reset-username-field"
                      />
                    </div>
    
                    <div>
                      <label htmlFor="reset-token-field" className="text-xs font-bold text-slate-600 block mb-1">Reset Code</label>
                      <input
                        type="text"
                        name="resetToken"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={resetTokenInput}
                        onChange={(e) => setResetTokenInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6-digit code"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition font-mono tracking-widest"
                        id="reset-token-field"
                      />
                    </div>
    
                    <div>
                      <label htmlFor="reset-new-password-field" className="text-xs font-bold text-slate-600 block mb-1">New Password</label>
                      <PasswordInput
                        name="newPassword"
                        autoComplete="new-password"
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition font-mono"
                        id="reset-new-password-field"
                      />
                    </div>
    
                    <div>
                      <label htmlFor="reset-confirm-password-field" className="text-xs font-bold text-slate-600 block mb-1">Confirm New Password</label>
                      <PasswordInput
                        name="confirmNewPassword"
                        autoComplete="new-password"
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition font-mono"
                        id="reset-confirm-password-field"
                      />
                    </div>
    
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-md shadow-orange-500/20 active:scale-98 transition cursor-pointer"
                    >
                      Update Password
                    </button>
    
                    <button
                      type="button"
                      onClick={() => setLoginView("forgot")}
                      className="w-full py-2 text-slate-500 hover:text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
                    >
                      ← Request a new code
                    </button>
                  </form>
                  )}
    
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-center text-[10px] text-slate-400">
                    🔒 Secured locally. CSV layout compatibility verification enabled.
                  </div>
                </div>
              </div>
  );
}
