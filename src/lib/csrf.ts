const CSRF_STORAGE_KEY = "flexhrm_csrf_token";

export function setCsrfToken(token: string): void {
  const trimmed = token.trim();
  if (!trimmed || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(CSRF_STORAGE_KEY, trimmed);
}

export function getCsrfToken(): string {
  if (typeof sessionStorage !== "undefined") {
    const stored = sessionStorage.getItem(CSRF_STORAGE_KEY)?.trim();
    if (stored) return stored;
  }
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)flexhrm_csrf=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return "";
}

export function clearCsrfToken(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
  }
}
