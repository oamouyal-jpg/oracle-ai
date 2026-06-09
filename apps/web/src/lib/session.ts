const SESSION_KEY = "oracle-session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  onboardingComplete: boolean;
};

export type Session = {
  token: string;
  user: SessionUser;
};

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  return getSession()?.token ?? null;
}

export function setSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("oracle-briefing-locale");
  localStorage.removeItem("oracle-focus-locale");
}
