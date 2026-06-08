/** Injected at build time from FLEXHRM_API_BASE / PUBLIC_API_URL / VITE_API_BASE. */
declare const __FLEXHRM_API_BASE__: string;

/** API origin. Dev uses same-origin /api proxy; production uses build-time API base. */
export function getApiBase(): string {
  if (import.meta.env.DEV) return "";
  return (__FLEXHRM_API_BASE__ || "").replace(/\/$/, "");
}
