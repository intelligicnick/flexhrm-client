import { apiUrl, parseApiError } from "../api";
import { persistSupervisorSession } from "./supervisor-session";

export const SUPERVISOR_IMPERSONATED_KEY = "hrms_supervisor_impersonated";

export function clearSupervisorImpersonatedFlag(): void {
  localStorage.removeItem(SUPERVISOR_IMPERSONATED_KEY);
}

export async function loginAsSupervisor(supervisorId: string): Promise<void> {
  const portalWindow = window.open("", "_blank");
  try {
    const res = await fetch(apiUrl(`/api/auth/supervisor/impersonate/${encodeURIComponent(supervisorId)}`), {
      method: "POST",
    });
    if (!res.ok) throw await parseApiError(res, "Could not open supervisor portal.");
    const data = await res.json();
    persistSupervisorSession({
      token: data.token,
      name: data.name || "",
      supervisorId: data.supervisorId || supervisorId,
    });
    localStorage.setItem(SUPERVISOR_IMPERSONATED_KEY, "1");

    const target = `${window.location.origin}/supervisor`;
    if (portalWindow) {
      portalWindow.location.href = target;
    } else {
      window.location.href = target;
    }
  } catch (err) {
    portalWindow?.close();
    throw err;
  }
}
