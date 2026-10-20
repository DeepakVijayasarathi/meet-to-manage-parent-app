import { router } from "expo-router";
import { useEffect, useRef, type ComponentRef } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import type { ApiJitsiJoin } from "@/api/types";
import { roomUrl } from "@/lib/jitsi";

export interface JitsiRoomProps {
  join: ApiJitsiJoin;
  displayName: string;
  subject: string;
  onReady: () => void;
  /** Bumped when the teacher presses "Mute everyone" (hub MuteAll). */
  muteRequestAt?: number;
  /** The participant the teacher pinned (hub Pinned), or null to unpin. */
  pinnedId?: string | null;
}

/**
 * The classroom on the academy's self-hosted Jitsi (`join.domain`), in the room's own web
 * page. Used on Android and iOS alike: @jitsi/react-native-sdk 13.2 throws while loading under
 * Expo SDK 56 ("Cannot read property 'JitsiMeeting' of undefined"), so the native SDK is not
 * used until a release matching this React Native version is verified on devices.
 */
export function JitsiRoom({ join, displayName, onReady, muteRequestAt = 0, pinnedId }: JitsiRoomProps) {
  const web = useRef<ComponentRef<typeof WebView>>(null);

  // Teacher's "Mute everyone": mute this child's microphone in the Jitsi page itself.
  useEffect(() => {
    if (!muteRequestAt) return;
    web.current?.injectJavaScript(`try{window.APP&&APP.conference&&APP.conference.muteAudio(true)}catch(e){}true;`);
  }, [muteRequestAt]);

  // Follow the teacher's spotlight, like the web classroom does for students.
  useEffect(() => {
    if (pinnedId === undefined) return;
    const id = JSON.stringify(pinnedId);
    web.current?.injectJavaScript(
      // jitsi-meet's own pinParticipant(id) action (react/features/base/participants/actions).
      `try{var s=window.APP&&APP.store;if(s)s.dispatch({type:"PIN_PARTICIPANT",participant:{id:${id}}});}catch(e){}true;`,
    );
  }, [pinnedId]);

  return (
    <WebView
      ref={web}
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
      // Jitsi navigates to its "close" page on hang-up: take the family back to the app.
      onNavigationStateChange={(nav) => { if (/\/static\/close|close\.html/.test(nav.url)) router.back(); }}
    />
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
