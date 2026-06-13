/** Injected at build time from FLEXHRM_API_BASE / PUBLIC_API_URL / VITE_API_BASE. */
declare const __FLEXHRM_API_BASE__: string;

/** Injected at build time from VITE_ID_CARD_VERIFY_BASE_URL. */
declare const __FLEXHRM_ID_CARD_VERIFY_BASE__: string;

const DEFAULT_ID_CARD_VERIFY_BASE =
  "https://greenyellow-woodpecker-750354.hostingersite.com/employee";

function isLocalUiHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
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
  return (fromEnv || fromDefine || DEFAULT_ID_CARD_VERIFY_BASE).replace(/\/$/, "");
}
