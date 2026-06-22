const TOKEN_KEY = "hrms_observer_token";

export function getObserverToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function persistObserverToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearObserverToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isObserverNativeClient(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname.startsWith("/observer")) return true;
  return /FlexHrmObserver/i.test(navigator.userAgent);
}
