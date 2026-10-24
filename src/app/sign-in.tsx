import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";
import { KeyboardSafe } from "@/components/keyboard";
import { Button } from "@/components/ui";
import { brand, elevation, fonts, layout, radius, space, type, useColors } from "@/lib/theme";
import { useSession } from "@/state/session";

export default function SignIn() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const { signIn, notice, clearNotice } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pinRef = useRef<ComponentRef<typeof TextInput>>(null);
  const canSubmit = identifier.trim().length > 0 && /^\d{4}$/.test(pin);

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    clearNotice();
    try {
      await signIn(identifier, pin);
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err, "Sign in failed. Please check your email and PIN."));
      setPin("");
      pinRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  // Keep the wrapper style stable while Android transfers focus to the native input.
  // Updating shadow/elevation from onFocus can make Fabric immediately blur TextInput.
  const field = [
    styles.field,
    { backgroundColor: colors.mutedBg, borderColor: error ? colors.danger : colors.mutedBg },
  ];

  return (
    <KeyboardSafe style={{ backgroundColor: colors.card }}>
      <ScrollView
        contentContainerStyle={styles.flexGrow}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={[brand.orangeFrom, brand.orangeTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, landscape && styles.heroLandscape, { paddingTop: insets.top + (landscape ? 20 : 48) }]}>
          {/* Soft concentric rings: depth without a hard-edged shape. */}
          <View style={[styles.ring, { width: 420, height: 420, borderRadius: 210, top: -210, right: -160 }]} />
          <View style={[styles.ring, { width: 280, height: 280, borderRadius: 140, top: -120, right: -90 }]} />
          <View style={[styles.ring, { width: 220, height: 220, borderRadius: 110, bottom: -120, left: -80 }]} />

          <View style={[styles.logoTile, elevation.mid, { shadowColor: "rgba(0,0,0,0.25)" }]}>
            <Image source={require("@/assets/images/mtm-logo.png")} style={styles.logo} contentFit="contain" accessibilityLabel="Meet to Manage" />
          </View>
          <Text style={styles.brandLine}>
            Meet <Text style={styles.brandTo}>to</Text> Manage
          </Text>
          <Text style={[styles.heroTitle, landscape && styles.heroTitleLandscape]}>Welcome back</Text>
          <Text style={[styles.heroSubtitle, landscape && styles.heroSubtitleLandscape]}>
            Classes, progress and fees for your family, all in one place.
          </Text>
        </LinearGradient>

        {/* Keep native inputs in a stable, non-animated subtree. Reanimated entering/layout
            updates can make Android drop TextInput focus as the IME starts opening. */}
        <View style={[styles.panel, { backgroundColor: colors.card, paddingBottom: insets.bottom + space.xl }]}>
          <View style={styles.inner}>
            <View style={{ gap: 4 }}>
              <Text style={[type.title, { color: colors.text }]}>Sign in</Text>
              <Text style={[type.body, { color: colors.muted }]}>Use the details your academy shared with you.</Text>
            </View>

            <View style={styles.group}>
              <Text style={[type.label, { color: colors.textSoft }]}>Email or mobile number</Text>
              <View style={field}>
                <View style={[styles.fieldIcon, { backgroundColor: colors.card }]}>
                  <Feather name="user" size={16} color={colors.muted} />
                </View>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.primary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => pinRef.current?.focus()}
                  accessibilityLabel="Email or mobile number"
                />
              </View>
            </View>

            <View style={styles.group}>
              <Text style={[type.label, { color: colors.textSoft }]}>PIN</Text>
              <View style={field}>
                <View style={[styles.fieldIcon, { backgroundColor: colors.card }]}>
                  <Feather name="lock" size={16} color={colors.muted} />
                </View>
                <TextInput
                  ref={pinRef}
                  style={[styles.input, pin.length > 0 && !showPin && styles.pinMasked, { color: colors.text }]}
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))}
                  placeholder="4-digit PIN"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.primary}
                  secureTextEntry={!showPin}
                  keyboardType="number-pad"
                  autoComplete="password"
                  textContentType="password"
                  maxLength={4}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  accessibilityLabel="PIN"
                />
                <Pressable onPress={() => setShowPin((v) => !v)} hitSlop={12} accessibilityRole="button" accessibilityLabel={showPin ? "Hide PIN" : "Show PIN"} style={styles.eye}>
                  <Feather name={showPin ? "eye-off" : "eye"} size={18} color={colors.muted} />
                </Pressable>
              </View>
            </View>

            {notice && !error && (
              <View style={[styles.error, { backgroundColor: colors.mutedBg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Feather name="info" size={16} color={colors.muted} style={{ marginTop: 2 }} />
                <Text style={[styles.errorText, { color: colors.text }]}>{notice}</Text>
              </View>
            )}

            {error && (
              <View style={[styles.error, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Feather name="alert-circle" size={16} color={colors.danger} style={{ marginTop: 2 }} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <Button label="Sign in" icon={busy ? undefined : "arrow-right"} onPress={submit} disabled={!canSubmit} loading={busy} />

            <View style={[styles.help, { backgroundColor: colors.mutedBg }]}>
              <View style={[styles.helpIcon, { backgroundColor: colors.card }]}>
                <Feather name="help-circle" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.helpText, { color: colors.muted }]}>
                Forgot your PIN? Reset it on the Meet to Manage website or ask your academy.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Feather name="shield" size={13} color={colors.muted} />
            <Text style={[type.caption, { color: colors.muted }]}>Secure sign-in · © {new Date().getFullYear()} Meet to Manage</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardSafe>
  );
}

const styles = StyleSheet.create({
  flexGrow: { flexGrow: 1 },
  hero: { paddingHorizontal: space.xxl, paddingBottom: 76, alignItems: "center", overflow: "hidden" },
  heroLandscape: { paddingBottom: 52 },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.05)" },
  logoTile: { width: 88, height: 88, borderRadius: 28, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  logo: { width: 64, height: 64 },
  brandLine: { marginTop: space.lg, fontFamily: fonts.bold, fontSize: 15, letterSpacing: 0.3, color: "#FFFFFF" },
  brandTo: { fontFamily: fonts.medium, color: "rgba(255,255,255,0.8)" },
  heroTitle: { marginTop: space.lg, fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1, lineHeight: 40, color: "#FFFFFF", textAlign: "center" },
  heroTitleLandscape: { marginTop: space.sm, fontSize: 28, lineHeight: 34 },
  heroSubtitle: { marginTop: space.sm, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.88)", textAlign: "center", maxWidth: 320 },
  heroSubtitleLandscape: { marginTop: space.xs, maxWidth: 520 },
  // flexGrow, not flex: 1 — flex's zero basis let the scroll content shrink to the screen, so it never overflowed and never scrolled.
  panel: { flexGrow: 1, marginTop: -40, borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingHorizontal: space.xxl, paddingTop: space.xxxl, justifyContent: "space-between" },
  inner: { width: "100%", maxWidth: layout.formMax, alignSelf: "center", gap: space.xl },
  group: { gap: space.sm },
  field: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1.5, borderRadius: radius.lg, paddingLeft: 8, paddingRight: space.lg, minHeight: 58 },
  fieldIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, paddingVertical: space.md },
  pinMasked: { letterSpacing: 8 },
  eye: { padding: 4 },
  error: { flexDirection: "row", gap: space.sm, borderRadius: radius.md, padding: space.md },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  help: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.lg, padding: space.md },
  helpIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  helpText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: space.xxxl },
});
