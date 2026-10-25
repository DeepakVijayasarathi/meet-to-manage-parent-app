import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { Fragment, useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";

import { Card, Divider, ListRow, Logo, Screen, type IconName, type Tone } from "@/components/ui";
import { initials } from "@/lib/format";
import { canUseBiometrics, confirmBiometric, disableClassReminders, enableClassReminders } from "@/components/MobileServices";
import { BIOMETRIC_LOCK_KEY, CLASS_REMINDERS_KEY, readFlag, writeFlag } from "@/lib/preferences";
import { track } from "@/lib/telemetry";
import { fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession, useSession } from "@/state/session";
import { useAppConfig } from "@/state/appConfig";

/** `href` is a native screen; `portal` a web-portal page opened in-app, already signed in. */
type Feature = "reports" | "resources" | "recordings" | "enrollment" | "support";
type Item = { label: string; detail: string; icon: IconName; tone: Tone; href?: Href; portal?: string; feature?: Feature };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Learning",
    items: [
      { label: "Progress reports", detail: "Monthly notes from teachers", icon: "file-text", tone: "brand", href: "/reports" as Href, feature: "reports" },
      { label: "Learning resources", detail: "Worksheets and reading books", icon: "book-open", tone: "info", href: "/resources" as Href, feature: "resources" },
      { label: "Class recordings", detail: "Watch past classes again", icon: "play-circle", tone: "success", href: "/recordings" as Href, feature: "recordings" },
    ],
  },
  {
    title: "Family",
    items: [
      { label: "Add a child", detail: "Enrol a brother or sister", icon: "user-plus", tone: "brand", portal: "/parent/add-child" },
      { label: "Enrollment form", detail: "Enrol your child and share class preferences", icon: "clipboard", tone: "info", href: "/enrollment" as Href, feature: "enrollment" },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Help & support", detail: "Raise a request, chat with the team", icon: "life-buoy", tone: "warning", href: "/support" as Href, feature: "support" },
      { label: "Open web portal", detail: "Everything from the website, already signed in", icon: "globe", tone: "neutral", portal: "/parent" },
    ],
  },
];

export default function More() {
  const colors = useColors();
  const session = useRequiredSession();
  const { signOut } = useSession();
  const { config } = useAppConfig();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const [biometricLock, setBiometricLock] = useState(false);
  const [classReminders, setClassReminders] = useState(false);
  const [settingBusy, setSettingBusy] = useState(false);

  useEffect(() => {
    void Promise.all([readFlag(BIOMETRIC_LOCK_KEY), readFlag(CLASS_REMINDERS_KEY)]).then(([bio, reminders]) => {
      setBiometricLock(bio);
      setClassReminders(reminders);
    });
  }, []);

  const open = (item: Item) => {
    if (item.href) router.push(item.href);
    else if (item.portal) router.push({ pathname: "/portal", params: { path: item.portal, title: item.label } });
  };

  const confirmSignOut = () => Alert.alert(
    "Sign out?",
    "You'll need your email or mobile number and PIN to sign in again.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ],
  );

  const toggleBiometric = async (enabled: boolean) => {
    if (settingBusy) return;
    setSettingBusy(true);
    try {
      if (enabled && !(await canUseBiometrics())) {
        Alert.alert("Biometrics unavailable", "Set up Face ID, Touch ID, or fingerprint unlock in your phone settings first.");
        return;
      }
      if (enabled && !(await confirmBiometric())) return;
      await writeFlag(BIOMETRIC_LOCK_KEY, enabled);
      setBiometricLock(enabled);
      track("setting_biometric_lock", { enabled });
    } finally { setSettingBusy(false); }
  };

  const toggleReminders = async (enabled: boolean) => {
    if (settingBusy) return;
    setSettingBusy(true);
    try {
      if (enabled && !(await enableClassReminders())) {
        Alert.alert("Notifications are off", "Allow notifications in your phone settings to receive class reminders.");
        return;
      }
      if (!enabled) await disableClassReminders();
      await writeFlag(CLASS_REMINDERS_KEY, enabled);
      setClassReminders(enabled);
      track("setting_class_reminders", { enabled });
    } finally { setSettingBusy(false); }
  };

  return (
    <Screen title="More">
      <Card style={styles.profile}>
        <LinearGradient colors={[colors.primary, colors.accent]} style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(session.userName)}</Text>
        </LinearGradient>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>{session.userName}</Text>
          <Text style={[type.caption, { color: colors.muted }]}>{session.role ?? "Parent"} account{session.tenantCode ? ` · ${session.tenantCode}` : ""}</Text>
        </View>
      </Card>

      {GROUPS.map((group) => ({ ...group, items: group.items.filter(item => !item.feature || config?.features?.[item.feature] !== false) })).filter(group => group.items.length > 0).map((group) => (
        <View key={group.title} style={{ gap: space.sm }}>
          <Text style={[type.overline, { color: colors.muted, paddingHorizontal: 2 }]}>{group.title}</Text>
          <Card padded={false}>
            {group.items.map((item, i) => (
              <Fragment key={item.label}>
                {i > 0 && <Divider />}
                <ListRow icon={item.icon} tone={item.tone} title={item.label} subtitle={item.detail} onPress={() => open(item)} />
              </Fragment>
            ))}
          </Card>
        </View>
      ))}

      <View style={{ gap: space.sm }}>
        <Text style={[type.overline, { color: colors.muted, paddingHorizontal: 2 }]}>App settings</Text>
        <Card padded={false}>
          <ListRow
            icon="bell"
            tone="brand"
            title="Class reminders"
            subtitle="Notify me 10 minutes before class"
            chevron={false}
            right={<Switch value={classReminders} disabled={settingBusy} onValueChange={(value) => void toggleReminders(value)} trackColor={{ true: colors.primary }} />}
          />
          <Divider />
          <ListRow
            icon="shield"
            tone="success"
            title="Biometric lock"
            subtitle="Require face or fingerprint when the app opens"
            chevron={false}
            right={<Switch value={biometricLock} disabled={settingBusy} onValueChange={(value) => void toggleBiometric(value)} trackColor={{ true: colors.primary }} />}
          />
        </Card>
      </View>

      <Card padded={false}>
        <ListRow icon="log-out" tone="danger" title="Sign out" onPress={confirmSignOut} chevron={false} />
      </Card>

      <View style={styles.footer}>
        <Logo size={28} withWordmark />
        <Text style={[type.caption, { color: colors.muted }]}>Version {version} · © {new Date().getFullYear()} Meet to Manage</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: space.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: 20, color: "#FFFFFF" },
  footer: { alignItems: "center", gap: space.sm, marginTop: space.md },
});
