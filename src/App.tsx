/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useLocation } from "react-router-dom";
import { parseIdCardFromVerifyParam, parseVerifyTokenFromParam } from "./components/id-card/verify-url";
import "./index.css";
import NotFoundPage from "./pages/NotFoundPage";
import GlobalHorizontalScroll from "./components/GlobalHorizontalScroll";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { ActionButtonFeedback } from "./components/ActionButtonFeedback";

const AdminPortal = lazy(() => import("./AdminPortal"));
const EmployeeVerifyPage = lazy(() => import("./pages/EmployeeVerifyPage"));
const EmployeeDataGatherPage = lazy(() => import("./pages/EmployeeDataGatherPage"));
const ObserverApp = lazy(() => import("./pages/observer/ObserverApp"));
const SupervisorLoginPage = lazy(() => import("./pages/supervisor/SupervisorLoginPage"));
const SupervisorLayout = lazy(() => import("./pages/supervisor/SupervisorLayout"));
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

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-500">
      <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
    </div>
  );
}

function VerifyByQuery() {
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get("id") ?? searchParams.get("idCard");
  const tokenParam = searchParams.get("token");
  if (!idParam?.trim()) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <EmployeeVerifyPage idOverride="" verifyTokenOverride="" />
      </Suspense>
    );
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
  return (
    <Suspense fallback={<RouteFallback />}>
      <EmployeeVerifyPage idOverride={id} verifyTokenOverride="" />
    </Suspense>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <ActionButtonFeedback />
        <AppRoutes />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isSupervisor = location.pathname.startsWith("/supervisor");

  return (
    <>
      {!isSupervisor && <GlobalHorizontalScroll />}
      <Routes>
        <Route
          path="/verify/:idNo/:verifyToken"
          element={
            <Suspense fallback={<RouteFallback />}>
              <EmployeeVerifyPage />
            </Suspense>
          }
        />
        <Route
          path="/verify/:idNo"
          element={
            <Suspense fallback={<RouteFallback />}>
              <EmployeeVerifyPage />
            </Suspense>
          }
        />
        <Route path="/verify" element={<VerifyByQuery />} />
        <Route
          path="/employee/update/:token"
          element={
            <Suspense fallback={<RouteFallback />}>
              <EmployeeDataGatherPage />
            </Suspense>
          }
        />
        <Route
          path="/employee/:idNo"
          element={
            <Suspense fallback={<RouteFallback />}>
              <EmployeeVerifyPage />
            </Suspense>
          }
        />
        <Route
          path="/supervisor/login"
          element={
            <Suspense fallback={<SupervisorRouteFallback />}>
              <SupervisorLoginPage />
            </Suspense>
          }
        />
        <Route
          path="/observer/*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ObserverApp />
            </Suspense>
          }
        />
        <Route
          path="/supervisor"
          element={
            <Suspense fallback={<SupervisorRouteFallback />}>
              <SupervisorLayout />
            </Suspense>
          }
        >
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
            <Suspense fallback={<RouteFallback />}>
              <AdminPortal />
            </Suspense>
          }
        />
        </Routes>
    </>
  );
}
