declare global {
  interface Window {
    __FLEXHRM_API_BASE__?: string;
  }
}

/** API origin from runtime config (server) or build-time PUBLIC_API_URL. Empty = same-origin /api proxy. */
export function getApiBase(): string {
  const runtime =
    typeof window !== 'undefined' ? window.__FLEXHRM_API_BASE__ : undefined;
  const buildTime = process.env.PUBLIC_API_URL;
  return (runtime ?? buildTime ?? '').replace(/\/$/, '');
}
