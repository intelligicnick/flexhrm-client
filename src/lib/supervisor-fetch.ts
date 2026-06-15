import { apiUrl } from "../api";
import { getSupervisorDeviceId } from "./supervisor-device";

export function supervisorFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("hrms_supervisor_token");
  const headers = new Headers(init?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Supervisor-Device-Id", getSupervisorDeviceId());
  return fetch(apiUrl(input), { ...init, headers });
}
