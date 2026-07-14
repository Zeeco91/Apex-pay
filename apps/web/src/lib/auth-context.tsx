"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "@/lib/api/auth";
import { getMe } from "@/lib/api/users";
import type { PublicUser } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  accessToken: string | null;
  setSession: (user: PublicUser, accessToken: string) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The access token lives in memory only (never localStorage — XSS-exfiltrable storage
 * is exactly what we want to avoid for a bearer token). On mount we silently redeem the
 * httpOnly refresh-token cookie for a fresh access token, so a page reload doesn't force
 * a re-login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const setSession = useCallback((nextUser: PublicUser, token: string) => {
    setUser(nextUser);
    setAccessToken(token);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setStatus("unauthenticated");
  }, []);

  const refreshUser = useCallback(async () => {
    if (!accessToken) return;
    try {
      const freshUser = await getMe(accessToken);
      setUser(freshUser);
    } catch {
      clearSession();
    }
  }, [accessToken, clearSession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort — clear local state regardless of whether the server call succeeded.
    }
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { accessToken: freshToken } = await authApi.refreshSession();
        const freshUser = await getMe(freshToken);
        if (!cancelled) setSession(freshUser, freshToken);
      } catch {
        if (!cancelled) clearSession();
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once on mount only — session restoration shouldn't re-run when setSession/clearSession identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, accessToken, setSession, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
