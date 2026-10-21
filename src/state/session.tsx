import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { onUnauthorized } from "@/api/client";
import { login } from "@/api/parent";
import { readItem, writeItem } from "@/lib/storage";

const SESSION_KEY = "mtm.session";
const FAMILY_ROLES = ["Parent", "Student"];

export interface Session {
  token: string;
  expiresAtUtc: string;
  userName: string;
  tenantCode: string | null;
}

interface SessionContextValue {
  session: Session | null;
  isLoading: boolean;
  signIn: (identifier: string, pin: string) => Promise<void>;
  signOut: (notice?: string) => void;
  /** Why the family was signed out (e.g. app access withdrawn); shown once on the sign-in screen. */
  notice: string | null;
  clearNotice: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}

/** The signed-in family's session; screens under the (tabs) guard can rely on it being set. */
export function useRequiredSession(): Session {
  const { session } = useSession();
  if (!session) throw new Error("This screen requires a signed-in family.");
  return session;
}

function isUsable(session: Session | null): session is Session {
  return !!session && new Date(session.expiresAtUtc).getTime() > Date.now();
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    readItem(SESSION_KEY)
      .then((raw) => {
        const stored = raw ? (JSON.parse(raw) as Session) : null;
        if (isUsable(stored)) setSession(stored);
        else if (stored) void writeItem(SESSION_KEY, null);
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const signOut = useCallback((reason?: string) => {
    setNotice(typeof reason === "string" ? reason : null);
    setSession(null);
    void writeItem(SESSION_KEY, null);
  }, []);

  useEffect(() => {
    onUnauthorized(signOut);
    return () => onUnauthorized(null);
  }, [signOut]);

  const signIn = useCallback(async (identifier: string, pin: string) => {
    const response = await login(identifier, pin);
    // The app is the parent portal; staff accounts keep using the website.
    if (!FAMILY_ROLES.includes(response.user.role)) {
      throw new Error("This app is for parents and students. Staff please sign in on the website.");
    }
    const next: Session = {
      token: response.accessToken,
      expiresAtUtc: response.expiresAtUtc,
      userName: response.user.fullName,
      tenantCode: response.tenantCode ?? null,
    };
    await writeItem(SESSION_KEY, JSON.stringify(next));
    setNotice(null);
    setSession(next);
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);
  const value = useMemo(() => ({ session, isLoading, signIn, signOut, notice, clearNotice }), [session, isLoading, signIn, signOut, notice, clearNotice]);
  return <SessionContext value={value}>{children}</SessionContext>;
}
