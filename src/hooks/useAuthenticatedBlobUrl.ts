import { useEffect, useState } from "react";

/**
 * Fetches a protected /api resource with the session Bearer token (via fetch interceptor)
 * and exposes a blob URL safe for <img src> / <iframe src>.
 */
export function useAuthenticatedBlobUrl(apiPath: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!apiPath?.trim()) {
      setUrl(null);
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const res = await fetch(apiPath);
        if (!res.ok) {
          if (!revoked) setUrl(null);
          return;
        }
        const blob = await res.blob();
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!revoked) setUrl(null);
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [apiPath]);

  return url;
}
