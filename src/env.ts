/** Injected at build time from FLEXHRM_API_BASE / PUBLIC_API_URL / VITE_API_BASE. */
declare const __FLEXHRM_API_BASE__: string;

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
