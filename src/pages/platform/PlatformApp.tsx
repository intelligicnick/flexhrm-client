import React, { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import PlatformLayout from "./PlatformLayout";
import PlatformOverviewPage from "./PlatformOverviewPage";
import PlatformCompaniesPage from "./PlatformCompaniesPage";
import PlatformPlansPage from "./PlatformPlansPage";
import PlatformSubscriptionsPage from "./PlatformSubscriptionsPage";
import PlatformModulesPage from "./PlatformModulesPage";
import PlatformFeaturesPage from "./PlatformFeaturesPage";
import PlatformTrialsPage from "./PlatformTrialsPage";
import PlatformBillingPage from "./PlatformBillingPage";
import PlatformCrmPage from "./PlatformCrmPage";
import PlatformOnboardingPage from "./PlatformOnboardingPage";
import PlatformWhiteLabelPage from "./PlatformWhiteLabelPage";
import PlatformMobileAppsPage from "./PlatformMobileAppsPage";
import PlatformCommunicationsPage from "./PlatformCommunicationsPage";
import PlatformSupportPage from "./PlatformSupportPage";
import PlatformAuditPage from "./PlatformAuditPage";
import PlatformInfrastructurePage from "./PlatformInfrastructurePage";
import PlatformApiPage from "./PlatformApiPage";
import PlatformMarketplacePage from "./PlatformMarketplacePage";
import PlatformAiPage from "./PlatformAiPage";
import PlatformPartnersPage from "./PlatformPartnersPage";
import PlatformSecurityAgencyPage from "./PlatformSecurityAgencyPage";
import PlatformSettingsPage from "./PlatformSettingsPage";
import PlatformAnalyticsPage from "./PlatformAnalyticsPage";
import PlatformTenantsPage from "./PlatformTenantsPage";
import { usePlatformAuth } from "../../hooks/usePlatformAuth";
import { LoadingSpinner } from "./PlatformShared";

function PlatformAuthGate({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, checkSession } = usePlatformAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void checkSession().then((ok) => {
      if (!ok) navigate("/platform/login", { replace: true });
    });
  }, [checkSession, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/platform/login" replace />;
  return <>{children}</>;
}

export default function PlatformApp() {
  return (
    <PlatformAuthGate>
      <Routes>
        <Route element={<PlatformLayout />}>
          <Route index element={<Navigate to="/platform/dashboard" replace />} />
          <Route path="dashboard" element={<PlatformOverviewPage />} />
          <Route path="companies" element={<PlatformCompaniesPage />} />
          <Route path="subscriptions" element={<PlatformSubscriptionsPage />} />
          <Route path="plans" element={<PlatformPlansPage />} />
          <Route path="modules" element={<PlatformModulesPage />} />
          <Route path="features" element={<PlatformFeaturesPage />} />
          <Route path="trials" element={<PlatformTrialsPage />} />
          <Route path="billing" element={<PlatformBillingPage />} />
          <Route path="crm" element={<PlatformCrmPage />} />
          <Route path="onboarding" element={<PlatformOnboardingPage />} />
          <Route path="white-label" element={<PlatformWhiteLabelPage />} />
          <Route path="mobile-apps" element={<PlatformMobileAppsPage />} />
          <Route path="communications" element={<PlatformCommunicationsPage />} />
          <Route path="support" element={<PlatformSupportPage />} />
          <Route path="audit" element={<PlatformAuditPage />} />
          <Route path="infrastructure" element={<PlatformInfrastructurePage />} />
          <Route path="api" element={<PlatformApiPage />} />
          <Route path="marketplace" element={<PlatformMarketplacePage />} />
          <Route path="ai" element={<PlatformAiPage />} />
          <Route path="partners" element={<PlatformPartnersPage />} />
          <Route path="security-agency" element={<PlatformSecurityAgencyPage />} />
          <Route path="settings" element={<PlatformSettingsPage />} />
          <Route path="analytics" element={<PlatformAnalyticsPage />} />
          <Route path="tenants" element={<PlatformTenantsPage />} />
        </Route>
      </Routes>
    </PlatformAuthGate>
  );
}
