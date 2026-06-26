export function normalizeApiBaseUrl(input: string): string {
  let base = input.trim();
  if (!base) return 'http://127.0.0.1:3001';
  base = base.replace(/\/+$/, '');
  if (/\/api$/i.test(base)) {
    base = base.slice(0, -4);
  }
  return base;
}

export function formatFetchError(base: string, err: unknown): string {
  const cause =
    err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : err instanceof Error
        ? err.message
        : String(err);

  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH/i.test(cause)) {
    return (
      `Cannot reach Flex HRM API at ${base}. ` +
      'Check that the backend is running and the Server URL is correct. ' +
      'If this agent is on another PC, use your server IP (e.g. http://192.168.1.10:3001), not localhost. ' +
      `(${cause})`
    );
  }

  return cause || 'Registration failed';
}
