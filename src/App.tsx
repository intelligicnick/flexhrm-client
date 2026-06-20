/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { parseIdCardFromVerifyParam } from "./components/id-card/verify-url";
import "./index.css";
import { HRMSProvider, useHRMS } from "./context/HRMSContext";
import LoginPage from "./components/auth/LoginPage";
import DashboardLayout from "./layouts/DashboardLayout";
import EmployeeVerifyPage from "./pages/EmployeeVerifyPage";
import SupervisorLoginPage from "./pages/supervisor/SupervisorLoginPage";
import SupervisorLayout from "./pages/supervisor/SupervisorLayout";
import SupervisorHomePage from "./pages/supervisor/SupervisorHomePage";
import SupervisorVisitPage from "./pages/supervisor/SupervisorVisitPage";
import SupervisorCalendarPage from "./pages/supervisor/SupervisorCalendarPage";
import SupervisorHistoryPage from "./pages/supervisor/SupervisorHistoryPage";
import SupervisorProfilePage from "./pages/supervisor/SupervisorProfilePage";
import SupervisorRequestsPage from "./pages/supervisor/SupervisorRequestsPage";
import { DEFAULT_PATH } from "./routes";
import GlobalHorizontalScroll from "./components/GlobalHorizontalScroll";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useHRMS();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
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
  if (!idParam?.trim()) {
    return <EmployeeVerifyPage idOverride="" />;
  }
  const id = parseIdCardFromVerifyParam(idParam);
  return <Navigate to={`/verify/${encodeURIComponent(id)}`} replace />;
}

function HomeRedirect() {
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get("id") ?? searchParams.get("idCard");
  if (idParam?.trim()) {
    const id = parseIdCardFromVerifyParam(idParam);
    return <Navigate to={`/verify/${encodeURIComponent(id)}`} replace />;
  }
  return <Navigate to={DEFAULT_PATH} replace />;
}

function PortalRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/" element={<HomeRedirect />} />
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
    <BrowserRouter>
      <GlobalHorizontalScroll />
      <Routes>
        <Route path="/verify/:idNo" element={<EmployeeVerifyPage />} />
        <Route path="/verify" element={<VerifyByQuery />} />
        <Route path="/employee/:idNo" element={<EmployeeVerifyPage />} />
        <Route path="/supervisor/login" element={<SupervisorLoginPage />} />
        <Route path="/supervisor" element={<SupervisorLayout />}>
          <Route index element={<SupervisorHomePage />} />
          <Route path="visit/:schoolId" element={<SupervisorVisitPage />} />
          <Route path="calendar" element={<SupervisorCalendarPage />} />
          <Route path="history" element={<SupervisorHistoryPage />} />
          <Route path="requests" element={<SupervisorRequestsPage />} />
          <Route path="profile" element={<SupervisorProfilePage />} />
        </Route>
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
  );
}
