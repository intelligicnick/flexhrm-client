import { DEFAULT_PRODUCTION_API_BASE } from "./api-config";
import { PRODUCTION_ID_CARD_VERIFY_BASE } from "./deploy-urls";
import { debugSessionLog } from "./lib/debug-session-log";

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

/** Supervisor portal may be used in a desktop browser during local dev (not production). */
export function isSupervisorWebDevHost(): boolean {
  return import.meta.env.DEV || isLocalUiHost();
}

function isBundledNativeShellHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.toLowerCase().endsWith("appassets.androidplatform.net");
}

function isNativeObserverShell(): boolean {
  if (typeof window === "undefined") return false;
  return /FlexHrmObserver/i.test(navigator.userAgent);
}

function isNativeSupervisorShell(): boolean {
  if (typeof window === "undefined") return false;
  if (isNativeObserverShell()) return false;
  if (isBundledNativeShellHost()) return true;
  return /FlexHrmSupervisor/i.test(navigator.userAgent);
}

function readNativeApiBase(): string {
  if (typeof window === "undefined") return "";
  try {
    const fromBridge = window.FlexHrmAndroid?.getApiBase?.();
    if (fromBridge) return String(fromBridge).trim().replace(/\/$/, "");
  } catch {
    // Bridge may be unavailable during very early boot.
  }
  return "";
}

/** API origin. Local/dev uses same-origin /api proxy; remote production uses build-time API base. */
export function getApiBase(): string {
  const nativeBase = readNativeApiBase();
  if (nativeBase) {
    // #region agent log
    debugSessionLog(
      "env.ts:getApiBase",
      "resolved native bridge api base",
      {
        source: "nativeBridge",
        apiBase: nativeBase,
        host: typeof window !== "undefined" ? window.location.hostname : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
      "C",
    );
    // #endregion
    return nativeBase;
  }

  if (isNativeSupervisorShell() || isNativeObserverShell()) {
    const fallback = DEFAULT_PRODUCTION_API_BASE.replace(/\/$/, "");
    // #region agent log
    debugSessionLog(
      "env.ts:getApiBase",
      "resolved native shell fallback api base",
      {
        source: "nativeShellFallback",
        apiBase: fallback,
        host: typeof window !== "undefined" ? window.location.hostname : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
      "B",
    );
    // #endregion
    return fallback;
  }

  if (import.meta.env.DEV || isLocalUiHost()) return "";
  const built = (__FLEXHRM_API_BASE__ || "").replace(/\/$/, "");
  // #region agent log
  debugSessionLog(
    "env.ts:getApiBase",
    "resolved build-time api base",
    { source: "buildDefine", apiBase: built },
    "B",
  );
  // #endregion
  return built;
}

/** NestJS origin for the Chrome extension (direct API host, not the UI dev server). */
export function getExtensionApiBase(): string {
  const apiBase = getApiBase();
  if (apiBase) return apiBase;

  if (typeof window !== "undefined" && (import.meta.env.DEV || isLocalUiHost())) {
    const { protocol, hostname } = window.location;
    const backendPort = String(import.meta.env.VITE_BACKEND_PORT || "3001").trim();
    return `${protocol}//${hostname}:${backendPort}`;
  }

  return (DEFAULT_PRODUCTION_API_BASE || __FLEXHRM_API_BASE__ || "").replace(/\/$/, "");
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
