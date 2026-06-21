import { apiUrl } from "../api";
import { getSupervisorDeviceId } from "./supervisor-device";
import { restoreSupervisorSessionFromNative } from "./supervisor-session";

let sessionRestored = false;

export function supervisorFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!sessionRestored) {
    restoreSupervisorSessionFromNative();
    sessionRestored = true;
  }
  const token = localStorage.getItem("hrms_supervisor_token");
  const headers = new Headers(init?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Supervisor-Device-Id", getSupervisorDeviceId());
  return fetch(apiUrl(input), { ...init, headers });
}
