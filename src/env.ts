import { PRODUCTION_ID_CARD_VERIFY_BASE } from "./deploy-urls";

/** Injected at build time from FLEXHRM_API_BASE / PUBLIC_API_URL / VITE_API_BASE. */
declare const __FLEXHRM_API_BASE__: string;

/** Injected at build time from VITE_ID_CARD_VERIFY_BASE_URL. */
declare const __FLEXHRM_ID_CARD_VERIFY_BASE__: string;

function isPrivateNetworkHost(host: string): boolean {
  return (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function isLocalUiHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    isPrivateNetworkHost(host)
  );
}

/** API origin. Local/dev uses same-origin /api proxy; remote production uses build-time API base. */
export function getApiBase(): string {
  if (import.meta.env.DEV || isLocalUiHost()) return "";
  return (__FLEXHRM_API_BASE__ || "").replace(/\/$/, "");
}

/** Public verification URL scanned from the ID card QR code (no trailing slash). */
export function getIdCardVerifyBase(): string {
  if (typeof window !== "undefined" && (import.meta.env.DEV || isLocalUiHost())) {
    return `${window.location.origin}/employee`.replace(/\/$/, "");
  }

  const fromEnv = String(import.meta.env.VITE_ID_CARD_VERIFY_BASE_URL || "").trim();
  const fromDefine = String(__FLEXHRM_ID_CARD_VERIFY_BASE__ || "").trim();
  return (fromEnv || fromDefine || PRODUCTION_ID_CARD_VERIFY_BASE).replace(/\/$/, "");
}
