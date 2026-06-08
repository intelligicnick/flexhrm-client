import { getApiBase } from "./env";

export function apiUrl(endpoint: string): string {
  const base = getApiBase();
  if (!base) return endpoint;
  return `${base}${endpoint}`;
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === "object" && "url" in input) {
    return (input as Request).url || "";
  }
  return String(input);
}

function isPublicAuthUrl(urlStr: string): boolean {
  return urlStr.includes("/api/auth/login") || urlStr.includes("/api/auth/quick-login");
}

function isApiUrl(urlStr: string): boolean {
  return urlStr.startsWith("/api/") || urlStr.includes("/api/");
}

function appendAuthHeader(init: RequestInit | undefined, token: string): RequestInit {
  const next = init ? { ...init } : {};
  const headers = new Headers(next.headers || {});
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  next.headers = headers;
  return next;
}

/** Install global fetch interceptor before React mounts so early effects send auth tokens. */
export function setupFetchInterceptor(): void {
  if (typeof window === "undefined") return;
  const marker = "__flexhrm_fetch_interceptor__";
  if ((window as Window & { [key: string]: boolean })[marker]) return;
  (window as Window & { [key: string]: boolean })[marker] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const token = localStorage.getItem("hrms_session_token");
    const urlStr = resolveFetchUrl(input);
    const isApiCall = isApiUrl(urlStr);
    const isPublicAuth = isPublicAuthUrl(urlStr);

    let resolvedInput = input;
    if (isApiCall && typeof input === "string" && input.startsWith("/api/")) {
      resolvedInput = apiUrl(input);
    }

    let resolvedInit = init;
    if (isApiCall && token && !isPublicAuth) {
      resolvedInit = appendAuthHeader(init, token);
    }

    const response = await originalFetch(resolvedInput, resolvedInit);

    if (
      isApiCall &&
      !isPublicAuth &&
      response.status === 401 &&
      localStorage.getItem("hrms_logged_in") === "true"
    ) {
      localStorage.removeItem("hrms_logged_in");
      localStorage.removeItem("hrms_session_token");
      localStorage.removeItem("hrms_username");
      localStorage.removeItem("hrms_role");
      localStorage.removeItem("hrms_locations");
      window.location.reload();
    }

    return response;
  };
}

export async function parseApiError(response: Response, fallback: string): Promise<Error> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (response.status === 404) {
      return new Error(
        "Cannot reach the API server. Ensure the NestJS backend is running and reachable.",
      );
    }
    return new Error(fallback);
  }
  try {
    const data = await response.json();
    return new Error(data.error || data.message || fallback);
  } catch {
    return new Error(fallback);
  }
}

