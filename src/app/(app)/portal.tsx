import Feather from "@expo/vector-icons/Feather";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

import { Button } from "@/components/ui";
import { brand, fonts, space, type, useColors } from "@/lib/theme";
import { useAppConfig } from "@/state/appConfig";
import { useRequiredSession } from "@/state/session";

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
  const { webBaseUrl, isLoading: configLoading, error: configError, retry: retryConfig } = useAppConfig();
  const webOrigin = useMemo(() => {
    try {
      const url = webBaseUrl ? new URL(webBaseUrl) : null;
      return url?.protocol === "https:" ? url.origin : null;
    } catch { return null; }
  }, [webBaseUrl]);
  const { path = "/parent", title = "Meet to Manage" } = useLocalSearchParams<{ path?: string; title?: string }>();
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const signIn = useMemo(() => {
    if (!webOrigin) return "true;";
    const entries: Record<string, string> = {
      "trn.remember": "true",
      "trn.accessToken": session.token,
      "trn.role": "parent",
      "trn.homePath": "/parent",
      "trn.userName": session.userName,
      "trn.permissions": "[]",
      ...(session.tenantCode ? { "trn.tenantCode": session.tenantCode } : {}),
    };
    return `(function(){try{if(location.origin!==${JSON.stringify(webOrigin)})return;
var e=${JSON.stringify(entries)};for(var k in e)localStorage.setItem(k,e[k]);}catch(_){}})();true;`;
  }, [session, webOrigin]);

  const safePath = path.startsWith("/") ? path : `/${path}`;

  function onNavigation(nav: WebViewNavigation) {
    setCanGoBack(nav.canGoBack);
    // The portal's own sign-out or a lost session lands on /login: close back to the app instead.
    if (webOrigin && nav.url.startsWith(webOrigin) && /\/login\/?$/.test(new URL(nav.url).pathname)) router.back();
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
      {!webOrigin ? (
        <View style={styles.center}>
          {configLoading ? <ActivityIndicator color={colors.primary} /> : (
            <>
              <Feather name="globe" size={28} color={colors.muted} />
              <Text style={[type.heading, { color: colors.text }]}>{configError ? "Couldn’t load this page" : "This page isn’t available yet"}</Text>
              <Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>{configError ?? "Your academy hasn’t set up a secure website for the app. Please contact them."}</Text>
              {configError ? <Button label="Try again" icon="refresh-cw" size="sm" onPress={retryConfig} /> : <Button label="Go back" icon="chevron-left" size="sm" onPress={() => router.back()} />}
            </>
          )}
        </View>
      ) : failed ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={28} color={colors.muted} />
          <Text style={[type.heading, { color: colors.text }]}>Couldn&apos;t open this page</Text>
          <Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>Check your internet connection and try again.</Text>
          <Button label="Try again" icon="refresh-cw" size="sm" onPress={() => { setFailed(false); web.current?.reload(); }} />
        </View>
      ) : (
        <WebView
          ref={web}
          source={{ uri: `${webOrigin}${safePath}` }}
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
            if (req.url === "about:blank") return true;
            if (/^https:/i.test(req.url)) return true;
            if (/^(upi|tel|mailto):/i.test(req.url)) void Linking.openURL(req.url).catch(() => undefined);
            return false;
          }}
          style={{ flex: 1 }}
        />
      )}
      {loading && !failed && !!webOrigin && (
        <View style={[styles.loading, { backgroundColor: colors.background }]} pointerEvents="none">
          <ActivityIndicator color={brand.orange} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Opening securely…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xxl },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: space.sm, opacity: 0.96 },
  loadingText: { fontFamily: fonts.medium, fontSize: 13 },
});
