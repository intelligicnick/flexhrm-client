import { PRODUCTION_API_BASE } from "./api-config";

/** API origin. Dev uses same-origin /api proxy; production uses baked-in backend URL. */
export function getApiBase(): string {
  if (import.meta.env.DEV) return "";
  return PRODUCTION_API_BASE.replace(/\/$/, "");
}
