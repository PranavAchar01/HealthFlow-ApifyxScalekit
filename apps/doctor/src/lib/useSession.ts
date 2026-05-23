"use client";
import { useState, useEffect } from "react";

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Read session JSON directly from cookie (accessible client-side since not HttpOnly)
    // Falls back to API endpoint if cookie unavailable
    try {
      const raw = document.cookie
        .split('; ')
        .find(r => r.startsWith('scalekit_session='))
        ?.split('=').slice(1).join('=')
      if (raw) {
        const parsed = JSON.parse(decodeURIComponent(raw))
        setSession({
          userId: parsed.user?.sub ?? '',
          email: parsed.user?.email ?? '',
          name: parsed.user?.name ?? '',
          role: parsed.hfRole ?? '',
          permissions: parsed.permissions ?? [],
        })
        return
      }
    } catch {}

    // Fallback: fetch from API
    fetch("http://localhost:3001/api/auth/session", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => setSession(data?.session ?? null))
      .catch(() => setSession(null));
  }, []);

  const hasPermission = (perm: string) => session?.permissions.includes(perm) ?? false;

  return { session, hasPermission };
}
