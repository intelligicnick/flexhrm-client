export type PermissionState = "granted" | "denied" | "prompt" | "unknown";

export interface SupervisorPermissions {
  camera: PermissionState;
  location: PermissionState;
}

async function queryPermission(name: "camera" | "geolocation"): Promise<PermissionState> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const permName = name === "camera" ? "camera" : "geolocation";
    const result = await navigator.permissions.query({ name: permName as PermissionName });
    return result.state as PermissionState;
  } catch {
    return "unknown";
  }
}

export async function checkSupervisorPermissions(): Promise<SupervisorPermissions> {
  const [camera, location] = await Promise.all([
    queryPermission("camera"),
    queryPermission("geolocation"),
  ]);
  return { camera, location };
}

export function requestLocationPermission(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(),
      (err) => {
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied."
              : "Could not access location.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export async function requestCameraPermission(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not available on this device.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
  stream.getTracks().forEach((track) => track.stop());
}

export async function requestAllSupervisorPermissions(): Promise<void> {
  await requestLocationPermission();
  await requestCameraPermission();
}

export function hasRequiredPermissions(perms: SupervisorPermissions): boolean {
  return perms.camera === "granted" && perms.location === "granted";
}
