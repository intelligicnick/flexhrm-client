import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { HRMSProvider, useHRMS } from "./context/HRMSContext";
import LoginPage from "./components/auth/LoginPage";
import DashboardLayout from "./layouts/DashboardLayout";
import { DEFAULT_PATH, LOGIN_PATH } from "./routes";

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

export default function AdminPortal() {
  return (
    <HRMSProvider>
      <PortalRoutes />
    </HRMSProvider>
  );
}
