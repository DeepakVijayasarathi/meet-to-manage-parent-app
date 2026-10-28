import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/api/client";
import { answerMitoQuiz, startMitoQuiz } from "@/api/parent";
import type { MitoQuizAnswer } from "@/api/types";
import { Button, Card, EmptyState, Screen, Skeleton } from "@/components/ui";
import { elevation, fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";
import { useAppConfig } from "@/state/appConfig";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function MitoQuizScreen() {
  const colors = useColors();
  const session = useRequiredSession();
  const { config } = useAppConfig();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<MitoQuizAnswer | null>(null);
  const quiz = useQuery({ queryKey: ["mito-quiz", session.token, childId], queryFn: () => startMitoQuiz(session.token, childId, 5), enabled: !!childId && !!config && config.mito?.quizEnabled !== false });
  const answer = useMutation({
    mutationFn: (optionId: string) => answerMitoQuiz(session.token, childId, quiz.data![index].id, optionId),
    onSuccess: (next) => { setResult(next); if (next.correct) setScore((value) => value + 1); },
  });
  const questions = quiz.data ?? [];
  const question = questions[index];
  const choose = (optionId: string) => { if (result || answer.isPending) return; setSelectedId(optionId); answer.mutate(optionId); };
  const next = () => { setResult(null); setSelectedId(null); setIndex((value) => value + 1); answer.reset(); };
  const restart = () => { setIndex(0); setScore(0); setResult(null); setSelectedId(null); answer.reset(); };

  if (config?.mito?.quizEnabled === false) return <Screen title="Practice quiz"><Card><EmptyState icon="lock" title="Practice is not enabled" description="Your academy has not enabled AI practice quizzes." action={<Button label={`Back to ${config.mito.displayName || "Mito"}`} onPress={() => router.back()} />} /></Card></Screen>;
  if (quiz.isPending) return <Screen title="Practice quiz"><Skeleton height={116} /><Skeleton height={280} /></Screen>;
  if (quiz.isError) return <Screen title="Practice quiz"><Card><EmptyState icon="alert-circle" title="Couldn't load practice" description={errorMessage(quiz.error)} action={<Button label="Try again" onPress={() => void quiz.refetch()} />} /></Card></Screen>;
  if (questions.length === 0) return <Screen title="Practice quiz"><Card><EmptyState icon="award" title="No approved questions yet" description="Ask your teacher to add questions to the course quiz bank." action={<Button label="Back to Mito" onPress={() => router.back()} />} /></Card></Screen>;

  if (!question) {
    const percent = Math.round((score / questions.length) * 100);
    const message = percent >= 80 ? "Excellent work!" : percent >= 60 ? "Good progress!" : "Keep practising!";
    return <Screen title="Practice complete">
      <LinearGradient colors={[colors.primary, colors.accent]} style={[styles.resultHero, { shadowColor: colors.shadow }]}>
        <View style={styles.resultIcon}><Feather name={percent >= 60 ? "award" : "refresh-cw"} size={30} color={colors.primary} /></View>
        <Text style={styles.resultEyebrow}>QUIZ COMPLETE</Text><Text style={styles.resultTitle}>{message}</Text>
        <Text style={styles.resultScore}>{score} / {questions.length}</Text><Text style={styles.resultPercent}>{percent}% correct</Text>
      </LinearGradient>
      <Card style={styles.completeCard}>
        <Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>Every question came from the approved institute question bank.</Text>
        <View style={styles.resultActions}><Button label="Back to Mito" variant="secondary" onPress={() => router.back()} /><Button label="Try again" icon="refresh-cw" onPress={restart} /></View>
      </Card>
    </Screen>;
  }

  return <Screen title="Practice quiz" subtitle={`Question ${index + 1} of ${questions.length}`}>
    <View style={styles.progressHeader}>
      <View style={styles.progressCopy}><Text style={[styles.progressLabel, { color: colors.muted }]}>PROGRESS</Text><Text style={[styles.score, { color: colors.text }]}>{score} correct</Text></View>
      <View style={[styles.track, { backgroundColor: colors.mutedBg }]}><View style={[styles.fill, { backgroundColor: colors.primary, width: `${((index + 1) / questions.length) * 100}%` }]} /></View>
    </View>
    <Card style={[styles.questionCard, { shadowColor: colors.shadow }]}>
      <View style={styles.questionMeta}>
        <View style={[styles.questionNumber, { backgroundColor: colors.primarySoft }]}><Text style={[styles.questionNumberText, { color: colors.primary }]}>Q{index + 1}</Text></View>
        {question.courseName && <Text style={[type.overline, { color: colors.primary, flex: 1 }]} numberOfLines={1}>{question.courseName}</Text>}
      </View>
      <Text style={[styles.prompt, { color: colors.text }]}>{question.prompt}</Text>
      <View style={styles.options}>{question.options.map((option, optionIndex) => {
        const isSelected = selectedId === option.id;
        const isCorrect = result?.correctOptionId === option.id;
        const isWrong = !!result && isSelected && !result.correct;
        const dimmed = !!result && !isCorrect && !isWrong;
        const borderColor = isCorrect ? colors.success : isWrong ? colors.danger : isSelected ? colors.primary : colors.border;
        const backgroundColor = isCorrect ? colors.successSoft : isWrong ? colors.dangerSoft : colors.background;
        return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ disabled: !!result || answer.isPending, selected: isSelected }} disabled={!!result || answer.isPending} onPress={() => choose(option.id)} style={({ pressed }) => [styles.option, { borderColor, backgroundColor, opacity: dimmed ? 0.55 : pressed ? 0.82 : 1 }]}>
          <View style={[styles.optionLetter, { backgroundColor: isCorrect ? colors.success : isWrong ? colors.danger : colors.mutedBg }]}><Text style={[styles.optionLetterText, { color: isCorrect || isWrong ? "#FFFFFF" : colors.text }]}>{LETTERS[optionIndex] ?? optionIndex + 1}</Text></View>
          <Text style={[type.body, { color: isCorrect ? colors.success : isWrong ? colors.danger : colors.text, flex: 1 }]}>{option.text}</Text>
          {answer.isPending && isSelected ? <ActivityIndicator size="small" color={colors.primary} /> : isCorrect ? <Feather name="check-circle" size={20} color={colors.success} /> : isWrong ? <Feather name="x-circle" size={20} color={colors.danger} /> : null}
        </Pressable>;
      })}</View>
      {answer.isError && <View style={[styles.inlineError, { backgroundColor: colors.dangerSoft }]}><Feather name="alert-circle" size={16} color={colors.danger} /><Text style={[type.caption, { color: colors.danger, flex: 1 }]}>{errorMessage(answer.error)}</Text><Pressable onPress={() => selectedId && answer.mutate(selectedId)}><Text style={[type.label, { color: colors.danger }]}>Retry</Text></Pressable></View>}
      {result && <View style={[styles.feedback, { backgroundColor: result.correct ? colors.successSoft : colors.warningSoft }]}>
        <View style={styles.feedbackTitle}><Feather name={result.correct ? "check-circle" : "book-open"} size={18} color={result.correct ? colors.success : colors.warningText} /><Text style={[type.heading, { color: result.correct ? colors.success : colors.warningText }]}>{result.correct ? "Correct!" : "Let's learn this one"}</Text></View>
        <Text style={[type.body, { color: colors.text }]}>{result.feedback}</Text>
        <Button label={index + 1 === questions.length ? "See my results" : "Next question"} icon="arrow-right" onPress={next} />
      </View>}
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  progressHeader: { gap: space.sm, marginBottom: space.sm }, progressCopy: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, progressLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2 }, score: { fontFamily: fonts.semibold, fontSize: 12 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" }, fill: { height: "100%", borderRadius: 4 },
  questionCard: { ...elevation.low }, questionMeta: { flexDirection: "row", alignItems: "center", gap: space.sm }, questionNumber: { minWidth: 38, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" }, questionNumberText: { fontFamily: fonts.bold, fontSize: 12 }, prompt: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 28, letterSpacing: -0.35, marginTop: space.lg },
  options: { gap: space.md, marginTop: space.xl }, option: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm }, optionLetter: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" }, optionLetterText: { fontFamily: fonts.bold, fontSize: 12 },
  inlineError: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.md, padding: space.md, marginTop: space.md }, feedback: { marginTop: space.lg, borderRadius: radius.md, padding: space.lg, gap: space.md }, feedbackTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  resultHero: { alignItems: "center", borderRadius: radius.lg, padding: space.xxl, gap: space.sm, ...elevation.mid }, resultIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: space.sm }, resultEyebrow: { color: "rgba(255,255,255,0.78)", fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.4 }, resultTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 24 }, resultScore: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 38, marginTop: space.xs }, resultPercent: { color: "rgba(255,255,255,0.86)", fontFamily: fonts.semibold, fontSize: 13 },
  completeCard: { alignItems: "center", gap: space.lg }, resultActions: { width: "100%", gap: space.sm },
});
