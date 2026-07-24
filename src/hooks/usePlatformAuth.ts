import { useCallback, useEffect, useState } from "react";
import { useNavigate } from 'react-router';
import { apiUrl } from "../api";
import { setCsrfToken } from "../lib/csrf";

interface PlatformAdmin {
  username: string;
  name?: string;
  email?: string;
}

export function usePlatformAuth() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/platform/auth/me"), { credentials: "include" });
      if (!res.ok) {
        setAdmin(null);
        return false;
      }
      const data = await res.json();
      if (typeof data.csrfToken === "string") setCsrfToken(data.csrfToken);
      setAdmin(data);
      return true;
    } catch {
      setAdmin(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  async function logout() {
    await fetch(apiUrl("/api/platform/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
    setAdmin(null);
    navigate("/platform/login");
  }

  return { admin, loading, isAuthenticated: !!admin, checkSession, logout };
}
