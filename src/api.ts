import { getApiBase } from "./env";
import { clearCsrfToken, getCsrfToken } from "./lib/csrf";
import { getObserverToken, isObserverNativeClient } from "./lib/observer-session";

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

function isPasswordRecoveryRequestUrl(urlStr: string): boolean {
  return (
    urlStr.includes("/api/auth/forgot-password") ||
    urlStr.includes("/api/auth/reset-password")
  );
}

function isPublicAuthUrl(urlStr: string): boolean {
  return (
    urlStr.includes("/api/auth/login") ||
    urlStr.includes("/api/auth/logout") ||
    urlStr.includes("/api/auth/captcha") ||
    urlStr.includes("/api/auth/me") ||
    urlStr.includes("/api/auth/forgot-password") ||
    urlStr.includes("/api/auth/reset-password") ||
    urlStr.includes("/api/auth/quick-login") ||
    urlStr.includes("/api/auth/supervisor/login") ||
    urlStr.includes("/api/auth/supervisor/portal-policy") ||
    urlStr.includes("/api/auth/supervisor/register-device") ||
    urlStr.includes("/api/employee-portal/login") ||
    urlStr.includes("/api/platform/register")
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

function isSupervisorNativeOrProduction(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith("hostingersite.com")) return true;
  if (host.endsWith("appassets.androidplatform.net")) return true;
  return /FlexHrmSupervisor|FlexHrmObserver/i.test(navigator.userAgent);
}

export function formatNetworkFetchError(err: unknown, fallback?: string): Error {
  if (isNetworkFetchError(err)) {
    const productionMessage =
      "Cannot reach the Flex HRM API server. Check your mobile data or Wi-Fi connection and try again.";
    const devMessage =
      "Cannot reach the API server. Ensure the NestJS backend is running (port 3001) and reload this page.";
    return new Error(
      fallback || (isSupervisorNativeOrProduction() ? productionMessage : devMessage),
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

function getStoredTenantId(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("flexhrm_tenant_id")?.trim() ?? "";
}

function getEmployeePortalToken(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("flexhrm_employee_token")?.trim() ?? "";
}

/** Install global fetch interceptor before React mounts for API URL resolution and cookies. */
export function setupFetchInterceptor(): void {
  if (typeof window === "undefined") return;
  const marker = "__flexhrm_fetch_interceptor__";
  const win = window as unknown as Window & Record<string, boolean>;
  if (win[marker]) return;
  win[marker] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const urlStr = resolveFetchUrl(input);
    const isApiCall = isApiUrl(urlStr);
    const isPublicApi = isPublicAuthUrl(urlStr) || isPublicIdCardUrl(urlStr);

    let resolvedInput = input;
    if (isApiCall && typeof input === "string" && input.startsWith("/api/")) {
      resolvedInput = apiUrl(input);
    }

    const resolvedInit: RequestInit = {
      ...(init ?? {}),
      credentials: isApiCall ? (init?.credentials ?? "include") : init?.credentials,
    };

    if (isApiCall) {
      const headers = new Headers(resolvedInit.headers ?? {});
      // Forgot-password resolves tenant from username; stale x-tenant-id breaks lookup.
      if (!isPasswordRecoveryRequestUrl(urlStr) || urlStr.includes("/api/auth/reset-password")) {
        const tenantId = getStoredTenantId();
        if (tenantId) headers.set("x-tenant-id", tenantId);
      }
      const employeeToken = getEmployeePortalToken();
      if (
        employeeToken &&
        (urlStr.includes("/api/employee-portal") || urlStr.includes("/api/attendance-punch/employee"))
      ) {
        headers.set("Authorization", `Bearer ${employeeToken}`);
      } else {
        const observerToken = getObserverToken();
        if (observerToken && !headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${observerToken}`);
        }
      }
      resolvedInit.headers = headers;
    }

    const method = (resolvedInit.method ?? "GET").toUpperCase();
    if (isApiCall && !isPublicApi && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf) {
        const headers = new Headers(resolvedInit.headers ?? {});
        headers.set("x-csrf-token", csrf);
        resolvedInit.headers = headers;
      }
    }

    let response: Response;
    try {
      response = await originalFetch(resolvedInput, resolvedInit);
    } catch (err) {
      if (isApiCall) throw formatNetworkFetchError(err);
      throw err;
    }

    if (isApiCall && !isPublicApi && response.status === 401) {
      const isSessionProbe =
        urlStr.includes("/api/auth/me") || urlStr.includes("/api/platform/auth/me");
      if (
        !isSessionProbe &&
        localStorage.getItem("hrms_logged_in") === "true"
      ) {
        localStorage.removeItem("hrms_logged_in");
        localStorage.removeItem("hrms_username");
        localStorage.removeItem("hrms_role");
        localStorage.removeItem("hrms_locations");
        localStorage.removeItem("hrms_observer_token");
        clearCsrfToken();
        if (isObserverNativeClient()) {
          window.location.replace("/observer/login");
        } else {
          window.location.reload();
        }
      }
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
