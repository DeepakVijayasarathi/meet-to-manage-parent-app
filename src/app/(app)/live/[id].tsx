import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { Camera } from "expo-camera";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";
import { getJitsiJoin } from "@/api/parent";
import type { ApiJitsiJoin } from "@/api/types";
import { CelebrationOverlay, ClassroomPanel, QuizOverlay, type Snap } from "@/components/classroom/ClassroomPanel";
import { PreJoin } from "@/components/classroom/PreJoin";
import { JitsiRoom } from "@/components/JitsiRoom";
import { useKeyboardHeight } from "@/components/keyboard";
import { useClassroom } from "@/lib/useClassroom";
import { useNow } from "@/lib/useNow";
import { Button } from "@/components/ui";
import { fonts, radius, space, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

type Permission = "checking" | "granted" | "denied";

/**
 * The live classroom: the academy's self-hosted Jitsi room, authorized by the backend's
 * signed join token, rendered by the Jitsi Meet React Native SDK (see JitsiRoom).
 */
export default function LiveClass() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const session = useRequiredSession();
  const { id, title, name } = useLocalSearchParams<{ id: string; title?: string; name?: string }>();
  const [permission, setPermission] = useState<Permission>(Platform.OS === "web" ? "granted" : "checking");
  const [granted, setGranted] = useState({ cam: Platform.OS === "web", mic: Platform.OS === "web" });
  const [choice, setChoice] = useState<{ audioMuted: boolean; videoMuted: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const displayName = name || session.userName;

  useEffect(() => {
    if (Platform.OS === "web") return;
    void (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      setGranted({ cam: cam.granted, mic: mic.granted });
      // The class works with the microphone alone; without it the child can only watch.
      setPermission(mic.granted || cam.granted ? "granted" : "denied");
    })();
  }, []);

  // Confirm before leaving: the Android back button shouldn't drop a child out of the class by accident.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!choice) return false;
      confirmLeave();
      return true;
    });
    return () => sub.remove();
  }, [choice]);

  // Joining (and fetching the short-lived join token) waits for "Join now" on the lobby.
  const join = useQuery({
    queryKey: ["join", session.token, id],
    queryFn: () => getJitsiJoin(session.token, id),
    enabled: !!choice,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, animation: "fade_from_bottom" }} />

      {permission === "granted" && !choice && (
        <View style={StyleSheet.absoluteFill}>
          <PreJoin title={title || "Class"} name={displayName} camGranted={granted.cam} micGranted={granted.mic} onJoin={setChoice} onCancel={() => router.back()} />
        </View>
      )}

      {join.data && (
        <LiveLayout join={join.data} token={session.token} displayName={displayName} subject={title || "Class"} audioMuted={choice?.audioMuted} videoMuted={choice?.videoMuted} onReady={() => setLoaded(true)} />
      )}

      {(permission !== "granted" || !!choice) && (!join.data || !loaded) && (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]}>
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
              <View style={[styles.pulse, { backgroundColor: colors.primarySoft }]}><ActivityIndicator size="large" color={colors.primary} /></View>
              <Text style={[styles.title, { color: colors.text }]}>{title || "Joining class"}</Text>
              <Text style={[styles.body, { color: colors.muted }]}>Connecting you to the classroom…</Text>
            </>
          )}
        </View>
      )}

      {!loaded && (permission !== "granted" || !!choice) && <View style={[styles.topBar, { top: insets.top + space.sm }]} pointerEvents="box-none">
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
function LiveLayout({ join, token, displayName, subject, audioMuted, videoMuted, onReady }: {
  join: ApiJitsiJoin; token: string; displayName: string; subject: string; audioMuted?: boolean; videoMuted?: boolean; onReady: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [startedAt] = useState(() => Date.now());
  const now = useNow(1000);
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
      <View style={[styles.video, { paddingTop: insets.top + 48, paddingBottom: heights.peek - 16 }]}>
        <JitsiRoom join={join} displayName={displayName} subject={subject} onReady={onReady} muteRequestAt={room.muteRequestAt} pinnedId={room.pinnedId} audioMuted={audioMuted} videoMuted={videoMuted} />
      </View>
      {/* Meet-style header: class name and how long you've been in, with a clearly labelled Leave. */}
      <View style={[styles.callBar, { top: insets.top }]} pointerEvents="box-none">
        <View style={styles.callInfo}>
          <Text style={styles.callTitle} numberOfLines={1}>{subject}</Text>
          <Text style={styles.callTime}>{elapsed(now.getTime() - startedAt)}</Text>
        </View>
        <Pressable onPress={confirmLeave} accessibilityRole="button" accessibilityLabel="Leave class" style={styles.leave}>
          <Feather name="phone-off" size={16} color="#FFFFFF" />
          <Text style={styles.leaveText}>Leave</Text>
        </Pressable>
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

function confirmLeave() {
  Alert.alert("Leave class?", "You can rejoin while the class is still open.", [
    { text: "Stay", style: "cancel" },
    { text: "Leave", style: "destructive", onPress: () => router.back() },
  ]);
}

/** "4:07" or "1:02:09". */
function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function Message({ icon, title, body, action }: { icon: "mic-off" | "alert-circle"; title: string; body: string; action: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.message}>
      <View style={[styles.messageIcon, { backgroundColor: colors.primarySoft }]}><Feather name={icon} size={26} color={colors.primary} /></View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
      <View style={{ alignSelf: "stretch", marginTop: space.md }}>{action}</View>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to the app" style={{ padding: space.md }}>
        <Text style={[styles.body, { color: colors.primaryInk, fontFamily: fonts.semibold }]}>Back to the app</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  live: { flex: 1, backgroundColor: "#0B0D11" },
  video: { flex: 1, backgroundColor: "#0B0D11" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0 },
  center: { alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.sm },
  pulse: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", marginBottom: space.md },
  title: { fontFamily: fonts.bold, fontSize: 20, textAlign: "center" },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, textAlign: "center" },
  message: { alignItems: "center", gap: space.sm, maxWidth: 360, width: "100%" },
  messageIcon: { width: 64, height: 64, borderRadius: radius.xl, alignItems: "center", justifyContent: "center", marginBottom: space.sm },
  topBar: { position: "absolute", left: space.lg, right: space.lg, flexDirection: "row", justifyContent: "flex-end" },
  callBar: { position: "absolute", left: space.lg, right: space.lg, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  callInfo: { flex: 1 },
  callTitle: { fontFamily: fonts.semibold, fontSize: 15, color: "#FFFFFF" },
  callTime: { fontFamily: fonts.regular, fontSize: 12, color: "rgba(255,255,255,0.7)" },
  leave: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#DC2626", borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  leaveText: { fontFamily: fonts.bold, fontSize: 14, color: "#FFFFFF" },
});
