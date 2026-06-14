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
  return (
    urlStr.includes("/api/auth/login") ||
    urlStr.includes("/api/auth/quick-login") ||
    urlStr.includes("/api/auth/supervisor/login") ||
    urlStr.includes("/api/auth/supervisor/portal-policy") ||
    urlStr.includes("/api/auth/supervisor/register-device")
  );
}

function isNetworkFetchError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed")
  );
}

export function formatNetworkFetchError(err: unknown, fallback?: string): Error {
  if (isNetworkFetchError(err)) {
    return new Error(
      fallback ||
        "Cannot reach the API server. Ensure the NestJS backend is running (port 3001) and reload this page.",
    );
  }
  if (err instanceof Error) return err;
  return new Error(fallback || "Request failed.");
}

function isPublicIdCardUrl(urlStr: string): boolean {
  return (
    urlStr.includes("/api/employees/id-card/") &&
    (urlStr.includes("/verify") || urlStr.includes("/photo"))
  );
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
    const isPublicApi = isPublicAuth || isPublicIdCardUrl(urlStr);

    let resolvedInput = input;
    if (isApiCall && typeof input === "string" && input.startsWith("/api/")) {
      resolvedInput = apiUrl(input);
    }

    let resolvedInit = init;
    if (isApiCall && token && !isPublicApi) {
      resolvedInit = appendAuthHeader(init, token);
    }

    let response: Response;
    try {
      response = await originalFetch(resolvedInput, resolvedInit);
    } catch (err) {
      if (isApiCall) throw formatNetworkFetchError(err);
      throw err;
    }

    if (
      isApiCall &&
      !isPublicApi &&
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
    const message =
      typeof data.message === "string"
        ? data.message
        : Array.isArray(data.message)
          ? data.message.join(", ")
          : "";
    const error = typeof data.error === "string" ? data.error : "";
    // NestJS puts the helpful text in `message` and a generic HTTP label in `error`.
    const genericErrors = new Set([
      "Bad Request",
      "Unauthorized",
      "Forbidden",
      "Not Found",
      "Method Not Allowed",
      "Internal Server Error",
    ]);
    if (message && (!error || genericErrors.has(error))) {
      return new Error(message);
    }
    return new Error(error || message || fallback);
  } catch {
    return new Error(fallback);
  }
}

