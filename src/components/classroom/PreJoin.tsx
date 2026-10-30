import Feather from "@expo/vector-icons/Feather";
import { CameraView } from "expo-camera";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { fonts, radius, space, useColors } from "@/lib/theme";

/**
 * "Ready to join?" lobby, like Google Meet's: a live self-view, mic / camera toggles and one
 * clear Join button. The preview is unmounted on join so the classroom gets the camera.
 */
export function PreJoin({ title, subtitle, name, camGranted, micGranted, onJoin, onCancel }: {
  title: string; subtitle?: string; name: string; camGranted: boolean; micGranted: boolean;
  onJoin: (choice: { audioMuted: boolean; videoMuted: boolean }) => void; onCancel: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [micOn, setMicOn] = useState(micGranted);
  const [camOn, setCamOn] = useState(camGranted);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.text }]}>Ready to join?</Text>
        <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>{title}{subtitle ? ` · ${subtitle}` : ""}</Text>
      </View>

      <View style={styles.previewWrap}>
        <View style={styles.preview}>
          {camOn && camGranted ? (
            <CameraView style={StyleSheet.absoluteFill} facing="front" />
          ) : (
            <View style={styles.camOff}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>{initial}</Text></View>
              <Text style={styles.camOffText}>{camGranted ? "Camera is off" : "Camera not allowed"}</Text>
            </View>
          )}
          <View style={styles.nameChip}><Text style={styles.nameText} numberOfLines={1}>{name}</Text></View>
          <View style={styles.toggles}>
            <Toggle on={micOn} disabled={!micGranted} onIcon="mic" offIcon="mic-off" label="Microphone" onPress={() => setMicOn((v) => !v)} />
            <Toggle on={camOn} disabled={!camGranted} onIcon="video" offIcon="video-off" label="Camera" onPress={() => setCamOn((v) => !v)} />
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.muted }]}>
          {!micGranted ? "Microphone is blocked, so you'll join as a viewer." : micOn ? "Your microphone is on." : "Your microphone is off. You can turn it on in the class."}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Join now" icon="video" onPress={() => onJoin({ audioMuted: !micOn, videoMuted: !camOn })} />
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel and go back" style={styles.cancel}>
          <Text style={[styles.cancelText, { color: colors.primaryInk }]}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({ on, disabled, onIcon, offIcon, label, onPress }: {
  on: boolean; disabled: boolean; onIcon: "mic" | "video"; offIcon: "mic-off" | "video-off"; label: string; onPress: () => void;
}) {
  const active = on && !disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${active ? "on, tap to turn off" : "off, tap to turn on"}`}
      style={({ pressed }) => [styles.toggle, { backgroundColor: active ? "rgba(255,255,255,0.22)" : "#EA4335", opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      <Feather name={active ? onIcon : offIcon} size={22} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: space.xl, justifyContent: "space-between" },
  header: { gap: 2 },
  heading: { fontFamily: fonts.bold, fontSize: 26 },
  sub: { fontFamily: fonts.regular, fontSize: 15 },
  previewWrap: { gap: space.md },
  preview: { width: "100%", aspectRatio: 3 / 4, maxHeight: 480, alignSelf: "center", borderRadius: radius.xl, overflow: "hidden", backgroundColor: "#1F2227" },
  camOff: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: space.md },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: 38, color: "#FFFFFF" },
  camOffText: { fontFamily: fonts.medium, fontSize: 14, color: "rgba(255,255,255,0.75)" },
  nameChip: { position: "absolute", left: space.md, top: space.md, maxWidth: "70%", backgroundColor: "rgba(0,0,0,0.45)", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  nameText: { fontFamily: fonts.semibold, fontSize: 13, color: "#FFFFFF" },
  toggles: { position: "absolute", bottom: space.lg, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: space.lg },
  toggle: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  hint: { fontFamily: fonts.regular, fontSize: 13, textAlign: "center" },
  actions: { gap: space.xs },
  cancel: { alignItems: "center", padding: space.md },
  cancelText: { fontFamily: fonts.semibold, fontSize: 15 },
});
