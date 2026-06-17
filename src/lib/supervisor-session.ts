const TOKEN_KEY = "hrms_supervisor_token";
const NAME_KEY = "hrms_supervisor_name";
const ID_KEY = "hrms_supervisor_id";

export type SupervisorSessionSnapshot = {
  token: string;
  name?: string;
  supervisorId?: string;
};

type NativeSessionBridge = {
  saveSupervisorSession?: (json: string) => void;
  getSupervisorSession?: () => string;
  clearSupervisorSession?: () => void;
};

function getNativeBridge(): NativeSessionBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window.FlexHrmAndroid || window.Android) as NativeSessionBridge | undefined;
}

export function getSupervisorToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  return token?.trim() ? token : null;
}

export function readSupervisorSession(): SupervisorSessionSnapshot | null {
  const token = getSupervisorToken();
  if (!token) return null;
  return {
    token,
    name: localStorage.getItem(NAME_KEY) || undefined,
    supervisorId: localStorage.getItem(ID_KEY) || undefined,
  };
}

export function persistSupervisorSession(session: SupervisorSessionSnapshot): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, session.token);
  if (session.name) localStorage.setItem(NAME_KEY, session.name);
  if (session.supervisorId) localStorage.setItem(ID_KEY, session.supervisorId);

  try {
    getNativeBridge()?.saveSupervisorSession?.(JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearSupervisorSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(ID_KEY);
  try {
    getNativeBridge()?.clearSupervisorSession?.();
  } catch {
    /* ignore */
  }
}

/** Restore session from native storage when WebView localStorage was cleared. */
export function restoreSupervisorSessionFromNative(): boolean {
  if (typeof window === "undefined") return false;
  if (getSupervisorToken()) return true;

  try {
    const raw = getNativeBridge()?.getSupervisorSession?.();
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SupervisorSessionSnapshot;
    if (!parsed?.token?.trim()) return false;
    persistSupervisorSession({
      token: parsed.token,
      name: parsed.name,
      supervisorId: parsed.supervisorId,
    });
    return true;
  } catch {
    return false;
  }
}
