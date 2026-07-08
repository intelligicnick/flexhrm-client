import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  History,
  LogOut,
  MessageSquarePlus,
  School,
  User,
  Bell,
  Route,
} from "lucide-react";
import { isSupervisorWebDevHost } from "../../env";
import { getSupervisorDeviceId } from "../../lib/supervisor-device";
import { supervisorFetch } from "../../lib/supervisor-fetch";
import { isFlexHrmNativeApp } from "../../lib/supervisor-installed-apps";
import {
  clearSupervisorImpersonatedFlag,
  SUPERVISOR_IMPERSONATED_KEY,
} from "../../lib/supervisor-login";
import {
  clearSupervisorSession,
  ensureSupervisorSessionReady,
  getSupervisorToken,
  persistSupervisorSession,
  restoreSupervisorSessionFromNative,
} from "../../lib/supervisor-session";
import { invalidateSupervisorSchoolsCache } from "../../lib/supervisor-schools-cache";
import { AppNotification } from "../../types";
import { useNotificationPoller } from "../../hooks/useNotificationPoller";
import { requestBrowserNotificationPermission } from "../../lib/notification-alerts";
import { SupervisorI18nProvider, useSupervisorI18n } from "./SupervisorI18nContext";
import SupervisorPermissionsGate from "./SupervisorPermissionsGate";

export function useSupervisorApi() {
  return { supervisorFetch };
}

function getPageTitle(pathname: string, t: (key: string) => string): string {
  if (pathname === "/supervisor" || pathname === "/supervisor/") return t("home");
  if (pathname.startsWith("/supervisor/calendar")) return t("calendar");
  if (pathname.startsWith("/supervisor/history")) return t("history");
  if (pathname.startsWith("/supervisor/route")) return "Route";
  if (pathname.startsWith("/supervisor/requests")) return t("requests");
  if (pathname.startsWith("/supervisor/profile")) return t("profile");
  if (pathname.includes("/visit/")) return t("logVisit");
  return t("appTitle");
}

function SupervisorLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, setLang, lang } = useSupervisorI18n();
  const token = getSupervisorToken();
  const name = localStorage.getItem("hrms_supervisor_name") || "Supervisor";
  const [valid, setValid] = useState<boolean | null>(() => (token ? true : false));
  const [impersonated, setImpersonated] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const pageTitle = useMemo(
    () => getPageTitle(location.pathname, t),
    [location.pathname, t],
  );

  const checkSession = useCallback(async () => {
    restoreSupervisorSessionFromNative();
    await ensureSupervisorSessionReady();
    const sessionToken = getSupervisorToken();
    if (!sessionToken) {
      setValid(false);
      return;
    }
    try {
      const res = await supervisorFetch("/api/auth/supervisor/me");
      if (res.status === 401 || res.status === 403) {
        clearSupervisorSession();
        clearSupervisorImpersonatedFlag();
        setValid(false);
        return;
      }
      if (!res.ok) {
        setValid((current) => (current === null ? true : current));
        return;
      }
      const data = await res.json();
      invalidateSupervisorSchoolsCache();

      if (data.defaultLanguage === "en" || data.defaultLanguage === "hi") {
        setLang(data.defaultLanguage);
      }
      if (data.name) {
        localStorage.setItem("hrms_supervisor_name", data.name);
      }
      persistSupervisorSession({
        token: sessionToken,
        name: data.name || localStorage.getItem("hrms_supervisor_name") || undefined,
        supervisorId: data.supervisorId || localStorage.getItem("hrms_supervisor_id") || undefined,
      });

      const isImpersonated = !!data.impersonated;
      setImpersonated(isImpersonated);
      if (isImpersonated) {
        localStorage.setItem(SUPERVISOR_IMPERSONATED_KEY, "1");
      } else {
        clearSupervisorImpersonatedFlag();
      }

      const localDeviceId = getSupervisorDeviceId();
      if (
        !isImpersonated &&
        !isSupervisorWebDevHost() &&
        data.registeredDeviceId &&
        data.registeredDeviceId !== localDeviceId
      ) {
        clearSupervisorSession();
        clearSupervisorImpersonatedFlag();
        navigate("/supervisor/login?reason=device_mismatch", { replace: true });
        return;
      }

      setValid(true);
    } catch {
      setValid((current) => (current === null || current === true ? true : false));
    }
  }, [setLang, navigate]);

  useEffect(() => {
    restoreSupervisorSessionFromNative();
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (valid !== true) return;
    const timer = window.setInterval(() => {
      void checkSession();
    }, 120_000);
    return () => window.clearInterval(timer);
  }, [valid, checkSession]);

  const fetchSupervisorUnreadCount = useCallback(async (): Promise<number> => {
    try {
      const unreadRes = await supervisorFetch("/api/notifications/supervisor/unread-count");
      if (unreadRes.ok) {
        const data = await unreadRes.json();
        const count = data.count || 0;
        setUnreadCount(count);
        return count;
      }
    } catch {
      /* ignore */
    }
    return 0;
  }, []);

  const fetchSupervisorNotifications = useCallback(async (): Promise<AppNotification[]> => {
    try {
      const res = await supervisorFetch("/api/notifications/supervisor/mine");
      if (res.ok) return await res.json();
    } catch {
      /* ignore */
    }
    return [];
  }, []);

  useNotificationPoller({
    enabled: valid === true,
    unreadCount,
    fetchUnreadCount: fetchSupervisorUnreadCount,
    fetchNotifications: fetchSupervisorNotifications,
    lang,
    pollIntervalMs: 60_000,
  });

  useEffect(() => {
    if (valid === true) {
      void fetchSupervisorUnreadCount();
      void requestBrowserNotificationPermission();
    }
  }, [valid, fetchSupervisorUnreadCount]);

  const logout = async () => {
    try {
      await supervisorFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    clearSupervisorSession();
    clearSupervisorImpersonatedFlag();
    navigate("/supervisor/login");
  };

  if (valid === null) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-slate-400 bg-[#f4f6f9]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
          <p className="text-sm font-medium">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!valid) {
    return <Navigate to="/supervisor/login" replace />;
  }

  const navItems = [
    { to: "/supervisor", icon: School, label: t("schools"), exact: true },
    { to: "/supervisor/calendar", icon: CalendarDays, label: t("calendar") },
    { to: "/supervisor/history", icon: History, label: t("history") },
    ...(isFlexHrmNativeApp()
      ? [{ to: "/supervisor/route", icon: Route, label: "Route", exact: false as const }]
      : []),
    { to: "/supervisor/requests", icon: MessageSquarePlus, label: t("requests"), badge: unreadCount },
    { to: "/supervisor/profile", icon: User, label: t("profile") },
  ];

  const hideNav = location.pathname.includes("/visit/");

  return (
    <SupervisorPermissionsGate
      skipPermissions={impersonated || isFlexHrmNativeApp() || isSupervisorWebDevHost()}
    >
      <div className="min-h-[100dvh] bg-[#f4f6f9] flex flex-col max-w-lg mx-auto w-full">
        <header className="sticky top-0 z-30 safe-area-top">
          <div className="bg-gradient-to-br from-[#0C1E4A] via-[#152a5c] to-[#1a3568] px-4 pt-3 pb-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300/80">
                  {t("appTitle")}
                </p>
                <h1 className="text-base font-black text-white truncate">{pageTitle}</h1>
                <p className="text-[11px] text-slate-300 mt-0.5 truncate">{name}</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {unreadCount > 0 && !location.pathname.startsWith("/supervisor/requests") && (
                  <Link
                    to="/supervisor/requests?tab=notifications"
                    className="relative p-2 text-white/80 hover:text-white"
                    aria-label={t("notifications")}
                  >
                    <Bell size={20} />
                    <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="p-2 text-white/80 hover:text-white cursor-pointer"
                  title={t("logout")}
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className={`flex-1 px-4 pt-4 ${hideNav ? "pb-4" : "pb-28"}`}>
          <Outlet context={{ supervisorFetch }} />
        </main>

        {!hideNav && (
          <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-[60] safe-area-bottom px-3 pt-2 pb-2 bg-[#f4f6f9] border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.1)]">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-200/50 flex">
              {navItems.map(({ to, icon: Icon, label, exact, badge }) => {
                const active = exact ? location.pathname === to : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex-1 relative py-2.5 flex flex-col items-center gap-0.5 text-[10px] font-bold transition rounded-xl mx-0.5 my-1 ${
                      active
                        ? "text-[#ff791a] bg-orange-50"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                    {label}
                    {badge ? (
                      <span className="absolute top-0.5 right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </SupervisorPermissionsGate>
  );
}

export default function SupervisorLayout() {
  return (
    <SupervisorI18nProvider>
      <SupervisorLayoutInner />
    </SupervisorI18nProvider>
  );
}
