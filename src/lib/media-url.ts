export interface Base64MediaFields {
  imagekitUrl?: string;
  photoDataBase64?: string;
  mimeType?: string;
}

export interface StoredDocumentFields {
  id: string;
  imagekitUrl?: string;
}

export function resolvePhotoSrc(
  photo: Base64MediaFields & { photoUrl?: string; profilePhotoUrl?: string },
): string {
  const directUrl =
    photo.imagekitUrl?.trim() ||
    photo.photoUrl?.trim() ||
    photo.profilePhotoUrl?.trim();
  if (directUrl) return directUrl;

  const base64 = photo.photoDataBase64?.trim() ?? '';
  if (!base64) return '';
  if (base64.startsWith('data:')) return base64;
  return `data:${photo.mimeType || 'image/jpeg'};base64,${base64}`;
}

export function resolveDocumentViewUrl(
  doc: StoredDocumentFields,
  apiUrlBuilder: (docId: string) => string,
): string {
  const cloudUrl = doc.imagekitUrl?.trim();
  if (cloudUrl) return cloudUrl;
  return apiUrlBuilder(doc.id);
}

export function resolveProfilePhotoSrc(profile: {
  profilePhotoUrl?: string;
  profilePhotoBase64?: string;
}): string {
  return resolvePhotoSrc({
    profilePhotoUrl: profile.profilePhotoUrl,
    photoDataBase64: profile.profilePhotoBase64,
    mimeType: 'image/jpeg',
  });
}

export function resolveEmployeePhotoUrl(
  employeeId: string,
  photo?: string,
  photoUrl?: string,
): string | null {
  if (photoUrl?.trim()) return photoUrl.trim();
  if (photo?.trim()?.startsWith('http')) return photo.trim();
  if (!employeeId?.trim() || !photo?.trim()) return null;
  return `/api/employees/${encodeURIComponent(employeeId)}/photo`;
}

export function isHttpUrl(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}
