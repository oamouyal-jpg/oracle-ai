"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearSession,
  getSession,
  setSession,
  type Session,
  type SessionUser,
} from "./session";
import { api } from "./api";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (name: string, email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUserFromSession: (session: Session) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ["/login", "/signup"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    const session = getSession();
    if (!session?.token) {
      setUser(null);
      return;
    }
    try {
      const me = await api.authMe();
      setUser(me);
    } catch {
      clearSession();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    if (session?.user) {
      setUser(session.user);
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_PATHS.includes(pathname) || pathname === "/onboarding";

    if (!user && !isPublic) {
      router.replace("/login");
      return;
    }

    if (user && !user.onboardingComplete && pathname !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }

    if (user?.onboardingComplete && (pathname === "/login" || pathname === "/signup" || pathname === "/onboarding")) {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  const setUserFromSession = useCallback((session: Session) => {
    setSession(session);
    setUser(session.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api.login(email, password);
      setUserFromSession(session);
      return session.user;
    },
    [setUserFromSession]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const session = await api.register(name, email, password);
      setUserFromSession(session);
      return session.user;
    },
    [setUserFromSession]
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      setUserFromSession,
    }),
    [user, loading, login, register, logout, refreshUser, setUserFromSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
