import { getEmployeePhotoUrl } from "../utils";
import { useAuthenticatedBlobUrl } from "./useAuthenticatedBlobUrl";

export function useEmployeePhotoUrl(
  employeeId: string | undefined,
  photo: string | undefined | null,
): string | null {
  const apiPath =
    employeeId?.trim() && photo?.trim() && !photo.startsWith("data:")
      ? getEmployeePhotoUrl(employeeId, photo)
      : null;

  return useAuthenticatedBlobUrl(apiPath);
}
