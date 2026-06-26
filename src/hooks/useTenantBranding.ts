import { useEffect } from "react";
import { apiUrl } from "../api";

interface BrandingResponse {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

function resolveTenantId(): string {
  const fromStorage = localStorage.getItem("flexhrm_tenant_id");
  if (fromStorage?.trim()) return fromStorage.trim();

  const host = window.location.hostname;
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return "default";
  const parts = host.split(".");
  if (parts.length >= 3 && parts[0] !== "www" && parts[0] !== "app") return parts[0];
  return "default";
}

export function useTenantBranding(): void {
  useEffect(() => {
    const tenantId = resolveTenantId();
    if (tenantId !== "default") {
      localStorage.setItem("flexhrm_tenant_id", tenantId);
    }

    const applyBranding = (branding: BrandingResponse) => {
      const root = document.documentElement;
      if (branding.primaryColor?.trim()) {
        root.style.setProperty("--color-primary", branding.primaryColor.trim());
      }
      if (branding.companyName?.trim()) {
        document.title = `${branding.companyName.trim()} — HRMS`;
      }
    };

    fetch(apiUrl(`/api/platform/tenant/branding?tenantId=${encodeURIComponent(tenantId)}`), {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) applyBranding(data as BrandingResponse);
      })
      .catch(() => {
        // branding is optional
      });
  }, []);
}
