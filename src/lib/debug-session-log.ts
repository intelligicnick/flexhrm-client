const SESSION_ID = "5c14a8";
const INGEST_URL = "http://127.0.0.1:7244/ingest/bcae18f5-5314-4ad9-8289-d7be847351ed";
const STORAGE_KEY = "flexhrm_debug_5c14a8";

export type DebugSessionEntry = {
  sessionId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  hypothesisId: string;
  timestamp: number;
  runId: string;
};

export function debugSessionLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = "pre-fix",
): void {
  const payload: DebugSessionEntry = {
    sessionId: SESSION_ID,
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId,
  };

  // #region agent log
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const logs: DebugSessionEntry[] = raw ? JSON.parse(raw) : [];
    logs.push(payload);
    if (logs.length > 20) logs.shift();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    (window as Window & { __flexhrmDebugLast?: DebugSessionEntry }).__flexhrmDebugLast = payload;
  } catch {
    // ignore storage failures
  }

  fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION_ID,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});

  try {
    (window.FlexHrmAndroid as { logDebug?: (payload: string) => void } | undefined)?.logDebug?.(
      JSON.stringify(payload),
    );
  } catch {
    // ignore bridge failures
  }
  // #endregion
}

export function getDebugSessionLogs(): DebugSessionEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
