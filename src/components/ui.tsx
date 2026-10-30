// Shared building blocks (counterparts of the web portal's Card, KpiCard, Badge, Button,
// EmptyState), styled from the logo's charcoal-and-orange palette.
import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Children, isValidElement, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardSafe } from "@/components/keyboard";
import { useTabBarSpace } from "@/lib/tabBar";
import { brand, elevation, fonts, layout, radius, space, type, useColors, type Colors } from "@/lib/theme";
import { useAppConfig } from "@/state/appConfig";

export type IconName = ComponentProps<typeof Feather>["name"];
export type Tone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

export function toneColors(colors: Colors, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case "success": return { bg: colors.successSoft, fg: colors.success };
    case "warning": return { bg: colors.warningSoft, fg: colors.warningText };
    case "danger": return { bg: colors.dangerSoft, fg: colors.danger };
    case "info": return { bg: colors.infoSoft, fg: colors.info };
    case "neutral": return { bg: colors.mutedBg, fg: colors.muted };
    default: return { bg: colors.primarySoft, fg: colors.primaryInk };
  }
}

/** Slides a section up into place; `index` staggers siblings. */
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 60).duration(380)} style={style}>
      {children}
    </Animated.View>
  );
}

export function Logo({ size = 40, withWordmark, light }: { size?: number; withWordmark?: boolean; light?: boolean }) {
  const colors = useColors();
  const configured = useAppConfig().config?.brand;
  const logoSource = configured?.logoUrl ? { uri: configured.logoUrl } : require("@/assets/images/mtm-logo.png");
  const name = configured?.name?.trim() || "Meet to Manage";
  return (
    <View style={styles.logoRow} accessibilityRole="image" accessibilityLabel="Meet to Manage">
      <View style={[styles.logoTile, { width: size, height: size, borderRadius: size * 0.28 }]}>
        <Image source={logoSource} style={{ width: size * 0.74, height: size * 0.74 }} contentFit="contain" />
      </View>
      {withWordmark && (
        <>
          <View style={[styles.logoDivider, { backgroundColor: light ? "rgba(255,255,255,0.35)" : colors.text }]} />
          {/* Mirrors the logo lockup: orange "Meet" / "Manage", smaller charcoal "to". */}
          <Text style={[styles.wordmark, { color: light ? "#FFFFFF" : colors.text }]} numberOfLines={1}>{name}</Text>
        </>
      )}
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.card, padded && styles.cardPadded, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({ title, caption }: { title: string; caption?: string }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
      {caption ? <Text style={[type.caption, { color: colors.muted }]}>{caption}</Text> : null}
    </View>
  );
}

export function IconTile({ icon, tone = "brand", size = 40 }: { icon: IconName; tone?: Tone; size?: number }) {
  const colors = useColors();
  const { bg, fg } = toneColors(colors, tone);
  return (
    <View style={[styles.iconTile, { width: size, height: size, borderRadius: size * 0.36, backgroundColor: bg }]}>
      <Feather name={icon} size={size * 0.46} color={fg} />
    </View>
  );
}

export function StatCard({ label, value, valueNode, icon, tone = "brand", footer, loading }: {
  label: string; value?: string; valueNode?: ReactNode; icon: IconName; tone?: Tone; footer?: ReactNode; loading?: boolean;
}) {
  const colors = useColors();
  const { bg, fg } = toneColors(colors, tone);
  return (
    <View style={[styles.stat, { backgroundColor: bg }]}>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: colors.card }]}>
          <Feather name={icon} size={18} color={fg} />
        </View>
      </View>
      <View style={{ gap: 2 }}>
        {loading
          ? <View style={[styles.skeleton, { backgroundColor: colors.card }]} />
          : valueNode ?? <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>}
        <Text style={[type.caption, { color: colors.textSoft }]} numberOfLines={1}>{label}</Text>
      </View>
      {footer}
    </View>
  );
}

export function Badge({ label, tone = "brand", dot }: { label: string; tone?: Tone; dot?: boolean }) {
  const colors = useColors();
  const { bg, fg } = toneColors(colors, tone);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {dot && <View style={[styles.dot, { backgroundColor: fg }]} />}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({ label, onPress, icon, variant = "primary", disabled, loading, style, size = "md" }: {
  label: string; onPress?: () => void; icon?: IconName; variant?: ButtonVariant; disabled?: boolean; loading?: boolean;
  style?: StyleProp<ViewStyle>; size?: "sm" | "md";
}) {
  const colors = useColors();
  const inactive = disabled || loading;
  const fg = variant === "primary" ? "#FFFFFF" : variant === "secondary" ? colors.text : colors.primaryInk;
  const content = loading ? <ActivityIndicator color={fg} /> : (
    <>
      <Text style={[styles.buttonText, size === "sm" && styles.buttonTextSm, { color: fg }]}>{label}</Text>
      {icon && <Feather name={icon} size={size === "sm" ? 14 : 17} color={fg} />}
    </>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [{ opacity: disabled && !loading ? 0.45 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}
    >
      {variant === "primary" ? (
        <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.button, size === "sm" && styles.buttonSm, styles.buttonShadow, { shadowColor: colors.primary }]}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.button, size === "sm" && styles.buttonSm, variant === "secondary" && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
          {content}
        </View>
      )}
    </Pressable>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: IconName; title: string; description: string; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <IconTile icon={icon} tone="neutral" size={48} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.muted }]}>{description}</Text>
      {action}
    </View>
  );
}

export function Skeleton({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[{ height, borderRadius: radius.md, backgroundColor: colors.mutedBg }, style]} />;
}

/** Tab-screen scaffold: large title header on the page background, scrollable body, pull-to-refresh. */
export function Screen({ title, subtitle, right, children, refreshing, onRefresh, scroll = true }: {
  title?: string; subtitle?: string; right?: ReactNode; children: ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarSpace();
  const backdrop = <View pointerEvents="none" style={StyleSheet.absoluteFill}><View style={[styles.ambientTop, { backgroundColor: colors.primarySoft }]} /><View style={[styles.ambientSide, { backgroundColor: colors.infoSoft }]} /></View>;
  const header = title ? (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[type.body, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  ) : null;
  if (!scroll) {
    return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: title ? insets.top + space.md : 0 }]}>{backdrop}<View style={[styles.content, styles.fixedContent]}>{header}{children}</View></View>;
  }
  return (
    <KeyboardSafe style={{ backgroundColor: colors.background }}>
    {backdrop}
    <ScrollView
      style={{ flex: 1, backgroundColor: "transparent" }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={[styles.screenBody, { paddingTop: title ? insets.top + space.lg : space.lg, paddingBottom: space.xxxl + (tabBar ? tabBar + insets.bottom : insets.bottom) }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      <View style={styles.content}>
        {header ? <Appear>{header}</Appear> : null}
        {Children.toArray(children).filter(Boolean).map((child, i) => (
          <Appear key={isValidElement(child) && child.key != null ? String(child.key) : i} index={i + 1}>{child}</Appear>
        ))}
      </View>
    </ScrollView>
    </KeyboardSafe>
  );
}

/** A tappable row inside a padded={false} Card; groups of rows read like a settings list. */
export function ListRow({ icon, tone = "brand", title, subtitle, right, onPress, leading, chevron = !!onPress }: {
  icon?: IconName; tone?: Tone; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; leading?: ReactNode; chevron?: boolean;
}) {
  const colors = useColors();
  const body = (
    <>
      {leading ?? (icon ? <IconTile icon={icon} tone={tone} size={40} /> : null)}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: colors.muted }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron && <Feather name="chevron-right" size={18} color={colors.muted} />}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.mutedBg }]}>
      {body}
    </Pressable>
  );
}

export function Divider({ inset = 72 }: { inset?: number }) {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }} />;
}

/** Segmented control (Upcoming / Past, All / Due / Paid). */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.mutedBg }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}
          >
            <Text style={[type.label, { color: active ? colors.text : colors.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontal filter chips (children, categories). */
export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[type.label, { color: active ? "#FFFFFF" : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ErrorCard({ message, onRetry, actionLabel = "Try again", actionIcon = "refresh-cw" }: { message: string; onRetry: () => void; actionLabel?: string; actionIcon?: IconName }) {
  return (
    <Card>
      <EmptyState icon="wifi-off" title="Something went wrong" description={message}
        action={<Button label={actionLabel} icon={actionIcon} size="sm" variant="secondary" onPress={onRetry} style={{ marginTop: space.sm }} />} />
    </Card>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoTile: { backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(16,24,40,0.08)" },
  logoDivider: { width: 1.5, height: 22, borderRadius: 1, opacity: 0.85 },
  wordmark: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4 },
  wordmarkTo: { fontFamily: fonts.semibold, fontSize: 14 },
  // On the white page a card is a fine 1px outline plus a wide, faint shadow.
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    ...elevation.mid,
  },
  cardPadded: { padding: space.xl },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.sm, marginBottom: space.md, paddingHorizontal: 2 },
  iconTile: { alignItems: "center", justifyContent: "center" },
  stat: { flex: 1, gap: space.md, minHeight: 138, borderRadius: radius.lg, padding: space.lg },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  statValue: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.8 },
  skeleton: { height: 30, width: 64, borderRadius: radius.sm },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  button: { flexDirection: "row", gap: space.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, minHeight: 56, paddingHorizontal: space.xxl },
  buttonShadow: { shadowColor: brand.orangeTo, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  buttonSm: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: space.lg },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.1 },
  buttonTextSm: { fontSize: 14 },
  screen: { flex: 1, paddingHorizontal: space.lg, alignItems: "center" },
  screenBody: { paddingHorizontal: space.xl },
  content: { width: "100%", maxWidth: layout.contentMax, alignSelf: "center", gap: space.xl },
  // A flex child (chat thread, map, camera, etc.) needs a bounded container on
  // non-scrolling screens. Without this, Android measures it at its minimum
  // height and the entire interface collapses into a strip at the top.
  fixedContent: { flex: 1, alignSelf: "center" },
  ambientTop: { position: "absolute", width: 300, height: 300, borderRadius: 150, top: -190, right: -110, opacity: 0.72 },
  ambientSide: { position: "absolute", width: 220, height: 220, borderRadius: 110, top: 280, left: -180, opacity: 0.28 },
  screenHeader: { flexDirection: "row", alignItems: "flex-end", gap: space.md },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, minHeight: 64 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  rowSubtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  segmented: { flexDirection: "row", borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, paddingVertical: 10 },
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg, paddingVertical: 8 },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xl, paddingHorizontal: space.md },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, marginTop: space.xs, textAlign: "center" },
  emptyBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 300 },
});
