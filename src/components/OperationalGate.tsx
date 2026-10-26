import Constants from "expo-constants";
import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Logo } from "@/components/ui";
import { fonts, space, useColors } from "@/lib/theme";
import { isOlderVersion } from "@/lib/appVersion";
import { useAppConfig } from "@/state/appConfig";
import { useSession } from "@/state/session";

export function OperationalGate() {
  const colors = useColors();
  const { config, retry } = useAppConfig();
  const { signOut } = useSession();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  if (!config) return null;
  const current = Constants.expoConfig?.version ?? "0.0.0";
  const upgrade = !!config.minimumVersion && isOlderVersion(current, config.minimumVersion);
  const blocked = config.maintenance?.active || (upgrade && config.forceUpgrade);
  if (upgrade && !blocked && dismissedVersion === config.minimumVersion) return null;
  if (!blocked && !upgrade) return null;
  const maintenance = !!config.maintenance?.active;
  return <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background }]} accessibilityViewIsModal>
    <Logo size={72} />
    <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Feather name={maintenance ? "tool" : "download-cloud"} size={28} color={colors.primary} /></View>
    <Text style={[styles.title, { color: colors.text }]}>{maintenance ? "We'll be back soon" : "Update available"}</Text>
    <Text style={[styles.body, { color: colors.muted }]}>{maintenance ? config.maintenance?.message || "We're improving the app. Please try again shortly." : `Version ${config.minimumVersion} or newer is required. You currently have ${current}.`}</Text>
    {config.maintenance?.endsAtUtc && <Text style={[styles.note, { color: colors.muted }]}>Expected back {new Date(config.maintenance.endsAtUtc).toLocaleString()}</Text>}
    <Button label="Check again" icon="refresh-cw" onPress={retry} />
    {!blocked && <Button label="Continue for now" variant="ghost" onPress={() => setDismissedVersion(config.minimumVersion ?? current)} />}
    {!blocked && <Text style={[styles.note, { color: colors.muted }]}>Updating is recommended, but you can continue with this version.</Text>}
    {blocked && <Button label="Sign out" variant="ghost" onPress={() => signOut()} />}
  </View>;
}
const styles = StyleSheet.create({ root: { zIndex: 500, elevation: 500, alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.lg }, icon: { width: 64, height: 64, borderRadius: 24, alignItems: "center", justifyContent: "center" }, title: { fontFamily: fonts.bold, fontSize: 26, textAlign: "center" }, body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, maxWidth: 380, textAlign: "center" }, note: { fontFamily: fonts.medium, fontSize: 13, textAlign: "center" } });
