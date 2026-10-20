import Feather from "@expo/vector-icons/Feather";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

import { WEB_BASE_URL } from "@/api/client";
import { Button } from "@/components/ui";
import { brand, fonts, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

const WEB_ORIGIN = new URL(WEB_BASE_URL).origin;

/**
 * Web-portal pages the app hands off to (paying an invoice, adding a child), opened already
 * signed in: the app's session is written into the portal's own storage keys
 * (web: lib/authStorage.ts, state/session.tsx) before the page's scripts run. The script checks
 * the origin first, so the token is only ever written for the Meet to Manage portal — never for a
 * payment gateway or any other page the flow navigates through.
 */
export default function Portal() {
  const colors = useColors();
  const session = useRequiredSession();
  const { path = "/parent", title = "Meet to Manage" } = useLocalSearchParams<{ path?: string; title?: string }>();
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const signIn = useMemo(() => {
    const entries: Record<string, string> = {
      "trn.remember": "true",
      "trn.accessToken": session.token,
      "trn.role": "parent",
      "trn.homePath": "/parent",
      "trn.userName": session.userName,
      "trn.permissions": "[]",
      ...(session.tenantCode ? { "trn.tenantCode": session.tenantCode } : {}),
    };
    return `(function(){try{if(location.origin!==${JSON.stringify(WEB_ORIGIN)})return;
var e=${JSON.stringify(entries)};for(var k in e)localStorage.setItem(k,e[k]);}catch(_){}})();true;`;
  }, [session]);

  const safePath = path.startsWith("/") ? path : `/${path}`;

  function onNavigation(nav: WebViewNavigation) {
    setCanGoBack(nav.canGoBack);
    // The portal's own sign-out or a lost session lands on /login: close back to the app instead.
    if (nav.url.startsWith(WEB_ORIGIN) && /\/login\/?$/.test(new URL(nav.url).pathname)) router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <Pressable onPress={() => (canGoBack ? web.current?.goBack() : router.back())} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ paddingRight: space.md }}>
              <Feather name="chevron-left" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      {failed ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={28} color={colors.muted} />
          <Text style={[type.heading, { color: colors.text }]}>Couldn&apos;t open this page</Text>
          <Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>Check your internet connection and try again.</Text>
          <Button label="Try again" icon="refresh-cw" size="sm" onPress={() => { setFailed(false); web.current?.reload(); }} />
        </View>
      ) : (
        <WebView
          ref={web}
          source={{ uri: `${WEB_BASE_URL}${safePath}` }}
          injectedJavaScriptBeforeContentLoaded={signIn}
          sharedCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          setSupportMultipleWindows={false}
          onNavigationStateChange={onNavigation}
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
          // UPI and other app links (upi://, intent://) are handed to the phone, not the WebView.
          onShouldStartLoadWithRequest={(req) => {
            if (/^https?:/i.test(req.url) || req.url === "about:blank") return true;
            void Linking.openURL(req.url).catch(() => undefined);
            return false;
          }}
          style={{ flex: 1 }}
        />
      )}
      {loading && !failed && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={brand.orange} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Opening securely…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xxl },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: space.sm, backgroundColor: "rgba(255,255,255,0.85)" },
  loadingText: { fontFamily: fonts.medium, fontSize: 13 },
});
