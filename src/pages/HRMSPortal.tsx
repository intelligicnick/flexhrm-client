import React, { lazy, Suspense } from "react";
import { HRMSProvider } from "../context/HRMSContext";

const DashboardLayout = lazy(() => import("../layouts/DashboardLayout"));

function DashboardFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-500">
      <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
    </div>
  );
}

export default function HRMSPortal() {
  return (
    <HRMSProvider>
      <Suspense fallback={<DashboardFallback />}>
        <DashboardLayout />
      </Suspense>
    </HRMSProvider>
  );
}
