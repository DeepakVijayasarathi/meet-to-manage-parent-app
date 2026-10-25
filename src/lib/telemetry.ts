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

export function captureError(error: unknown, context?: string) {
  const value = error instanceof Error ? error : new Error(String(error));
  if (__DEV__) console.error(value);
  void send("error", value.name, { context: context ?? null, message: value.message, stack: value.stack?.slice(0, 4000) ?? null });
}
