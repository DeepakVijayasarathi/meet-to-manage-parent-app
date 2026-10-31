import NetInfo, { useNetInfo } from "@react-native-community/netinfo";
import { useQuery } from "@tanstack/react-query";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { router, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { getSchedule } from "@/api/parent";
import { Button, Logo } from "@/components/ui";
import { BIOMETRIC_LOCK_KEY, CLASS_REMINDERS_KEY, readFlag, subscribeFlag } from "@/lib/preferences";
import { reportAppHeartbeat } from "@/lib/appMonitoring";
import { classTitle, reminderPlan } from "@/lib/schedule";
import { captureError, track } from "@/lib/telemetry";
import { fonts, space, useColors } from "@/lib/theme";
import { useRequiredSession, useSession } from "@/state/session";
import { useAppConfig } from "@/state/appConfig";

const REMINDER_LEAD_MINUTES = 10;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export function OfflineBanner() {
  const network = useNetInfo();
  if (network.isConnected !== false) return null;
  return <View style={styles.offline} accessibilityRole="alert"><Text style={styles.offlineText}>You&apos;re offline. Showing saved information.</Text></View>;
}

/** Keeps configuration failures visible: otherwise the app can look incorrectly unbranded
 * or expose default navigation until the tenant settings are fetched successfully. */
export function ConfigSyncBanner() {
  const { error, retry } = useAppConfig();
  if (!error) return null;
  return <View style={styles.configWarning} accessibilityRole="alert">
    <Text style={styles.configWarningText} numberOfLines={2}>Academy settings couldn&apos;t sync. Some options may be outdated.</Text>
    <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel="Retry academy settings sync" style={styles.configRetry}>
      <Text style={styles.configRetryText}>Retry</Text>
    </Pressable>
  </View>;
}

export function BiometricGate() {
  const colors = useColors();
  const { signOut } = useSession();
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const enabled = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Meet to Manage", cancelLabel: "Use PIN sign-in" });
    if (result.success) { setLocked(false); track("biometric_unlock"); }
  }, []);

  useEffect(() => {
    readFlag(BIOMETRIC_LOCK_KEY).then(async (isEnabled) => {
      enabled.current = isEnabled;
      if (isEnabled && await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync()) {
        setLocked(true);
        await unlock();
      }
    }).catch((error) => captureError(error, "biometric_gate")).finally(() => setChecking(false));
    return subscribeFlag(BIOMETRIC_LOCK_KEY, (isEnabled) => { enabled.current = isEnabled; });
  }, [unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        backgroundedAt.current ??= Date.now();
        return;
      }
      if (state === "active") {
        const elapsed = backgroundedAt.current === null ? 0 : Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (enabled.current && elapsed >= 30_000) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => subscription.remove();
  }, [unlock]);

  if (checking || !locked) return null;
  return (
    <View style={[styles.lock, { backgroundColor: colors.background }]} accessibilityViewIsModal>
      <Logo size={72} />
      <Text style={[styles.lockTitle, { color: colors.text }]}>App locked</Text>
      <Text style={[styles.lockBody, { color: colors.muted }]}>Use your fingerprint or face to continue.</Text>
      <Button label="Unlock" icon="unlock" onPress={() => void unlock()} />
      <Pressable onPress={() => signOut()} accessibilityRole="button"><Text style={[styles.signOut, { color: colors.danger }]}>Sign out instead</Text></Pressable>
    </View>
  );
}

export function NotificationController() {
  const session = useRequiredSession();
  const [enabled, setEnabled] = useState(false);
  const schedule = useQuery({
    queryKey: ["reminder-schedule", session.token],
    queryFn: () => getSchedule(session.token, new Date(), new Date(Date.now() + 14 * 86_400_000)),
    enabled: enabled && Platform.OS !== "web",
    staleTime: 30 * 60_000,
  });

  useEffect(() => {
    void readFlag(CLASS_REMINDERS_KEY).then(setEnabled).catch(() => undefined);
    return subscribeFlag(CLASS_REMINDERS_KEY, setEnabled);
  }, []);

  useEffect(() => {
    if (!enabled || !schedule.data || Platform.OS === "web") return;
    const sync = async () => {
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(existing.filter((n) => n.content.data?.kind === "class-reminder").map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
      for (const reminder of reminderPlan(schedule.data, REMINDER_LEAD_MINUTES)) {
        const item = schedule.data.find((s) => s.id === reminder.sessionId);
        if (!item) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: `mtm-class-${item.id}`,
          content: {
            title: `${classTitle(item)} starts soon`,
            body: `Your class with ${item.teacherName} starts in ${REMINDER_LEAD_MINUTES} minutes.`,
            data: { kind: "class-reminder", url: `/class/${item.id}` },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, ...(Platform.OS === "android" ? { channelId: "classes" } : {}) },
        });
      }
    };
    void sync().catch((error) => captureError(error, "class_reminders"));
    void reportAppHeartbeat(session.token, { successfulSync: true }).catch(() => undefined);
  }, [enabled, schedule.data, session.token]);

  useEffect(() => {
    // Channel id the backend names in every FCM message; Android drops pushes for channels that do not exist.
    if (Platform.OS === "android") void Notifications.setNotificationChannelAsync("default", { name: "Updates", importance: AndroidImportance.HIGH }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const redirect = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url as Href);
      Notifications.clearLastNotificationResponse();
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) redirect(last.notification);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => redirect(response.notification));
    return () => subscription.remove();
  }, []);

  return null;
}

export function AppMonitoringController() {
  const session = useRequiredSession();
  useEffect(() => {
    const report = () => void reportAppHeartbeat(session.token).catch(() => undefined);
    // Push needs the notification permission (a runtime prompt on Android 13+). Ask once, then register the device
    // straight away instead of waiting for the next throttled heartbeat.
    void ensurePushPermission()
      .then((granted) => { if (granted) void reportAppHeartbeat(session.token, { force: true }).catch(() => undefined); })
      .catch(() => undefined);
    report();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") report(); });
    return () => subscription.remove();
  }, [session.token]);
  return null;
}

export async function canUseBiometrics(): Promise<boolean> {
  return await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
}

export async function confirmBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Enable biometric lock" });
  return result.success;
}

/** Prompts for notification permission on first launch; never re-prompts once the user has answered. */
async function ensurePushPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  // Android 13+ only shows the prompt once a notification channel exists.
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Updates", importance: AndroidImportance.HIGH });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function enableClassReminders(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("classes", { name: "Class reminders", importance: AndroidImportance.HIGH });
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  return permission.granted;
}

export async function disableClassReminders(): Promise<void> {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter((n) => n.content.data?.kind === "class-reminder").map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export function reconnectNow() { void NetInfo.refresh(); }

const styles = StyleSheet.create({
  offline: { backgroundColor: "#92400E", paddingHorizontal: space.lg, paddingVertical: 7, alignItems: "center", zIndex: 200 },
  offlineText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 12 },
  configWarning: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: "#FEF3C7", paddingHorizontal: space.lg, paddingVertical: 7, zIndex: 199 },
  configWarningText: { flex: 1, color: "#78350F", fontFamily: fonts.medium, fontSize: 12 },
  configRetry: { minHeight: 32, justifyContent: "center", paddingHorizontal: space.sm },
  configRetryText: { color: "#92400E", fontFamily: fonts.bold, fontSize: 12 },
  lock: { position: "absolute", inset: 0, zIndex: 300, elevation: 300, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xxl },
  lockTitle: { fontFamily: fonts.bold, fontSize: 24 },
  lockBody: { fontFamily: fonts.regular, fontSize: 15, textAlign: "center" },
  signOut: { fontFamily: fonts.semibold, fontSize: 14, padding: space.md },
});
