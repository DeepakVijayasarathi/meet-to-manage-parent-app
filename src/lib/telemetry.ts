import Constants from "expo-constants";
import { Platform } from "react-native";

import { API_BASE_URL, CLIENT_HEADERS } from "@/api/client";
import { crashContext } from "@/lib/crashContext";

const endpoint = process.env.EXPO_PUBLIC_TELEMETRY_URL?.trim();

type TelemetryKind = "analytics" | "error";

async function send(kind: TelemetryKind, name: string, details?: Record<string, unknown>) {
  if (!endpoint) return;
  await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, name, details, occurredAtUtc: new Date().toISOString() }),
  }).catch(() => undefined);
}

/** Privacy-safe product event: never pass names, tokens, messages, or user-entered text. */
export function track(name: string, details?: Record<string, boolean | number | string | null>) {
  void send("analytics", name, details);
}

// Crash reports go to the academy's own backend (which scrubs and groups them) once someone is signed in.
let crashToken: string | null = null;
const recentlySent = new Map<string, number>();
const RESEND_AFTER_MS = 10 * 60_000;

export function setCrashReportToken(token: string | null) {
  crashToken = token;
}

function reportCrash(error: Error, context: string | null, fatal: boolean) {
  if (!crashToken || Platform.OS === "web") return;
  // The same error repeating (e.g. in a render loop) is reported once per ten minutes.
  const key = `${error.name}|${error.message}|${context}`;
  const last = recentlySent.get(key);
  if (last && Date.now() - last < RESEND_AFTER_MS) return;
  recentlySent.set(key, Date.now());
  void fetch(`${API_BASE_URL}/api/app/installations/crash`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...CLIENT_HEADERS, Authorization: `Bearer ${crashToken}` },
    body: JSON.stringify({
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version ?? "0.0.0",
      name: error.name || "Error",
      message: error.message?.slice(0, 2000) ?? null,
      context,
      stack: error.stack?.slice(0, 8000) ?? null,
      fatal,
    }),
  }).catch(() => undefined);
}

export function captureError(error: unknown, context?: string, options: { fatal?: boolean } = {}) {
  const value = error instanceof Error ? error : new Error(String(error));
  if (__DEV__) console.error(value);
  const label = crashContext(context);
  void send("error", value.name, { context: label, message: value.message, stack: value.stack?.slice(0, 4000) ?? null });
  reportCrash(value, label, !!options.fatal);
}

type GlobalErrorUtils = { getGlobalHandler: () => (error: Error, isFatal?: boolean) => void; setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void };

let installed = false;

/** Reports uncaught JS errors (outside React rendering) before React Native's own handler runs. */
export function installGlobalErrorHandler() {
  const utils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (installed || !utils) return;
  installed = true;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    captureError(error, "global", { fatal: !!isFatal });
    previous(error, isFatal);
  });
}
