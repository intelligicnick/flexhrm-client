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
import { DEFAULT_PATH } from "./routes";

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
      <Routes>
        <Route path="/verify/:idNo" element={<EmployeeVerifyPage />} />
        <Route path="/verify" element={<VerifyByQuery />} />
        <Route path="/employee/:idNo" element={<EmployeeVerifyPage />} />
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
