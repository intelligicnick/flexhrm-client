import { SchoolWork } from "../types";

type SchoolsFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export function normalizeSchoolWorkId(id: string | number | null | undefined): string {
  return String(id ?? "").trim();
}

let cachedSchools: SchoolWork[] | null = null;
let cachedAt = 0;
let inFlight: Promise<SchoolWork[]> | null = null;
const TTL_MS = 90_000;

export function invalidateSupervisorSchoolsCache(): void {
  cachedSchools = null;
  cachedAt = 0;
}

export async function fetchSupervisorSchools(
  supervisorFetch: SchoolsFetcher,
  options?: { force?: boolean },
): Promise<SchoolWork[]> {
  const now = Date.now();
  if (!options?.force && cachedSchools && now - cachedAt < TTL_MS) {
    return cachedSchools;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await supervisorFetch("/api/school-visits/supervisor/schools");
      if (!res.ok) throw new Error("Failed to load schools.");
      const data: SchoolWork[] = await res.json();
      cachedSchools = data;
      cachedAt = Date.now();
      return data;
    } catch {
      return cachedSchools ?? [];
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
