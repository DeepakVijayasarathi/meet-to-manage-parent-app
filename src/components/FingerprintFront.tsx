import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { brand, elevation, fonts, layout, radius, space } from "@/lib/theme";

/**
 * The app's front screen when fingerprint sign-in is on: the logo, "Sign in securely with fingerprint" and, below it,
 * "Sign in with PIN". Used by the sign-in screen and by the app lock, so the fingerprint is only ever asked for here.
 * Leave `onFingerprint` out to show just the logo while the app is still deciding what to show.
 */
export function FingerprintFront({ onFingerprint, onPin, busy, error }: { onFingerprint?: () => void; onPin?: () => void; busy?: boolean; error?: string | null }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={[brand.orangeFrom, brand.orangeTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.quick, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl }]}>
      <View style={[styles.ring, { width: 420, height: 420, borderRadius: 210, top: -210, right: -160 }]} />
      <View style={[styles.ring, { width: 260, height: 260, borderRadius: 130, bottom: -110, left: -90 }]} />
      <View style={styles.quickTop}>
        <View style={[styles.logoTile, elevation.mid, { shadowColor: "rgba(0,0,0,0.25)" }]}>
          <Image source={require("@/assets/images/mtm-logo.png")} style={styles.logo} contentFit="contain" accessibilityLabel="Meet to Manage" />
        </View>
        <Text style={styles.brandLine}>Meet <Text style={styles.brandTo}>to</Text> Manage</Text>
      </View>
      {onFingerprint && (
        <View style={styles.quickActions}>
          {error && <Text style={styles.quickError} accessibilityRole="alert">{error}</Text>}
          <Pressable onPress={onFingerprint} disabled={busy} accessibilityRole="button" accessibilityLabel="Sign in securely with fingerprint" style={({ pressed }) => [styles.quickButton, { opacity: busy ? 0.6 : pressed ? 0.9 : 1 }]}>
            <MaterialCommunityIcons name="fingerprint" size={26} color={brand.orangeTo} />
            <Text style={styles.quickButtonText}>{busy ? "Signing in…" : "Sign in securely with fingerprint"}</Text>
          </Pressable>
          {onPin && (
            <Pressable onPress={onPin} hitSlop={10} accessibilityRole="button" accessibilityLabel="Sign in with PIN">
              <Text style={styles.quickLink}>Sign in with PIN</Text>
            </Pressable>
          )}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  quick: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xxl, overflow: "hidden" },
  quickTop: { flex: 1, alignItems: "center", justifyContent: "center" },
  quickActions: { alignSelf: "stretch", alignItems: "center", gap: space.xl, maxWidth: layout.formMax, width: "100%" },
  quickButton: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, minHeight: 56, borderRadius: radius.pill, backgroundColor: "#FFFFFF" },
  quickButtonText: { fontFamily: fonts.bold, fontSize: 16, color: brand.charcoal },
  quickLink: { fontFamily: fonts.semibold, fontSize: 15, color: "#FFFFFF", textDecorationLine: "underline", paddingVertical: space.xs },
  quickError: { fontFamily: fonts.medium, fontSize: 14, color: "#FFFFFF", textAlign: "center" },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.05)" },
  logoTile: { width: 88, height: 88, borderRadius: 28, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  logo: { width: 64, height: 64 },
  brandLine: { marginTop: space.lg, fontFamily: fonts.bold, fontSize: 15, letterSpacing: 0.3, color: "#FFFFFF" },
  brandTo: { fontFamily: fonts.medium, color: "rgba(255,255,255,0.8)" },
});
