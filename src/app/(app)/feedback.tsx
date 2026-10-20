import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getPendingFeedback, submitFeedback } from "@/api/parent";
import { Button, Card, EmptyState, IconTile, Screen, Skeleton } from "@/components/ui";
import { brand, fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** The same rating the web portal's popup asks for after a demo or a completed course. */
export default function Feedback() {
  const colors = useColors();
  const session = useRequiredSession();
  const queryClient = useQueryClient();
  const pending = useQuery({ queryKey: ["feedback", session.token], queryFn: () => getPendingFeedback(session.token) });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const item = pending.data?.[0];

  const submit = useMutation({
    mutationFn: () => submitFeedback(session.token, item!, rating, comment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["feedback", session.token] });
      router.back();
    },
  });

  if (pending.isPending) return <Screen><Skeleton height={120} /><Skeleton height={200} /></Screen>;
  if (!item) return <Screen><Card><EmptyState icon="check-circle" title="Thank you!" description="There's nothing waiting for your feedback right now." /></Card></Screen>;

  const subject = item.kind === "Demo" ? "the demo class" : item.courseName ?? "the course";
  return (
    <Screen>
      <Card style={styles.intro}>
        <IconTile icon={item.kind === "Demo" ? "star" : "award"} tone="warning" size={52} />
        <Text style={[type.heading, { color: colors.text, textAlign: "center" }]}>How was {subject}?</Text>
        <Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>
          Your rating for {item.childName.split(" ")[0]} helps the academy improve every class.
        </Text>
      </Card>

      <Card style={{ gap: space.lg, alignItems: "center" }}>
        <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={`Rating, ${rating} of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}>
              <View style={[styles.star, { backgroundColor: n <= rating ? brand.orange : colors.mutedBg }]}>
                <Feather name="star" size={24} color={n <= rating ? "#FFFFFF" : colors.muted} />
              </View>
            </Pressable>
          ))}
        </View>
        <Text style={[type.label, { color: rating ? colors.primaryInk : colors.muted }]}>{rating ? LABELS[rating] : "Tap a star to rate"}</Text>
        <TextInput
          style={[styles.comment, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
          value={comment}
          onChangeText={setComment}
          placeholder="Anything you'd like to share? (optional)"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          maxLength={1000}
          accessibilityLabel="Comment"
        />
      </Card>

      {submit.isError && <Text style={[type.label, { color: colors.danger }]}>{errorMessage(submit.error)}</Text>}
      <Button label="Submit feedback" icon="send" onPress={() => submit.mutate()} disabled={!rating} loading={submit.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: "center", gap: space.sm, paddingVertical: space.xl },
  stars: { flexDirection: "row", gap: space.sm },
  star: { width: 50, height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  comment: { alignSelf: "stretch", borderWidth: 1, borderRadius: radius.md, padding: space.md, minHeight: 100, fontFamily: fonts.regular, fontSize: 15 },
});
