import { canUseNativeCamera, captureNativePhotoFile } from "./native-android-bridge";
import { isFlexHrmNativeApp } from "./supervisor-installed-apps";

export async function captureLivePhoto(): Promise<File> {
  if (isFlexHrmNativeApp()) {
    if (!canUseNativeCamera()) {
      throw new Error("Native camera is not available.");
    }
    return captureNativePhotoFile();
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not available on this device.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });

  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();

    await new Promise((r) => setTimeout(r, 300));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not capture photo.");

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to capture photo."))),
        "image/jpeg",
        0.92,
      );
    });

    return new File([blob], `live-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

export async function captureLivePhotoDataUrl(): Promise<string> {
  const file = await captureLivePhoto();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read photo."));
    reader.readAsDataURL(file);
  });
}
