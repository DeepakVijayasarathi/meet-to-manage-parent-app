import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { sendAppHeartbeat } from "@/api/parent";
import { BIOMETRIC_LOCK_KEY, readFlag } from "@/lib/preferences";
import { readItem, writeItem } from "@/lib/storage";

const INSTALLATION_ID_KEY = "mtm.installation-id";
const LAST_HEARTBEAT_KEY = "mtm.last-heartbeat";
const MIN_INTERVAL_MS = 15 * 60_000;

async function installationId(): Promise<string> {
  const existing = await readItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await writeItem(INSTALLATION_ID_KEY, created);
  return created;
}

/** Native FCM registration token (Android only; the tenant's backend sends through its own Firebase project). */
async function devicePushToken(granted: boolean): Promise<string | null> {
  if (!granted || Platform.OS !== "android") return null;
  try {
    const { data } = await Notifications.getDevicePushTokenAsync();
    return typeof data === "string" ? data : null;
  } catch {
    // No google-services.json in this build, or Play services unavailable: local reminders still work.
    return null;
  }
}

export async function reportAppHeartbeat(token: string, options: { successfulSync?: boolean; errorCategory?: string; force?: boolean } = {}) {
  if (!options.force) {
    const last = Number(await readItem(LAST_HEARTBEAT_KEY));
    if (Number.isFinite(last) && Date.now() - last < MIN_INTERVAL_MS && !options.successfulSync && !options.errorCategory) return;
  }
  const permission = Platform.OS === "web" ? { granted: false } : await Notifications.getPermissionsAsync();
  const runtime = Constants.expoConfig?.runtimeVersion;
  const runtimeVersion = typeof runtime === "string" ? runtime : runtime ? JSON.stringify(runtime) : null;
  await sendAppHeartbeat(token, {
    installationId: await installationId(),
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version ?? "0.0.0",
    buildNumber: Platform.OS === "ios" ? Constants.expoConfig?.ios?.buildNumber ?? null : String(Constants.expoConfig?.android?.versionCode ?? "" ) || null,
    runtimeVersion,
    notificationsEnabled: permission.granted,
    biometricLockEnabled: await readFlag(BIOMETRIC_LOCK_KEY),
    successfulSync: !!options.successfulSync,
    errorCategory: options.errorCategory ?? null,
    pushToken: await devicePushToken(permission.granted),
  });
  await writeItem(LAST_HEARTBEAT_KEY, String(Date.now()));
}
