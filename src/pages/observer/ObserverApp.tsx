import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { HRMSProvider } from "../../context/HRMSContext";
import AppErrorBoundary from "../../components/AppErrorBoundary";
import { installObserverBackBridge } from "../../lib/observer-back-handler";
import ObserverLayout from "./ObserverLayout";
import ObserverLoginPage from "./ObserverLoginPage";
import ObserverHomePage from "./ObserverHomePage";
import ObserverMapPage from "./ObserverMapPage";
import ObserverMenuPage from "./ObserverMenuPage";
import ObserverModulePage from "./ObserverModulePage";
import ObserverNotificationsPage from "./ObserverNotificationsPage";

export default function ObserverApp() {
  useEffect(() => {
    installObserverBackBridge();
  }, []);

  return (
    <HRMSProvider>
      <AppErrorBoundary>
        <Routes>
          <Route path="login" element={<ObserverLoginPage />} />
          <Route element={<ObserverLayout />}>
            <Route index element={<ObserverHomePage />} />
            <Route path="map" element={<ObserverMapPage />} />
            <Route path="menu" element={<ObserverMenuPage />} />
            <Route path="notifications" element={<ObserverNotificationsPage />} />
            <Route path=":moduleId" element={<ObserverModulePage />} />
          </Route>
        </Routes>
      </AppErrorBoundary>
    </HRMSProvider>
  );
}
