import React from "react";
import { useEmployeePhotoUrl } from "../hooks/useEmployeePhotoUrl";

interface EmployeePhotoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  employeeId: string;
  photo?: string | null;
  photoUrl?: string | null;
  /** Local preview (e.g. data URL from file picker) overrides the API fetch */
  previewSrc?: string | null;
  fallback?: React.ReactNode;
}

export default function EmployeePhoto({
  employeeId,
  photo,
  photoUrl,
  previewSrc,
  fallback = null,
  alt = "Employee",
  className,
  ...imgProps
}: EmployeePhotoProps) {
  const remoteUrl = useEmployeePhotoUrl(
    previewSrc ? undefined : employeeId,
    previewSrc ? null : photo,
    previewSrc ? null : photoUrl,
  );
  const src = previewSrc || remoteUrl;

  if (!src) return <>{fallback}</>;

  return <img src={src} alt={alt} className={className} {...imgProps} />;
}
