import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, layout, radius, space, useColors } from "@/lib/theme";
import { readItem, writeItem } from "@/lib/storage";
import { welcomeContent, welcomeSeenKey, type WelcomeContent } from "@/lib/welcome";
import { useAppConfig } from "@/state/appConfig";
import { useSession } from "@/state/session";

const native = Platform.OS !== "web";

/**
 * First-launch welcome tour. Its content, logo and colours come from the academy's app configuration (set by the
 * administrator); it appears once per device and organisation and can be switched off by the administrator.
 */
export function WelcomeGate() {
  const { session } = useSession();
  const { config } = useAppConfig();
  const [seen, setSeen] = useState<boolean | null>(null);
  const tenantCode = config?.tenantCode ?? session?.tenantCode ?? null;

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    readItem(welcomeSeenKey(tenantCode)).then((v) => { if (!cancelled) setSeen(v === "1"); }).catch(() => { if (!cancelled) setSeen(true); });
    return () => { cancelled = true; };
  }, [config, tenantCode]);

  const finish = useCallback(() => {
    setSeen(true);
    writeItem(welcomeSeenKey(tenantCode), "1").catch(() => undefined);
  }, [tenantCode]);

  const content = config ? welcomeContent(config) : null;
  if (!content || seen !== false) return null;
  return <WelcomeTour content={content} onDone={finish} />;
}

function WelcomeTour({ content, onDone }: { content: WelcomeContent; onDone: () => void }) {
  const colors = useColors();
  const { config } = useAppConfig();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const pages = content.features.length + 1;
  const last = page === pages - 1;
  const logo = config?.brand.logoUrl ? { uri: config.brand.logoUrl } : require("@/assets/images/mtm-logo.png");

  // Logo entrance: the screen fades in, the tile springs up, a halo ripples out once, then the text rises behind it.
  const [fade] = useState(() => new Animated.Value(0));
  const [tile] = useState(() => new Animated.Value(0));
  const [halo] = useState(() => new Animated.Value(0));
  const [text] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: native }),
      Animated.parallel([
        Animated.spring(tile, { toValue: 1, friction: 6, tension: 70, useNativeDriver: native }),
        Animated.timing(halo, { toValue: 1, duration: 1100, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        Animated.timing(text, { toValue: 1, duration: 600, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      ]),
    ]).start();
  }, [fade, tile, halo, text]);

  // Keep the current page aligned when the device rotates or the window resizes.
  useEffect(() => { pager.current?.scrollTo({ x: page * width, animated: false }); }, [width]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (next: number) => { pager.current?.scrollTo({ x: next * width, animated: true }); setPage(next); };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  const logoSize = landscape ? 76 : 112;
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.1] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] });
  const tileScale = tile.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const rise = text.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} accessibilityViewIsModal>
      <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.ring, { width: 460, height: 460, borderRadius: 230, top: -230, right: -170 }]} />
      <View style={[styles.ring, { width: 300, height: 300, borderRadius: 150, bottom: -150, left: -110 }]} />

      <View style={[styles.topBar, { paddingTop: insets.top + space.md }]}>
        {last ? <View style={styles.skip} /> : (
          <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip welcome" style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView ref={pager} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScrollEnd} style={styles.pager}>
        <View style={[styles.page, { width }]}>
          <View style={styles.pageInner}>
            <View style={[styles.logoWrap, { width: logoSize * 2.4, height: logoSize * 2.4 }]}>
              <Animated.View style={[styles.halo, { width: logoSize, height: logoSize, borderRadius: logoSize * 0.3, opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
              <Animated.View style={[styles.logoTile, { width: logoSize, height: logoSize, borderRadius: logoSize * 0.3, opacity: tile, transform: [{ scale: tileScale }] }]}>
                <Image source={logo} style={{ width: logoSize * 0.72, height: logoSize * 0.72 }} contentFit="contain" transition={250} accessibilityLabel={content.title} />
              </Animated.View>
            </View>
            <Animated.View style={{ opacity: text, transform: [{ translateY: rise }], alignItems: "center" }}>
              <Text style={[styles.title, landscape && styles.titleLandscape]} accessibilityRole="header">{content.title}</Text>
              <Text style={styles.subtitle}>{content.subtitle}</Text>
            </Animated.View>
          </View>
        </View>

        {content.features.map((feature) => (
          <View key={feature.title} style={[styles.page, { width }]}>
            <View style={styles.pageInner}>
              <View style={[styles.featureIcon, landscape && styles.featureIconLandscape]}>
                <Feather name={feature.icon} size={landscape ? 30 : 40} color={colors.primary} />
              </View>
              <Text style={[styles.title, landscape && styles.titleLandscape]} accessibilityRole="header">{feature.title}</Text>
              {feature.text ? <Text style={styles.subtitle}>{feature.text}</Text> : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: pages }, (_, i) => <View key={i} style={[styles.dot, i === page && styles.dotActive]} />)}
        </View>
        <Pressable
          onPress={() => (last ? onDone() : goTo(page + 1))}
          accessibilityRole="button"
          accessibilityLabel={last ? "Get started" : "Next"}
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
        >
          <Text style={[styles.ctaText, { color: colors.primaryInk }]}>{last ? "Get started" : "Next"}</Text>
          <Feather name={last ? "check" : "arrow-right"} size={18} color={colors.primaryInk} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, elevation: 100 },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.05)" },
  topBar: { paddingHorizontal: space.xxl, alignItems: "flex-end", minHeight: 56 },
  skip: { minWidth: 56, minHeight: 32, alignItems: "flex-end", justifyContent: "center" },
  skipText: { fontFamily: fonts.semibold, fontSize: 15, color: "rgba(255,255,255,0.92)" },
  pager: { flex: 1 },
  page: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxl },
  pageInner: { width: "100%", maxWidth: layout.formMax, alignItems: "center", gap: space.lg },
  logoWrap: { alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", backgroundColor: "rgba(255,255,255,0.55)" },
  logoTile: { backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 14 },
  title: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: "#FFFFFF", textAlign: "center" },
  titleLandscape: { fontSize: 26, lineHeight: 32 },
  subtitle: { marginTop: space.sm, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, color: "rgba(255,255,255,0.9)", textAlign: "center", maxWidth: 340 },
  featureIcon: { width: 96, height: 96, borderRadius: 30, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  featureIconLandscape: { width: 72, height: 72, borderRadius: 22 },
  footer: { alignItems: "center", gap: space.xl, paddingHorizontal: space.xxl },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { width: 26, backgroundColor: "#FFFFFF" },
  cta: { width: "100%", maxWidth: layout.formMax, minHeight: 56, borderRadius: radius.lg, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  ctaText: { fontFamily: fonts.bold, fontSize: 16 },
});
