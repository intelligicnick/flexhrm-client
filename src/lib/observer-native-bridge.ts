import { getObserverToken } from "./observer-session";

type ObserverNativeBridge = {
  isNativeApp?: () => boolean;
  getApiBase?: () => string;
  sharePdfFromUrl?: (url: string, bearerToken: string, filename: string, title: string) => void;
  sharePdfFromBase64?: (base64: string, filename: string, title: string) => void;
  openPdfFromUrl?: (url: string, bearerToken: string, filename: string) => void;
  printPdfFromUrl?: (url: string, bearerToken: string, filename: string) => void;
};

declare global {
  interface Window {
    __flexHrmOnPdfShareDone?: (ok: boolean, message?: string) => void;
    __flexHrmOnPdfOpenDone?: (ok: boolean, message?: string) => void;
    __flexHrmOnPdfPrintDone?: (ok: boolean, message?: string) => void;
  }
}

function getBridge(): ObserverNativeBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return window.FlexHrmAndroid as ObserverNativeBridge | undefined;
}

export function canUseObserverNativePdf(): boolean {
  const bridge = getBridge();
  return Boolean(
    bridge?.sharePdfFromUrl &&
      bridge?.openPdfFromUrl &&
      bridge?.isNativeApp?.(),
  );
}

export function canUseObserverNativePdfShare(): boolean {
  const bridge = getBridge();
  return Boolean(
    (bridge?.sharePdfFromBase64 || bridge?.sharePdfFromUrl) && bridge?.isNativeApp?.(),
  );
}

export function canUseObserverNativePrint(): boolean {
  const bridge = getBridge();
  return Boolean(bridge?.printPdfFromUrl && bridge?.isNativeApp?.());
}

function waitForNativeCallback(
  callbackName: "__flexHrmOnPdfShareDone" | "__flexHrmOnPdfOpenDone" | "__flexHrmOnPdfPrintDone",
  timeoutMs = 90_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("PDF action timed out."));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      delete window[callbackName];
    };

    window[callbackName] = (ok: boolean, message?: string) => {
      cleanup();
      if (ok) resolve();
      else reject(new Error(message || "PDF action failed."));
    };
  });
}

export async function sharePdfViaNative(
  url: string,
  title: string,
  filename: string,
): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.sharePdfFromUrl) {
    throw new Error("Native PDF share is not available.");
  }

  const pending = waitForNativeCallback("__flexHrmOnPdfShareDone");
  const token = getObserverToken() || "";
  bridge.sharePdfFromUrl(url, token, filename, title);
  await pending;
}

export async function sharePdfFromBase64ViaNative(
  base64: string,
  title: string,
  filename: string,
): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.sharePdfFromBase64) {
    throw new Error("Native PDF share is not available.");
  }

  const pending = waitForNativeCallback("__flexHrmOnPdfShareDone");
  bridge.sharePdfFromBase64(base64, filename, title);
  await pending;
}

export async function openPdfViaNative(url: string, filename: string): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.openPdfFromUrl) {
    throw new Error("Native PDF open is not available.");
  }

  const pending = waitForNativeCallback("__flexHrmOnPdfOpenDone");
  const token = getObserverToken() || "";
  bridge.openPdfFromUrl(url, token, filename);
  await pending;
}

export async function printPdfViaNative(url: string, filename: string): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.printPdfFromUrl) {
    throw new Error("Native PDF print is not available.");
  }

  const pending = waitForNativeCallback("__flexHrmOnPdfPrintDone");
  const token = getObserverToken() || "";
  bridge.printPdfFromUrl(url, token, filename);
  await pending;
}
