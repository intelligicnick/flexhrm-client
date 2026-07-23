import { SchoolWork } from "../types";
import { isValidGpsCoord } from "./gps-coords";
import { localityHintFromSchoolName, isUnsafeSchoolPin } from "./school-place-match";

export type SupervisorSchoolLocationStatus = "ready" | "finding" | "needs_admin";

export function supervisorSchoolLocationStatus(school: SchoolWork): SupervisorSchoolLocationStatus {
  const lat = Number(school.lat);
  const lng = Number(school.lng);
  const hasCoords = isValidGpsCoord(lat, lng);

  if (school.locationVerified && hasCoords && !isUnsafeSchoolPin(school)) {
    return "ready";
  }

  if (school.locationVerified && hasCoords && isUnsafeSchoolPin(school)) {
    return "needs_admin";
  }

  if (hasCoords && !school.locationVerified) {
    return "finding";
  }

  return "finding";
}

export function supervisorSchoolVillageName(school: SchoolWork): string {
  return localityHintFromSchoolName(school.schoolName || "");
}

export function supervisorSchoolPlaceLabel(school: SchoolWork): string {
  const village = supervisorSchoolVillageName(school);
  const matched = String(school.matchedPlaceName || "").trim();
  if (matched && village && matched.toLowerCase() !== village.toLowerCase()) {
    return `${village} · ${matched}`;
  }
  return matched || village || school.block || "";
}

export type SchoolStampLabelSource = "google" | "geocode" | "village" | "block";

export type SchoolStampLabels = {
  village: string;
  requiredPlace: string;
  requiredSource: SchoolStampLabelSource;
};

type SchoolsFetcher = (input: string, init?: RequestInit) => Promise<Response>;

const stampLabelCache = new Map<string, SchoolStampLabels>();

export function invalidateSchoolStampLabelCache(schoolId?: string): void {
  if (schoolId) stampLabelCache.delete(String(schoolId));
  else stampLabelCache.clear();
}

/** Labels for photo stamp: Google place, or closest name at school pin, or village. */
export async function resolveSchoolStampLabels(
  school: SchoolWork,
  supervisorFetch: SchoolsFetcher,
): Promise<SchoolStampLabels> {
  const schoolId = String(school.id || "").trim();
  if (schoolId) {
    const cached = stampLabelCache.get(schoolId);
    if (cached) return cached;
  }

  const village = supervisorSchoolVillageName(school);
  const matched = String(school.matchedPlaceName || "").trim();
  const hasVerifiedGoogle =
    !!school.locationVerified &&
    !!matched &&
    isValidGpsCoord(Number(school.lat), Number(school.lng)) &&
    !isUnsafeSchoolPin(school);

  if (hasVerifiedGoogle) {
    const result: SchoolStampLabels = {
      village,
      requiredPlace: matched,
      requiredSource: "google",
    };
    if (schoolId) stampLabelCache.set(schoolId, result);
    return result;
  }

  const lat = Number(school.lat);
  const lng = Number(school.lng);
  if (isValidGpsCoord(lat, lng) && schoolId) {
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        schoolWorkId: schoolId,
      });
      const res = await supervisorFetch(
        `/api/school-visits/supervisor/reverse-geocode?${params.toString()}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { placeName?: string };
        const placeName = String(data.placeName || "").trim();
        if (placeName) {
          const result: SchoolStampLabels = {
            village,
            requiredPlace: placeName,
            requiredSource: "geocode",
          };
          stampLabelCache.set(schoolId, result);
          return result;
        }
      }
    } catch {
      /* fall through to village/block */
    }
  }

  if (village) {
    const result: SchoolStampLabels = {
      village,
      requiredPlace: village,
      requiredSource: "village",
    };
    if (schoolId) stampLabelCache.set(schoolId, result);
    return result;
  }

  const block = String(school.block || "").trim();
  const result: SchoolStampLabels = {
    village,
    requiredPlace: block || String(school.district || "").trim(),
    requiredSource: "block",
  };
  if (schoolId) stampLabelCache.set(schoolId, result);
  return result;
}
