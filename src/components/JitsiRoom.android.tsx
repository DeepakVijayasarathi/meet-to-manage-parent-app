import { router } from "expo-router";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import type { ApiJitsiJoin } from "@/api/types";
import { roomUrl } from "@/lib/jitsi";

export interface JitsiRoomProps {
  join: ApiJitsiJoin;
  displayName: string;
  subject: string;
  onReady: () => void;
}

/**
 * Jitsi SDK 13.2 requires peer versions that conflict with Expo SDK 56's
 * Android native dependency set. Keep Android on the authenticated web client
 * so the SDK cannot fail while evaluating before it exports JitsiMeeting.
 */
export function JitsiRoom({ join, displayName, onReady }: JitsiRoomProps) {
  return (
    <WebView
      source={{ uri: roomUrl(join, displayName) }}
      style={styles.fill}
      originWhitelist={["https://*"]}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      allowsFullscreenVideo
      onLoadEnd={onReady}
      onNavigationStateChange={(nav) => {
        if (/\/static\/close|close\.html/.test(nav.url) && router.canGoBack()) router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
