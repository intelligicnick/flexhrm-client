export interface Base64MediaFields {
  imagekitUrl?: string;
  photoDataBase64?: string;
  thumbnailBase64?: string;
  mimeType?: string;
  /** Client-side blob URL for local previews (Field Team APK). */
  previewUrl?: string;
  thumbPreviewUrl?: string;
}

const IMAGEKIT_THUMB_TRANSFORM = 'tr:w-120,h-120,c-at_max,f-auto,q-40';

function applyImageKitThumbnail(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.includes('ik.imagekit.io') || trimmed.includes('/tr:')) return trimmed;
  try {
    const u = new URL(trimmed);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const account = parts[0];
      const rest = parts.slice(1).join('/');
      return `${u.origin}/${account}/${IMAGEKIT_THUMB_TRANSFORM}/${rest}${u.search}`;
    }
    u.searchParams.set('tr', 'w-120,h-120,c-at_max,f-auto,q-40');
    return u.toString();
  } catch {
    return trimmed;
  }
}

export interface StoredDocumentFields {
  id: string;
  imagekitUrl?: string;
}

export function resolvePhotoSrc(
  photo: Base64MediaFields & { photoUrl?: string; profilePhotoUrl?: string },
): string {
  const previewUrl = photo.previewUrl?.trim();
  if (previewUrl) return previewUrl;

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

/** Low-quality thumbnail for grids and lists — full image via {@link resolvePhotoSrc}. */
export function resolvePhotoThumbnailSrc(
  photo: Base64MediaFields & { photoUrl?: string; profilePhotoUrl?: string },
): string {
  const thumbPreviewUrl = photo.thumbPreviewUrl?.trim();
  if (thumbPreviewUrl) return thumbPreviewUrl;

  const thumb = photo.thumbnailBase64?.trim();
  if (thumb) {
    return thumb.startsWith('data:') ? thumb : `data:${photo.mimeType || 'image/jpeg'};base64,${thumb}`;
  }

  const directUrl =
    photo.imagekitUrl?.trim() ||
    photo.photoUrl?.trim() ||
    photo.profilePhotoUrl?.trim();
  if (directUrl) return applyImageKitThumbnail(directUrl);

  return resolvePhotoSrc(photo);
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
