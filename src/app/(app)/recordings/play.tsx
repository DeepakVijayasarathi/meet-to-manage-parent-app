import { Stack, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, Text, View } from "react-native";

import { Card, EmptyState } from "@/components/ui";
import { space, type, useColors } from "@/lib/theme";

export default function PlayRecording() {
  const colors = useColors();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const player = useVideoPlayer(url ?? null, (p) => { p.play(); });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: title ?? "Recording" }} />
      {url ? (
        <>
          <VideoView player={player} style={styles.video} nativeControls fullscreenOptions={{ enable: true }} allowsPictureInPicture contentFit="contain" />
          <Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>Rotate your phone or use full screen for a larger view.</Text>
        </>
      ) : (
        <Card><EmptyState icon="video-off" title="Recording unavailable" description="This recording can no longer be played." /></Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.lg, gap: space.md },
  video: { width: "100%", aspectRatio: 16 / 9, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" },
});
