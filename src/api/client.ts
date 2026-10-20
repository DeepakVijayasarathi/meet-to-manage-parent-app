// Minimal API client. The token carries the tenant, so signed-in calls use plain /api paths
// and the single /api/auth/login finds each family's organisation from their email or mobile.

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api.meettomanage.cloud").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const MESSAGE_BY_STATUS: Record<number, string> = {
  400: "Some of the information isn't right. Please check it and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to do this.",
  404: "We couldn't find what you were looking for.",
  429: "Too many attempts. Please wait a minute and try again.",
};

let unauthorizedHandler: (() => void) | null = null;

/** Called once by the session provider so an expired token signs the family out. */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export async function apiFetch<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach Meet to Manage. Check your internet connection and try again.");
  }
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.();
    const problem = (await response.json().catch(() => ({}))) as { detail?: string; title?: string };
    throw new ApiError(response.status, problem.detail || MESSAGE_BY_STATUS[response.status] || "Something went wrong. Please try again.");
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** The web portal, for flows the app hands off (payments, PIN reset). */
export const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://meettomanage.cloud").replace(/\/$/, "");
