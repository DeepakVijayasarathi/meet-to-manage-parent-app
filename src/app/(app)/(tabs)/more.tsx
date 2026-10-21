import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, Divider, ListRow, Logo, Screen, type IconName, type Tone } from "@/components/ui";
import { initials } from "@/lib/format";
import { brand, fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession, useSession } from "@/state/session";

/** `href` is a native screen; `portal` a web-portal page opened in-app, already signed in. */
type Item = { label: string; detail: string; icon: IconName; tone: Tone; href?: Href; portal?: string };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Learning",
    items: [
      { label: "Progress reports", detail: "Monthly notes from teachers", icon: "file-text", tone: "brand", href: "/reports" as Href },
      { label: "Learning resources", detail: "Worksheets and reading books", icon: "book-open", tone: "info", href: "/resources" as Href },
      { label: "Class recordings", detail: "Watch past classes again", icon: "play-circle", tone: "success", href: "/recordings" as Href },
    ],
  },
  {
    title: "Family",
    items: [
      { label: "Add a child", detail: "Enrol a brother or sister", icon: "user-plus", tone: "brand", portal: "/parent/add-child" },
      { label: "Enrollment form", detail: "Enrol your child and share class preferences", icon: "clipboard", tone: "info", href: "/enrollment" as Href },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Help & support", detail: "Raise a request, chat with the team", icon: "life-buoy", tone: "warning", href: "/support" as Href },
      { label: "Open web portal", detail: "Everything from the website, already signed in", icon: "globe", tone: "neutral", portal: "/parent" },
    ],
  },
];

export default function More() {
  const colors = useColors();
  const session = useRequiredSession();
  const { signOut } = useSession();
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const open = (item: Item) => {
    if (item.href) router.push(item.href);
    else if (item.portal) router.push({ pathname: "/portal", params: { path: item.portal, title: item.label } });
  };

  return (
    <Screen title="More">
      <Card style={styles.profile}>
        <LinearGradient colors={[brand.orangeFrom, brand.orangeTo]} style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(session.userName)}</Text>
        </LinearGradient>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>{session.userName}</Text>
          <Text style={[type.caption, { color: colors.muted }]}>Parent account{session.tenantCode ? ` · ${session.tenantCode}` : ""}</Text>
        </View>
      </Card>

      {GROUPS.map((group) => (
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

      <Card padded={false}>
        <ListRow icon="log-out" tone="danger" title="Sign out" onPress={() => signOut()} chevron={false} />
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
