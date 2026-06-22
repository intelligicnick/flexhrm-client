import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { HRMSProvider } from "../../context/HRMSContext";
import ObserverLayout from "./ObserverLayout";
import ObserverLoginPage from "./ObserverLoginPage";

const ObserverHomePage = lazy(() => import("./ObserverHomePage"));
const ObserverMapPage = lazy(() => import("./ObserverMapPage"));
const ObserverMenuPage = lazy(() => import("./ObserverMenuPage"));
const ObserverModulePage = lazy(() => import("./ObserverModulePage"));

function ObserverFallback() {
  return (
    <div className="min-h-[40dvh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
    </div>
  );
}

export default function ObserverApp() {
  return (
    <HRMSProvider>
      <Routes>
        <Route path="login" element={<ObserverLoginPage />} />
        <Route element={<ObserverLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<ObserverFallback />}>
                <ObserverHomePage />
              </Suspense>
            }
          />
          <Route
            path="map"
            element={
              <Suspense fallback={<ObserverFallback />}>
                <ObserverMapPage />
              </Suspense>
            }
          />
          <Route
            path="menu"
            element={
              <Suspense fallback={<ObserverFallback />}>
                <ObserverMenuPage />
              </Suspense>
            }
          />
          <Route
            path=":moduleId"
            element={
              <Suspense fallback={<ObserverFallback />}>
                <ObserverModulePage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </HRMSProvider>
  );
}
