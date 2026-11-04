import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getHomework, submitHomework } from "@/api/parent";
import { Badge, Button, Card, EmptyState, ErrorCard, Screen, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { captureError } from "@/lib/telemetry";
import { fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

type Picked = { uri: string; name: string; mimeType: string };

export default function HomeworkDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const session = useRequiredSession();
  const queryClient = useQueryClient();
  const key = ["homework", session.token];
  const work = useQuery({ queryKey: key, queryFn: () => getHomework(session.token) });
  const item = work.data?.find((a) => a.submissionId === id);
  const [answer, setAnswer] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Picked | null>(null);

  const submit = useMutation({
    mutationFn: () => submitHomework(session.token, id, answer ?? item?.answerText ?? "", photo),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      setPhoto(null);
      Alert.alert("Handed in", "The teacher can now check it.");
      router.back();
    },
  });

  const pick = async (source: "camera" | "library") => {
    try {
      const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", source === "camera" ? "Allow camera access in Settings to photograph the work." : "Allow photo access in Settings to attach the work.");
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > 15 * 1024 * 1024) {
        Alert.alert("Photo too large", "Please choose a photo under 15 MB.");
        return;
      }
      const mimeType = asset.mimeType ?? "image/jpeg";
      setPhoto({ uri: asset.uri, mimeType, name: asset.fileName ?? `homework.${mimeType.split("/")[1] ?? "jpg"}` });
    } catch (error) {
      captureError(error, "homework_photo");
      Alert.alert("Couldn't open the camera", "Please try again.");
    }
  };

  if (work.isPending) return <Screen><Skeleton height={160} /></Screen>;
  if (work.isError) return <Screen><ErrorCard message={errorMessage(work.error)} onRetry={() => work.refetch()} /></Screen>;
  if (!item) return <Screen><Card><EmptyState icon="edit-3" title="Not found" description="This homework may have been removed by the teacher." /></Card></Screen>;

  const text = answer ?? item.answerText ?? "";
  const hasResult = item.marks != null || !!item.feedback || item.status === "Excused";

  return (
    <Screen>
      <Stack.Screen options={{ title: item.kind === "Test" ? "Test" : "Homework" }} />
      <Card>
        <View style={styles.badges}>
          <Badge label={item.kind} tone={item.kind === "Test" ? "info" : "brand"} />
          {item.isOverdue && <Badge label="Overdue" tone="danger" />}
          {item.status === "Submitted" && <Badge label="Handed in" tone="success" />}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Text style={[type.caption, { color: colors.muted }]}>
          {item.childName} · {item.batchName}{item.teacherName ? ` · ${item.teacherName}` : ""}
        </Text>
        {item.dueAtUtc && <Text style={[type.label, { color: item.isOverdue ? colors.danger : colors.textSoft, marginTop: space.sm }]}>Due {formatDate(item.dueAtUtc, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>}
        {item.instructions && <Text style={[styles.body, { color: colors.text }]}>{item.instructions}</Text>}
        {item.attachmentFileName && (
          <Button
            label="Open worksheet"
            icon="file-text"
            variant="secondary"
            style={{ marginTop: space.md }}
            onPress={() => router.push({ pathname: "/portal", params: { path: "/parent/homework", title: "Homework" } })}
          />
        )}
      </Card>

      {hasResult && (
        <Card>
          <Text style={[type.label, { color: colors.textSoft }]}>Result</Text>
          {item.status === "Excused" ? <Text style={[styles.body, { color: colors.text }]}>Excused</Text>
            : item.marks != null && <Text style={[styles.marks, { color: colors.text }]}>{item.marks}{item.maxMarks ? ` / ${item.maxMarks}` : ""}</Text>}
          {item.classAverage != null && <Text style={[type.caption, { color: colors.muted }]}>Class average {item.classAverage}</Text>}
          {item.feedback && <Text style={[styles.body, { color: colors.text }]}>“{item.feedback}”</Text>}
        </Card>
      )}

      {item.kind === "Test" && !item.resultsReleased && (
        <Card><Text style={[type.caption, { color: colors.muted }]}>Marks appear here once the teacher shares the results.</Text></Card>
      )}

      {item.canSubmit && (
        <Card>
          <Text style={[type.label, { color: colors.textSoft }]}>{item.status === "Submitted" ? "Update your work" : "Hand in"}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={text}
            onChangeText={setAnswer}
            placeholder="Type an answer (optional if you attach a photo)"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            maxLength={4000}
            accessibilityLabel="Answer"
          />
          {photo ? (
            <View style={styles.preview}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" accessibilityLabel="Attached photo" />
              <Button label="Remove photo" icon="x" variant="ghost" size="sm" onPress={() => setPhoto(null)} />
            </View>
          ) : (
            <View style={styles.row}>
              <Button label="Take photo" icon="camera" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => void pick("camera")} />
              <Button label="Choose photo" icon="image" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => void pick("library")} />
            </View>
          )}
          {item.submissionFileName && !photo && <Text style={[type.caption, { color: colors.muted }]}>Already attached: {item.submissionFileName}</Text>}
          {submit.isError && <Text style={[type.label, { color: colors.danger }]}>{errorMessage(submit.error)}</Text>}
          <Button
            label={item.status === "Submitted" ? "Update" : "Hand in"}
            icon="send"
            onPress={() => submit.mutate()}
            loading={submit.isPending}
            disabled={!text.trim() && !photo && !item.submissionFileName}
          />
        </Card>
      )}

      {item.submittedAtUtc && <Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>Handed in {formatDate(item.submittedAtUtc, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: "row", gap: space.sm, marginBottom: space.sm, flexWrap: "wrap" },
  title: { fontFamily: fonts.bold, fontSize: 20, marginBottom: 4 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: space.md },
  marks: { fontFamily: fonts.bold, fontSize: 28, marginTop: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, padding: space.md, minHeight: 110, fontFamily: fonts.regular, fontSize: 15, marginVertical: space.md },
  row: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  preview: { alignItems: "flex-start", gap: space.sm, marginBottom: space.md },
  thumb: { width: 140, height: 140, borderRadius: radius.md },
});
