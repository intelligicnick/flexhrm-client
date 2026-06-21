import { getEmployeePhotoUrl } from "../utils";
import { useAuthenticatedBlobUrl } from "./useAuthenticatedBlobUrl";
import { isHttpUrl } from "../lib/media-url";

export function useEmployeePhotoUrl(
  employeeId: string | undefined,
  photo: string | undefined | null,
  photoUrl?: string | undefined | null,
): string | null {
  const directUrl = photoUrl?.trim() || (photo?.trim() && isHttpUrl(photo) ? photo.trim() : "");
  if (directUrl) return directUrl;

  const apiPath =
    employeeId?.trim() && photo?.trim() && !photo.startsWith("data:")
      ? getEmployeePhotoUrl(employeeId, photo, photoUrl ?? undefined)
      : null;

  return useAuthenticatedBlobUrl(apiPath);
}
