import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getNotifications } from "@/api/parent";
import { useKeyboardVisible } from "@/components/keyboard";
import type { IconName } from "@/components/ui";
import { TAB_BAR_SPACE, TabBarSpace } from "@/lib/tabBar";
import { brand, elevation, fonts, radius, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

const TABS: Record<string, { title: string; icon: IconName }> = {
  index: { title: "Home", icon: "home" },
  classes: { title: "Classes", icon: "calendar" },
  fees: { title: "Fees", icon: "credit-card" },
  updates: { title: "Updates", icon: "bell" },
  more: { title: "More", icon: "grid" },
};

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export default function TabsLayout() {
  const session = useRequiredSession();
  // Shares its cache with the Updates screen, so reading notifications clears the badge.
  const feed = useQuery({ queryKey: ["notifications", session.token], queryFn: () => getNotifications(session.token), refetchInterval: 120_000 });
  const unread = feed.data?.unreadCount ?? 0;

  return (
    <TabBarSpace value={TAB_BAR_SPACE}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} unread={unread} />}>
        {Object.entries(TABS).map(([name, tab]) => <Tabs.Screen key={name} name={name} options={{ title: tab.title }} />)}
      </Tabs>
    </TabBarSpace>
  );
}

/** A floating, rounded footer; the active tab is a logo-orange circle with its label beside it. */
function FloatingTabBar({ state, emitter, navigateToTab, unread }: TabBarProps & { unread: number }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // On Android the bar would otherwise ride up on top of the keyboard.
  if (useKeyboardVisible()) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.bar, { backgroundColor: colors.card, shadowColor: colors.shadow, borderColor: colors.border }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const badge = route.name === "updates" && unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null;
          const onPress = () => {
            const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${tab.title}, ${unread} unread` : tab.title}
              style={[styles.item, focused && styles.itemActive]}
            >
              {focused ? (
                <LinearGradient colors={[brand.orangeFrom, brand.orangeTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activePill}>
                  <Feather name={tab.icon} size={18} color="#FFFFFF" />
                  <Text style={styles.activeLabel} numberOfLines={1}>{tab.title}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.icon}>
                  <Feather name={tab.icon} size={21} color={colors.muted} />
                  {badge && (
                    <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: { flexDirection: "row", alignItems: "center", borderRadius: radius.pill, borderWidth: 1, padding: 6, ...elevation.high },
  item: { flex: 1, alignItems: "center", justifyContent: "center", height: 52 },
  itemActive: { flex: 2.1 },
  activePill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "stretch", height: 52, borderRadius: radius.pill, paddingHorizontal: 12 },
  activeLabel: { fontFamily: fonts.bold, fontSize: 13, color: "#FFFFFF" },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.bold, fontSize: 9, color: "#FFFFFF" },
});
