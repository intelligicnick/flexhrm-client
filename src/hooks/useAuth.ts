import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from 'react-router';
import { apiUrl, parseApiError } from "../api";
import { clearCsrfToken, setCsrfToken } from "../lib/csrf";
import { createFullRolePermission, PERMISSION_MODULES } from "../lib/permissions";
import type { RoleUiRestrictions } from "../lib/role-ui-restrictions";
import { clearObserverToken } from "../lib/observer-session";
import { DEFAULT_PATH, LOGIN_PATH } from "../routes";

export function useAuth() {
  const navigate = useNavigate();
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionUser, setSessionUser] = useState("admin");
  const [sessionRole, setSessionRole] = useState("admin");
  const [sessionLocations, setSessionLocations] = useState<string[]>([]);
  const [sessionPermissions, setSessionPermissions] = useState<Record<
    string,
    { view: boolean; edit: boolean; delete: boolean }
  > | null>(null);
  const [sessionUiRestrictions, setSessionUiRestrictions] = useState<RoleUiRestrictions | null>(null);

  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [captchaInput, setCaptchaInput] = useState({ id: "", answer: "" });
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginView, setLoginView] = useState<"signin" | "forgot" | "reset">("signin");
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [issuedResetToken, setIssuedResetToken] = useState<string | null>(null);
  const [resetTokenInput, setResetTokenInput] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingResetCode, setIsSendingResetCode] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const applySessionFromAuthMe = useCallback(
    (data: {
      username?: string;
      role?: string;
      locations?: string[];
      permissions?: Record<string, { view?: boolean; edit?: boolean; delete?: boolean }>;
      uiRestrictions?: RoleUiRestrictions;
      csrfToken?: string;
      tenantId?: string;
    }) => {
      if (typeof data.csrfToken === "string" && data.csrfToken.trim()) {
        setCsrfToken(data.csrfToken);
      }
      const tenantId = data.tenantId?.trim();
      if (tenantId && tenantId !== "default") {
        localStorage.setItem("flexhrm_tenant_id", tenantId);
      } else {
        localStorage.removeItem("flexhrm_tenant_id");
      }
      if (data.username) {
        setSessionUser(data.username);
        localStorage.setItem("hrms_username", data.username);
      }
      if (data.role) {
        setSessionRole(data.role);
        localStorage.setItem("hrms_role", data.role);
      }
      if (data.locations) {
        setSessionLocations(data.locations);
        localStorage.setItem("hrms_locations", JSON.stringify(data.locations));
      }
      if (data.permissions) {
        const normalized: Record<string, { view: boolean; edit: boolean; delete: boolean }> = {};
        PERMISSION_MODULES.forEach((module) => {
          const perm = data.permissions?.[module];
          normalized[module] = createFullRolePermission(perm);
        });
        setSessionPermissions(normalized);
      }
      if (data.uiRestrictions) {
        setSessionUiRestrictions(data.uiRestrictions);
      }
    },
    [],
  );

  const clearLocalSession = useCallback(() => {
    clearCsrfToken();
    localStorage.removeItem("hrms_logged_in");
    localStorage.removeItem("hrms_selected_month");
    localStorage.removeItem("hrms_username");
    localStorage.removeItem("hrms_role");
    localStorage.removeItem("hrms_locations");
    clearObserverToken();
    setIsLoggedIn(false);
    setSessionRole("admin");
    setSessionLocations([]);
    setSessionPermissions(null);
    setSessionUiRestrictions(null);
  }, []);

  const handleLogout = useCallback(async (redirectTo?: string) => {
    try {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore network errors during logout
    }
    clearLocalSession();
    setUsernameInput("");
    setPasswordInput("");
    navigate(redirectTo ?? LOGIN_PATH);
  }, [clearLocalSession, navigate]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/auth/me"), { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Session invalid");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        applySessionFromAuthMe(data);
        setIsLoggedIn(true);
        localStorage.setItem("hrms_logged_in", "true");
      })
      .catch(() => {
        if (!cancelled) clearLocalSession();
      })
      .finally(() => {
        if (!cancelled) setAuthBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applySessionFromAuthMe, clearLocalSession]);

  const handleLoginSubmit = useCallback(
    async (
      e: React.FormEvent,
      onSuccess?: (username: string) => void,
    ) => {
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: cleanUser,
            password: passwordInput,
            captchaId: captchaInput.id,
            captchaAnswer: captchaInput.answer.trim(),
          }),
        });
        if (!res.ok) {
          throw await parseApiError(res, "Incorrect administrator username or password.");
        }
        const data = await res.json();
        localStorage.setItem("hrms_logged_in", "true");
        applySessionFromAuthMe(data);
        setIsLoggedIn(true);
        navigate(DEFAULT_PATH);
        onSuccess?.(data.username || cleanUser);
      } catch (err: unknown) {
        setLoginError(err instanceof Error ? err.message : "Login failed.");
        setCaptchaRefreshKey((key) => key + 1);
      } finally {
        setIsLoggingIn(false);
      }
    },
    [usernameInput, passwordInput, captchaInput, applySessionFromAuthMe, navigate],
  );

  const userPermissions = useMemo(() => {
    return sessionPermissions;
  }, [sessionPermissions]);

  const handleForgotPasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleanUser = forgotUsername.trim();
      if (!cleanUser) {
        setForgotError("Please enter your username or recovery email.");
        return;
      }
      try {
        setIsSendingResetCode(true);
        setForgotError(null);
        setForgotMessage(null);
        setIssuedResetToken(null);
        const res = await fetch(apiUrl("/api/auth/forgot-password"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: cleanUser }),
        });
        if (!res.ok) {
          throw await parseApiError(res, "Unable to process password reset request.");
        }
        const data = await res.json();
        if (data.tenantId) {
          localStorage.setItem("flexhrm_tenant_id", String(data.tenantId));
        }
        setForgotMessage(data.message);
        setResetError(null);
        setResetSuccess(null);
        setResetNewPassword("");
        setResetConfirmPassword("");
        const resolvedUser = data.username || cleanUser;
        setForgotUsername(resolvedUser);
        setUsernameInput(resolvedUser);
        if (data.resetToken) {
          setIssuedResetToken(data.resetToken);
          setResetTokenInput(data.resetToken);
        } else {
          setResetTokenInput("");
          setIssuedResetToken(null);
        }
        setLoginView("reset");
      } catch (err: unknown) {
        setForgotError(err instanceof Error ? err.message : "Request failed.");
      } finally {
        setIsSendingResetCode(false);
      }
    },
    [forgotUsername, setForgotUsername, setForgotError, setForgotMessage, setIssuedResetToken, setResetError, setResetSuccess, setResetNewPassword, setResetConfirmPassword, setUsernameInput, setResetTokenInput, setLoginView, setIsSendingResetCode],
  );

  const handleResetPasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setResetError(null);
      setResetSuccess(null);

      const username = (forgotUsername || usernameInput).trim();
      const token = resetTokenInput.trim();
      const newP = resetNewPassword.trim();
      const confirmP = resetConfirmPassword.trim();

      if (!username || !token || !newP || !confirmP) {
        setResetError("Please fill in all fields.");
        return;
      }
      if (newP !== confirmP) {
        setResetError("New passwords do not match.");
        return;
      }
      if (newP.length < 8) {
        setResetError("Password must be at least 8 characters long.");
        return;
      }

      try {
        setIsUpdatingPassword(true);
        const res = await fetch(apiUrl("/api/auth/reset-password"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, resetToken: token, newPassword: newP }),
        });
        if (!res.ok) {
          throw await parseApiError(res, "Unable to reset password.");
        }
        const data = await res.json();
        setResetSuccess(data.message || "Password updated successfully.");
        setPasswordInput("");
        setResetNewPassword("");
        setResetConfirmPassword("");
        setResetTokenInput("");
        setIssuedResetToken(null);
        setForgotUsername("");
        setTimeout(() => {
          setLoginView("signin");
          setResetSuccess(null);
          setForgotMessage(null);
        }, 2500);
      } catch (err: unknown) {
        setResetError(err instanceof Error ? err.message : "Reset failed.");
      } finally {
        setIsUpdatingPassword(false);
      }
    },
    [
      forgotUsername,
      usernameInput,
      resetTokenInput,
      resetNewPassword,
      resetConfirmPassword,
      setResetError,
      setResetSuccess,
      setIsUpdatingPassword,
      setPasswordInput,
      setResetNewPassword,
      setResetConfirmPassword,
      setResetTokenInput,
      setIssuedResetToken,
      setForgotUsername,
      setLoginView,
      setForgotMessage,
    ],
  );

  const openForgotPassword = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("flexhrm_tenant_id");
    }
    setLoginView("forgot");
    setLoginError(null);
    setForgotError(null);
    setForgotMessage(null);
    setIssuedResetToken(null);
    setForgotUsername(usernameInput);
  }, [
    usernameInput,
    setLoginView,
    setLoginError,
    setForgotError,
    setForgotMessage,
    setIssuedResetToken,
    setForgotUsername,
  ]);

  const openRequestNewResetCode = useCallback(() => {
    setLoginView("forgot");
    setResetError(null);
    setResetSuccess(null);
    setIssuedResetToken(null);
    setResetTokenInput("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setForgotError(null);
    setForgotMessage(null);
    setForgotUsername((forgotUsername || usernameInput).trim());
  }, [
    forgotUsername,
    usernameInput,
    setLoginView,
    setResetError,
    setResetSuccess,
    setIssuedResetToken,
    setResetTokenInput,
    setResetNewPassword,
    setResetConfirmPassword,
    setForgotError,
    setForgotMessage,
    setForgotUsername,
  ]);

  const backToSignIn = useCallback(() => {
    setLoginView("signin");
    setForgotError(null);
    setForgotMessage(null);
    setResetError(null);
    setResetSuccess(null);
    setIssuedResetToken(null);
  }, [
    setLoginView,
    setForgotError,
    setForgotMessage,
    setResetError,
    setResetSuccess,
    setIssuedResetToken,
  ]);

  return {
    authBootstrapping,
    isLoggedIn,
    setIsLoggedIn,
    sessionUser,
    setSessionUser,
    sessionRole,
    setSessionRole,
    sessionLocations,
    setSessionLocations,
    sessionPermissions,
    setSessionPermissions,
    sessionUiRestrictions,
    setSessionUiRestrictions,
    userPermissions,
    applySessionFromAuthMe,
    clearLocalSession,
    usernameInput,
    setUsernameInput,
    passwordInput,
    setPasswordInput,
    captchaInput,
    setCaptchaInput,
    captchaRefreshKey,
    loginError,
    setLoginError,
    loginView,
    setLoginView,
    forgotUsername,
    setForgotUsername,
    forgotError,
    setForgotError,
    forgotMessage,
    setForgotMessage,
    issuedResetToken,
    setIssuedResetToken,
    resetTokenInput,
    setResetTokenInput,
    resetNewPassword,
    setResetNewPassword,
    resetConfirmPassword,
    setResetConfirmPassword,
    resetError,
    setResetError,
    resetSuccess,
    setResetSuccess,
    isLoggingIn,
    isSendingResetCode,
    setIsSendingResetCode,
    isUpdatingPassword,
    setIsUpdatingPassword,
    handleLoginSubmit,
    handleLogout,
    handleForgotPasswordSubmit,
    handleResetPasswordSubmit,
    openForgotPassword,
    openRequestNewResetCode,
    backToSignIn,
  };
}
