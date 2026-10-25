import Constants from "expo-constants";
import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, View } from "react-native";
import { Button, Logo } from "@/components/ui";
import { fonts, space, useColors } from "@/lib/theme";
import { useAppConfig } from "@/state/appConfig";
import { useSession } from "@/state/session";

const parts = (v: string) => v.split(".").map(x => Number.parseInt(x, 10) || 0);
const olderThan = (current: string, minimum: string) => {
  const a = parts(current), b = parts(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0); }
  return false;
};

export function OperationalGate() {
  const colors = useColors();
  const { config, retry } = useAppConfig();
  const { signOut } = useSession();
  if (!config) return null;
  const current = Constants.expoConfig?.version ?? "0.0.0";
  const upgrade = !!config.minimumVersion && olderThan(current, config.minimumVersion);
  const blocked = config.maintenance?.active || (upgrade && config.forceUpgrade);
  if (!blocked && !upgrade) return null;
  const maintenance = !!config.maintenance?.active;
  return <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background }]} accessibilityViewIsModal>
    <Logo size={72} />
    <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Feather name={maintenance ? "tool" : "download-cloud"} size={28} color={colors.primary} /></View>
    <Text style={[styles.title, { color: colors.text }]}>{maintenance ? "We'll be back soon" : "Update available"}</Text>
    <Text style={[styles.body, { color: colors.muted }]}>{maintenance ? config.maintenance?.message || "We're improving the app. Please try again shortly." : `Version ${config.minimumVersion} or newer is required. You currently have ${current}.`}</Text>
    {config.maintenance?.endsAtUtc && <Text style={[styles.note, { color: colors.muted }]}>Expected back {new Date(config.maintenance.endsAtUtc).toLocaleString()}</Text>}
    <Button label="Check again" icon="refresh-cw" onPress={retry} />
    {!blocked && <Text style={[styles.note, { color: colors.muted }]}>You can continue, but updating is recommended.</Text>}
    {blocked && <Button label="Sign out" variant="ghost" onPress={() => signOut()} />}
  </View>;
}
const styles = StyleSheet.create({ root: { zIndex: 500, elevation: 500, alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.lg }, icon: { width: 64, height: 64, borderRadius: 24, alignItems: "center", justifyContent: "center" }, title: { fontFamily: fonts.bold, fontSize: 26, textAlign: "center" }, body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, maxWidth: 380, textAlign: "center" }, note: { fontFamily: fonts.medium, fontSize: 13, textAlign: "center" } });
