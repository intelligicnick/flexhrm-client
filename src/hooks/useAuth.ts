import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl, parseApiError } from "../api";
import { clearCsrfToken, setCsrfToken } from "../lib/csrf";
import { PERMISSION_MODULES } from "../lib/permissions";
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
    { view: boolean; edit: boolean }
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
      permissions?: Record<string, { view?: boolean; edit?: boolean }>;
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
        const normalized: Record<string, { view: boolean; edit: boolean }> = {};
        PERMISSION_MODULES.forEach((module) => {
          const perm = data.permissions?.[module];
          normalized[module] = { view: !!perm?.view, edit: !!perm?.edit };
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
  };
}
