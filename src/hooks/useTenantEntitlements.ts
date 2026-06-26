import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "../api";

export type SaasModuleKey =
  | "employees"
  | "attendance"
  | "leave"
  | "payroll"
  | "recruitment"
  | "assets"
  | "performance"
  | "training"
  | "visitors"
  | "helpdesk"
  | "expenses"
  | "travel"
  | "compliance"
  | "documents"
  | "exit"
  | "ess"
  | "geoTracking"
  | "shifts"
  | "dutyRoster"
  | "contractors";

export interface TenantEntitlements {
  tenantId: string;
  planId: string;
  planName: string;
  status: string;
  trialEndsAt?: string;
  isTrialActive: boolean;
  maxEmployees: number;
  employeeCount: number;
  modules: Record<string, boolean>;
  features: string[];
}

/** Maps sidebar tab names to commercial SaaS module keys. */
const TAB_TO_SAAS_MODULE: Record<string, SaasModuleKey> = {
  Employees: "employees",
  Attendance: "attendance",
  Leave: "leave",
  Salary: "payroll",
  "Saved Bulk Pay": "payroll",
  "Advance & Penalty": "payroll",
  Directory: "employees",
  Birthdays: "employees",
  "School Work": "geoTracking",
  Schools: "geoTracking",
  "Monthly Billing": "geoTracking",
  Expenses: "expenses",
  "Field Team": "geoTracking",
  "Saved School Bulk Pay": "geoTracking",
  Bids: "compliance",
  Tenders: "compliance",
  Contracts: "compliance",
  Renewals: "compliance",
  "Car Papers": "compliance",
  "IT Renewals": "compliance",
  Licenses: "compliance",
  "BG & DD": "compliance",
};

export function getSaasModuleKey(tabName: string): SaasModuleKey | null {
  return TAB_TO_SAAS_MODULE[tabName] ?? null;
}

export function useTenantEntitlements(isLoggedIn: boolean) {
  const [entitlements, setEntitlements] = useState<TenantEntitlements | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/tenant/settings/entitlements"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load entitlements");
      const data = (await res.json()) as TenantEntitlements;
      setEntitlements(data);
    } catch {
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setEntitlements(null);
      return;
    }
    void refresh();
  }, [isLoggedIn, refresh]);

  const hasModule = useCallback(
    (moduleKey: string): boolean => {
      if (!entitlements?.modules) return true;
      const saasKey = getSaasModuleKey(moduleKey) ?? moduleKey;
      if (!(saasKey in entitlements.modules)) return true;
      return entitlements.modules[saasKey] === true;
    },
    [entitlements],
  );

  const isSubscriptionDenied = useCallback(
    (tabName: string): boolean => {
      const saasKey = getSaasModuleKey(tabName);
      if (!saasKey || !entitlements?.modules) return false;
      return entitlements.modules[saasKey] !== true;
    },
    [entitlements],
  );

  return useMemo(
    () => ({
      entitlements,
      loading,
      refresh,
      hasModule,
      isSubscriptionDenied,
    }),
    [entitlements, loading, refresh, hasModule, isSubscriptionDenied],
  );
}
