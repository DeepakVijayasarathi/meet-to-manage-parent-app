import { useQuery } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, type PropsWithChildren } from "react";

import { ApiError } from "@/api/client";
import { getAppConfig } from "@/api/parent";
import type { ApiAppConfig } from "@/api/types";
import { useSession } from "@/state/session";
import { reportAppHeartbeat } from "@/lib/appMonitoring";

const APP_ACCESS_WITHDRAWN = "The mobile app isn't enabled for your academy. Please contact your academy, or use the website.";

interface AppConfigValue {
  /** The academy's configuration, once loaded. Null while loading or if it could not be read. */
  config: ApiAppConfig | null;
  isLoading: boolean;
  /** Where the app opens website pages (payments, adding a child). Null until the academy has configured it. */
  webBaseUrl: string | null;
  announcement: string | null;
  error: string | null;
  retry: () => void;
}

const AppConfigContext = createContext<AppConfigValue>({ config: null, isLoading: false, webBaseUrl: null, announcement: null, error: null, retry: () => undefined });

export function useAppConfig(): AppConfigValue {
  return use(AppConfigContext);
}

/**
 * Reads the academy's app configuration right after sign-in. The app ships with one API address only; the web portal
 * address, announcement, support contact and branding all come from here, set by the academy's administrator. If the
 * academy's app access has been withdrawn the server answers 403 and the family is signed out with an explanation.
 */
export function AppConfigProvider({ children }: PropsWithChildren) {
  const { session, signOut } = useSession();
  const query = useQuery({
    queryKey: ["app-config", session?.token],
    queryFn: () => getAppConfig(session!.token),
    enabled: !!session,
    staleTime: 5 * 60_000,
    // A 403 is a decision, not a glitch: retrying only delays the explanation.
    retry: (count, error) => !(error instanceof ApiError && error.status === 403) && count < 2,
  });

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 403) signOut(query.error.message || APP_ACCESS_WITHDRAWN);
  }, [query.error, signOut]);
  useEffect(() => {
    if (session && query.data) void reportAppHeartbeat(session.token, { successfulSync: true }).catch(() => undefined);
  }, [query.data, session]);
  const { refetch } = query;
  const retry = useCallback(() => { void refetch(); }, [refetch]);

  const value = useMemo<AppConfigValue>(() => ({
    config: query.data ?? null,
    isLoading: !!session && query.isPending,
    webBaseUrl: query.data?.webBaseUrl ?? null,
    announcement: query.data?.announcement ?? null,
    error: query.isError ? (query.error instanceof Error ? query.error.message : "Could not load academy settings.") : null,
    retry,
  }), [query.data, query.error, query.isError, query.isPending, retry, session]);

  return <AppConfigContext value={value}>{children}</AppConfigContext>;
}
