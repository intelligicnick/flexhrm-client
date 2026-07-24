import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from 'react-router';
import { HRMSProvider, useHRMS } from "./context/HRMSContext";
import LoginPage from "./components/auth/LoginPage";
import { DEFAULT_PATH, LOGIN_PATH } from "./routes";

const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));

function DashboardFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-500">
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

function PortalRoutes() {
  return (
    <Routes>
      <Route path={LOGIN_PATH} element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Suspense fallback={<DashboardFallback />}>
              <DashboardLayout />
            </Suspense>
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
