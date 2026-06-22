import { SchoolSupervisor } from "../types";

function isPhoneLike(value: string): boolean {
  return /^\d{10}$/.test(value);
}

export function resolveSupervisorLabel(
  supervisorId: string,
  storedName: string | undefined | null,
  supervisors: SchoolSupervisor[],
): string {
  const stored = String(storedName || "").trim();
  const supervisor = supervisors.find((row) => row.id === supervisorId);
  if (supervisor?.name) return supervisor.name;
  if (stored && !isPhoneLike(stored)) return stored;
  return supervisor?.phone || stored || supervisorId;
}
