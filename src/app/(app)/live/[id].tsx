import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { Camera } from "expo-camera";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";
import { getJitsiJoin } from "@/api/parent";
import type { ApiJitsiJoin } from "@/api/types";
import { CelebrationOverlay, ClassroomPanel, QuizOverlay, type Snap } from "@/components/classroom/ClassroomPanel";
import { JitsiRoom } from "@/components/JitsiRoom";
import { useKeyboardHeight } from "@/components/keyboard";
import { useClassroom } from "@/lib/useClassroom";
import { Button } from "@/components/ui";
import { brand, fonts, radius, space } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

type Permission = "checking" | "granted" | "denied";

/**
 * The live classroom: the academy's self-hosted Jitsi room, authorized by the backend's
 * signed join token, rendered by the Jitsi Meet React Native SDK (see JitsiRoom).
 */
export default function LiveClass() {
  const insets = useSafeAreaInsets();
  const session = useRequiredSession();
  const { id, title, name } = useLocalSearchParams<{ id: string; title?: string; name?: string }>();
  const [permission, setPermission] = useState<Permission>(Platform.OS === "web" ? "granted" : "checking");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    void (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      // The class works with the microphone alone; without it the child can only watch.
      setPermission(mic.granted || cam.granted ? "granted" : "denied");
    })();
  }, []);

  const join = useQuery({
    queryKey: ["join", session.token, id],
    queryFn: () => getJitsiJoin(session.token, id),
    enabled: permission !== "checking",
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, animation: "fade_from_bottom" }} />

      {join.data && (
        <LiveLayout join={join.data} token={session.token} displayName={name || session.userName} subject={title || "Class"} onReady={() => setLoaded(true)} />
      )}

      {(!join.data || !loaded) && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          {permission === "denied" ? (
            <Message
              icon="mic-off"
              title="Camera and microphone are off"
              body="Allow Meet to Manage to use the camera and microphone in your phone's settings so your child can take part in the class."
              action={<Button label="Open settings" icon="settings" onPress={() => void Linking.openSettings()} />}
            />
          ) : join.isError ? (
            <Message
              icon="alert-circle"
              title="Can't join this class"
              body={errorMessage(join.error, "This class isn't open for joining right now.")}
              action={<Button label="Try again" icon="refresh-cw" onPress={() => join.refetch()} />}
            />
          ) : (
            <>
              <View style={styles.pulse}><ActivityIndicator size="large" color={brand.orangeFrom} /></View>
              <Text style={styles.title}>{title || "Joining class"}</Text>
              <Text style={styles.body}>Connecting you to the classroom…</Text>
            </>
          )}
        </View>
      )}

      {!loaded && <View style={[styles.topBar, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Leave class" style={styles.leave}>
          <Feather name="phone-off" size={16} color="#FFFFFF" />
          <Text style={styles.leaveText}>Leave</Text>
        </Pressable>
      </View>}
    </View>
  );
}

/**
 * Video on top, the web classroom's Board / Chat / Stars / People panel below, and the
 * quiz and celebration overlays above both. The hub joins the session the backend actually
 * authorized (`join.sessionId`), which differs from the opened one after a reschedule.
 */
function LiveLayout({ join, token, displayName, subject, onReady }: {
  join: ApiJitsiJoin; token: string; displayName: string; subject: string; onReady: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const room = useClassroom(join.sessionId, token, displayName);
  const keyboardH = useKeyboardHeight();
  const [snap, setSnap] = useState<Snap>("peek");
  // Sheet heights: just the tab bar, half the screen, or nearly all of it (a strip of video stays visible).
  const heights: Record<Snap, number> = {
    peek: 84 + insets.bottom,
    half: Math.round(screenH * 0.5),
    full: Math.round(screenH - insets.top - 120),
  };
  const sheetH = useSharedValue(heights.peek);
  useEffect(() => { sheetH.value = withTiming(heights[snap], { duration: 260 }); }, [snap, heights.peek, heights.half, heights.full]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheetStyle = useAnimatedStyle(() => ({ height: sheetH.value }));

  return (
    <View style={styles.live}>
      {/* The call fills the screen; only its own bottom area is covered by the collapsed sheet. */}
      <View style={[styles.video, { paddingTop: insets.top, paddingBottom: heights.peek - 16 }]}>
        <JitsiRoom join={join} displayName={displayName} subject={subject} onReady={onReady} muteRequestAt={room.muteRequestAt} pinnedId={room.pinnedId} />
      </View>
      {snap !== "peek" && <Pressable style={StyleSheet.absoluteFill} onPress={() => setSnap("peek")} accessibilityLabel="Back to video" />}
      {/* Kept above the keyboard so the chat box stays visible while typing: Android resizes the
          window itself (see KeyboardSafe), iOS needs the lift. */}
      <Animated.View style={[styles.sheet, sheetStyle, { bottom: Platform.OS === "ios" ? keyboardH : 0, paddingBottom: keyboardH ? 0 : insets.bottom }]}>
        <ClassroomPanel room={room} displayName={displayName} snap={snap} onSnap={setSnap} />
      </Animated.View>
      <QuizOverlay room={room} />
      <CelebrationOverlay room={room} />
    </View>
  );
}

function Message({ icon, title, body, action }: { icon: "mic-off" | "alert-circle"; title: string; body: string; action: React.ReactNode }) {
  return (
    <View style={styles.message}>
      <View style={styles.messageIcon}><Feather name={icon} size={26} color={brand.orangeFrom} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={{ alignSelf: "stretch", marginTop: space.md }}>{action}</View>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: space.md }}>
        <Text style={[styles.body, { color: brand.orangeTo, fontFamily: fonts.semibold }]}>Back to the app</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF7F0" },
  live: { flex: 1, backgroundColor: "#0B0D11" },
  video: { flex: 1, backgroundColor: "#0B0D11" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0 },
  center: { alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.sm, backgroundColor: "#FFF7F0" },
  pulse: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(247,147,30,0.16)", marginBottom: space.md },
  title: { fontFamily: fonts.bold, fontSize: 20, color: brand.charcoal, textAlign: "center" },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: "#6B7280", textAlign: "center" },
  message: { alignItems: "center", gap: space.sm, maxWidth: 360, width: "100%" },
  messageIcon: { width: 64, height: 64, borderRadius: radius.xl, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(247,147,30,0.16)", marginBottom: space.sm },
  topBar: { position: "absolute", left: space.lg, right: space.lg, flexDirection: "row", justifyContent: "flex-end" },
  leave: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#DC2626", borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  leaveText: { fontFamily: fonts.bold, fontSize: 14, color: "#FFFFFF" },
});
