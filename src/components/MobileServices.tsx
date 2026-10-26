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
import { fonts, space } from "@/lib/theme";
import { useRequiredSession, useSession } from "@/state/session";

const REMINDER_LEAD_MINUTES = 10;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export function OfflineBanner() {
  const network = useNetInfo();
  if (network.isConnected !== false) return null;
  return <View style={styles.offline} accessibilityRole="alert"><Text style={styles.offlineText}>You&apos;re offline. Showing saved information.</Text></View>;
}

export function BiometricGate() {
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
    <View style={styles.lock} accessibilityViewIsModal>
      <Logo size={72} />
      <Text style={styles.lockTitle}>App locked</Text>
      <Text style={styles.lockBody}>Use your fingerprint or face to continue.</Text>
      <Button label="Unlock" icon="unlock" onPress={() => void unlock()} />
      <Pressable onPress={() => signOut()} accessibilityRole="button"><Text style={styles.signOut}>Sign out instead</Text></Pressable>
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
  lock: { position: "absolute", inset: 0, zIndex: 300, elevation: 300, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xxl },
  lockTitle: { fontFamily: fonts.bold, fontSize: 24, color: "#181A1F" },
  lockBody: { fontFamily: fonts.regular, fontSize: 15, color: "#667085", textAlign: "center" },
  signOut: { fontFamily: fonts.semibold, fontSize: 14, color: "#B42318", padding: space.md },
});
