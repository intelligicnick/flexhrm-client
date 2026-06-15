const DEVICE_KEY = "hrms_supervisor_device_id";

type AndroidDeviceBridge = {
  getBuildNumber?: () => string;
};

function getAndroidBuildNumber(ua: string): string | null {
  if (typeof window !== "undefined") {
    const bridge = (window.FlexHrmAndroid || window.Android) as AndroidDeviceBridge | undefined;
    const native = String(bridge?.getBuildNumber?.() || "").trim();
    if (native) return native;
  }
  const match = ua.match(/\bBuild\/([^;\s)]+)/i);
  return match ? match[1].trim() : null;
}

function getAndroidDeviceName(ua: string): string {
  const build = getAndroidBuildNumber(ua);
  if (build) return build;

  const match = ua.match(/Android[^;]*;\s*([^)]+)/);
  if (!match) return "Android device";

  const model = match[1].replace(/\s*Build\/[^\s)]+/i, "").trim();
  return model ? `Android · ${model}` : "Android device";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function getSupervisorDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getSupervisorDeviceName(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return getAndroidDeviceName(ua);
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux PC";
  return "Mobile device";
}
