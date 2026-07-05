/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { parseIdCardFromVerifyParam, parseVerifyTokenFromParam } from "./components/id-card/verify-url";
import { AuthProvider, useAuthContext } from "./context/AuthContext";
import LoginPage from "./components/auth/LoginPage";
import SupervisorLoginPage from "./pages/supervisor/SupervisorLoginPage";
import SupervisorLayout from "./pages/supervisor/SupervisorLayout";
import { useTenantBranding } from "./hooks/useTenantBranding";
import { DEFAULT_PATH, LOGIN_PATH } from "./routes";
import GlobalHorizontalScroll from "./components/GlobalHorizontalScroll";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { ActionButtonFeedback } from "./components/ActionButtonFeedback";
import GeoFirewallGate from "./components/GeoFirewallGate";

const HRMSPortal = lazy(() => import("./pages/HRMSPortal"));
const EmployeeVerifyPage = lazy(() => import("./pages/EmployeeVerifyPage"));
const EmployeeDataGatherPage = lazy(() => import("./pages/EmployeeDataGatherPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const EmployeePortalLoginPage = lazy(() => import("./pages/employee-portal/EmployeePortalLoginPage"));
const EmployeePortalHomePage = lazy(() => import("./pages/employee-portal/EmployeePortalHomePage"));
const PlatformLoginPage = lazy(() => import("./pages/platform/PlatformLoginPage"));
const PlatformApp = lazy(() => import("./pages/platform/PlatformApp"));
const ObserverApp = lazy(() => import("./pages/observer/ObserverApp"));

const SupervisorHomePage = lazy(() => import("./pages/supervisor/SupervisorHomePage"));
const SupervisorVisitPage = lazy(() => import("./pages/supervisor/SupervisorVisitPage"));
const SupervisorCalendarPage = lazy(() => import("./pages/supervisor/SupervisorCalendarPage"));
const SupervisorHistoryPage = lazy(() => import("./pages/supervisor/SupervisorHistoryPage"));
const SupervisorRequestsPage = lazy(() => import("./pages/supervisor/SupervisorRequestsPage"));
const SupervisorProfilePage = lazy(() => import("./pages/supervisor/SupervisorProfilePage"));
const SupervisorRouteHistoryPage = lazy(() => import("./pages/supervisor/SupervisorRouteHistoryPage"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-500">
      <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
    </div>
  );
}

function SupervisorRouteFallback() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center text-slate-400 bg-[#f4f6f9]">
      <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
    </div>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, authBootstrapping } = useAuthContext();
  if (authBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-500">
        Checking session…
      </div>
    );
  }
  if (!isLoggedIn) return <Navigate to={LOGIN_PATH} replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, authBootstrapping } = useAuthContext();
  if (authBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-500">
        Checking session…
      </div>
    );
  }
  if (isLoggedIn) return <Navigate to={DEFAULT_PATH} replace />;
  return <>{children}</>;
}

function VerifyByQuery() {
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get("id") ?? searchParams.get("idCard");
  const tokenParam = searchParams.get("token");
  if (!idParam?.trim()) {
    return <EmployeeVerifyPage idOverride="" verifyTokenOverride="" />;
  }
  const id = parseIdCardFromVerifyParam(idParam);
  const token = tokenParam?.trim() || parseVerifyTokenFromParam(idParam, searchParams.toString());
  if (token) {
    return (
      <Navigate
        to={`/verify/${encodeURIComponent(id)}/${encodeURIComponent(token)}`}
        replace
      />
    );
  }
  return <EmployeeVerifyPage idOverride={id} verifyTokenOverride="" />;
}

function PortalRoutes() {
  return (
    <Routes>
      <Route path={LOGIN_PATH} element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <LazyRoute>
              <HRMSPortal />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isSupervisor = location.pathname.startsWith("/supervisor");

  return (
    <>
      {!isSupervisor && <GlobalHorizontalScroll />}
      <Routes>
        <Route path="/verify/:idNo/:verifyToken" element={<LazyRoute><EmployeeVerifyPage /></LazyRoute>} />
        <Route path="/verify/:idNo" element={<LazyRoute><EmployeeVerifyPage /></LazyRoute>} />
        <Route path="/verify" element={<LazyRoute><VerifyByQuery /></LazyRoute>} />
        <Route path="/employee/update/:token" element={<LazyRoute><EmployeeDataGatherPage /></LazyRoute>} />
        <Route path="/employee/:idNo" element={<LazyRoute><EmployeeVerifyPage /></LazyRoute>} />
        <Route path="/supervisor/login" element={<SupervisorLoginPage />} />
        <Route path="/supervisor" element={<SupervisorLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<SupervisorRouteFallback />}>
                <SupervisorHomePage />
              </Suspense>
            }
          />
          <Route
            path="visit/:schoolId"
            element={
              <Suspense fallback={<SupervisorRouteFallback />}>
                <SupervisorVisitPage />
              </Suspense>
            }
          />
          <Route
            path="calendar"
            element={
              <Suspense fallback={<SupervisorRouteFallback />}>
                <SupervisorCalendarPage />
              </Suspense>
            }
          />
          <Route
            path="history"
            element={
              <Suspense fallback={<SupervisorRouteFallback />}>
                <SupervisorHistoryPage />
              </Suspense>
            }
          />
          <Route
            path="requests"
            element={
              <Suspense fallback={<SupervisorRouteFallback />}>
                <SupervisorRequestsPage />
              </Suspense>
            }
          />
          <Route
            path="route"
            element={
              <Suspense fallback={<SupervisorRouteFallback />}>
                <SupervisorRouteHistoryPage />
              </Suspense>
            }
          />
          <Route
            path="profile"
            element={
              <Suspense fallback={<SupervisorRouteFallback />}>
                <SupervisorProfilePage />
              </Suspense>
            }
          />
        </Route>
        <Route path="/register" element={<LazyRoute><RegisterPage /></LazyRoute>} />
        <Route path="/employee-portal/login" element={<LazyRoute><EmployeePortalLoginPage /></LazyRoute>} />
        <Route path="/employee-portal" element={<LazyRoute><EmployeePortalHomePage /></LazyRoute>} />
        <Route path="/platform/login" element={<LazyRoute><PlatformLoginPage /></LazyRoute>} />
        <Route path="/platform/*" element={<LazyRoute><PlatformApp /></LazyRoute>} />
        <Route path="/observer/*" element={<LazyRoute><ObserverApp /></LazyRoute>} />
        <Route path="/" element={<LazyRoute><NotFoundPage /></LazyRoute>} />
        <Route path="/login" element={<Navigate to={LOGIN_PATH} replace />} />
        <Route path="/*" element={<PortalRoutes />} />
      </Routes>
    </>
  );
}

function AppShell() {
  return (
    <GeoFirewallGate>
      <AuthProvider>
        <ActionButtonFeedback />
        <AppRoutes />
      </AuthProvider>
    </GeoFirewallGate>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(<Route path="*" element={<AppShell />} />),
);

export default function App() {
  useTenantBranding();
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  );
}
