import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/api/client";
import { answerMitoQuiz, startMitoQuiz } from "@/api/parent";
import type { MitoQuizAnswer } from "@/api/types";
import { Button, Card, EmptyState, Screen, Skeleton } from "@/components/ui";
import { radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

export default function MitoQuizScreen() {
  const colors = useColors();
  const session = useRequiredSession();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<MitoQuizAnswer | null>(null);
  const quiz = useQuery({ queryKey: ["mito-quiz", session.token, childId], queryFn: () => startMitoQuiz(session.token, childId, 5), enabled: !!childId });
  const answer = useMutation({
    mutationFn: (optionId: string) => answerMitoQuiz(session.token, childId, quiz.data![index].id, optionId),
    onSuccess: (next) => { setResult(next); if (next.correct) setScore((value) => value + 1); },
  });
  const questions = quiz.data ?? [];
  const question = questions[index];
  const next = () => { setResult(null); setIndex((value) => value + 1); answer.reset(); };

  if (quiz.isPending) return <Screen title="Practice quiz"><Skeleton height={280} /></Screen>;
  if (quiz.isError) return <Screen title="Practice quiz"><Card><EmptyState icon="alert-circle" title="Couldn't load practice" description={errorMessage(quiz.error)} action={<Button label="Try again" onPress={() => void quiz.refetch()} />} /></Card></Screen>;
  if (questions.length === 0) return <Screen title="Practice quiz"><Card><EmptyState icon="award" title="No approved questions yet" description="Ask your teacher to add questions to the course quiz bank." action={<Button label="Back to Mito" onPress={() => router.back()} />} /></Card></Screen>;
  if (!question) return <Screen title="Practice complete"><Card style={styles.complete}><Feather name="award" size={48} color={colors.primary} /><Text style={[type.title, { color: colors.text }]}>{score} / {questions.length}</Text><Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>Every question came from the approved institute bank.</Text><Button label="Back to Mito" onPress={() => router.back()} /></Card></Screen>;

  return <Screen title="Practice quiz" subtitle={`Question ${index + 1} of ${questions.length} · Score ${score}`}>
    <View style={[styles.track, { backgroundColor: colors.mutedBg }]}><View style={[styles.fill, { backgroundColor: colors.primary, width: `${((index + 1) / questions.length) * 100}%` }]} /></View>
    <Card>
      {question.courseName && <Text style={[type.overline, { color: colors.primary }]}>{question.courseName}</Text>}
      <Text style={[type.title, { color: colors.text, marginTop: space.sm }]}>{question.prompt}</Text>
      <View style={styles.options}>{question.options.map((option) => {
        const correct = result?.correctOptionId === option.id;
        return <Pressable key={option.id} disabled={!!result || answer.isPending} onPress={() => answer.mutate(option.id)} style={[styles.option, { borderColor: correct ? colors.success : colors.border, backgroundColor: correct ? colors.successSoft : colors.background, opacity: result && !correct ? 0.55 : 1 }]}><Text style={[type.body, { color: correct ? colors.success : colors.text, flex: 1 }]}>{option.text}</Text>{correct && <Feather name="check-circle" size={18} color={colors.success} />}</Pressable>;
      })}</View>
      {answer.isError && <Text style={[type.caption, { color: colors.danger, marginTop: space.md }]}>{errorMessage(answer.error)}</Text>}
      {result && <View style={[styles.feedback, { backgroundColor: result.correct ? colors.successSoft : colors.warningSoft }]}><Text style={[type.body, { color: result.correct ? colors.success : colors.text }]}>{result.feedback}</Text><Button label={index + 1 === questions.length ? "See results" : "Next question"} onPress={next} /></View>}
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  track: { height: 7, borderRadius: 4, overflow: "hidden" }, fill: { height: "100%", borderRadius: 4 },
  options: { gap: space.sm, marginTop: space.lg }, option: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  feedback: { marginTop: space.lg, borderRadius: radius.md, padding: space.md, gap: space.md },
  complete: { alignItems: "center", gap: space.md, paddingVertical: space.xxl },
});
