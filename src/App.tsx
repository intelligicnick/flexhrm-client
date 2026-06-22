/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { parseIdCardFromVerifyParam, parseVerifyTokenFromParam } from "./components/id-card/verify-url";
import "./index.css";
import { HRMSProvider, useHRMS } from "./context/HRMSContext";
import LoginPage from "./components/auth/LoginPage";
import DashboardLayout from "./layouts/DashboardLayout";
import EmployeeVerifyPage from "./pages/EmployeeVerifyPage";
import EmployeeDataGatherPage from "./pages/EmployeeDataGatherPage";
import NotFoundPage from "./pages/NotFoundPage";
import SupervisorLoginPage from "./pages/supervisor/SupervisorLoginPage";
import SupervisorLayout from "./pages/supervisor/SupervisorLayout";
import ObserverApp from "./pages/observer/ObserverApp";
import { DEFAULT_PATH, LOGIN_PATH } from "./routes";
import GlobalHorizontalScroll from "./components/GlobalHorizontalScroll";
import AppErrorBoundary from "./components/AppErrorBoundary";

const SupervisorHomePage = lazy(() => import("./pages/supervisor/SupervisorHomePage"));
const SupervisorVisitPage = lazy(() => import("./pages/supervisor/SupervisorVisitPage"));
const SupervisorCalendarPage = lazy(() => import("./pages/supervisor/SupervisorCalendarPage"));
const SupervisorHistoryPage = lazy(() => import("./pages/supervisor/SupervisorHistoryPage"));
const SupervisorRequestsPage = lazy(() => import("./pages/supervisor/SupervisorRequestsPage"));
const SupervisorProfilePage = lazy(() => import("./pages/supervisor/SupervisorProfilePage"));

function SupervisorRouteFallback() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center text-slate-400 bg-[#f4f6f9]">
      <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, authBootstrapping } = useHRMS();
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
  const { isLoggedIn } = useHRMS();
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
            <DashboardLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <GlobalHorizontalScroll />
        <Routes>
        <Route path="/verify/:idNo/:verifyToken" element={<EmployeeVerifyPage />} />
        <Route path="/verify/:idNo" element={<EmployeeVerifyPage />} />
        <Route path="/verify" element={<VerifyByQuery />} />
        <Route path="/employee/update/:token" element={<EmployeeDataGatherPage />} />
        <Route path="/employee/:idNo" element={<EmployeeVerifyPage />} />
        <Route path="/supervisor/login" element={<SupervisorLoginPage />} />
        <Route path="/observer/*" element={<ObserverApp />} />
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
            path="profile"
            element={
              <Suspense fallback={<SupervisorRouteFallback />}>
                <SupervisorProfilePage />
              </Suspense>
            }
          />
        </Route>
        <Route path="/" element={<NotFoundPage />} />
        <Route path="/login" element={<NotFoundPage />} />
        <Route
          path="/*"
          element={
            <HRMSProvider>
              <PortalRoutes />
            </HRMSProvider>
          }
        />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
