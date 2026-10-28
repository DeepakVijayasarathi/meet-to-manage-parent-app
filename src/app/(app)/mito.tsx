import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Speech from "expo-speech";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useRef, useState, type ElementRef } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { errorMessage } from "@/api/client";
import { askMito, getMitoProgress, getMitoToday } from "@/api/parent";
import type { MitoChatTurn } from "@/api/types";
import { Screen } from "@/components/ui";
import { elevation, fonts, radius, space, type, useColors, type Colors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";
import { useAppConfig } from "@/state/appConfig";

type MitoMode = "general" | "doubt" | "plan" | "review";

export default function MitoScreen() {
  const colors = useColors();
  const session = useRequiredSession();
  const { config } = useAppConfig();
  const mito = config?.mito;
  const assistantName = mito?.displayName?.trim() || "Mito";
  const { childId, name } = useLocalSearchParams<{ childId: string; name?: string }>();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<MitoMode>("general");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<MitoChatTurn[]>([
    { role: "assistant", text: `Hi${name ? ` ${name.split(" ")[0]}` : ""}! I'm ${assistantName}. ${mito?.welcomeMessage || "Ask me a learning question or let's look at your upcoming classes."}` },
  ]);
  const today = useQuery({ queryKey: ["mito-today", session.token, childId], queryFn: () => getMitoToday(session.token, childId), enabled: !!childId });
  const progress = useQuery({ queryKey: ["mito-progress", session.token, childId], queryFn: () => getMitoProgress(session.token, childId), enabled: !!childId });
  const scroller = useRef<ElementRef<typeof ScrollView>>(null);
  const send = useMutation({
    mutationFn: ({ conversation, requestMode }: { conversation: MitoChatTurn[]; requestMode: MitoMode }) => askMito(session.token, childId, conversation, requestMode),
    onSuccess: (result) => {
      setMessages((current) => [...current, { role: "assistant", text: result.reply }]);
      setSuggestions(result.suggestedPrompts ?? []);
    },
  });

  useEffect(() => () => { Speech.stop(); }, []);
  const speak = (text: string) => {
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, { rate: 0.92, onDone: () => setIsSpeaking(false), onStopped: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
  };
  const submit = (suggestedText?: string, requestMode = mode) => {
    const text = (suggestedText ?? input).trim();
    if (!text || !childId || send.isPending) return;
    const next = [...messages, { role: "user", text } satisfies MitoChatTurn];
    setMessages(next);
    setSuggestions([]);
    setInput("");
    send.mutate({ conversation: next.slice(-20), requestMode });
  };
  const action = (nextMode: MitoMode, prompt: string) => { setMode(nextMode); submit(prompt, nextMode); };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={96}>
        <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { shadowColor: colors.shadow }]}>
          <View style={styles.heroTop}>
            <View style={styles.mascot}><Feather name="zap" size={24} color={colors.primary} /></View>
            <View style={styles.heroText}>
              <View style={styles.onlineRow}><View style={styles.onlineDot} /><Text style={styles.onlineText}>{assistantName.toUpperCase()} IS READY</Text></View>
              <Text style={styles.heroTitle}>Learn smarter with {assistantName}</Text>
              <Text style={styles.heroCaption}>Personal help using your classes and progress</Text>
            </View>
            {mito?.voiceEnabled !== false && <Pressable disabled={!isSpeaking} style={[styles.heroIconButton, !isSpeaking && styles.heroIconDisabled]} onPress={() => { Speech.stop(); setIsSpeaking(false); }} accessibilityLabel="Stop speaking" accessibilityState={{ disabled: !isSpeaking }}><Feather name="volume-x" size={18} color="#FFFFFF" /></Pressable>}
          </View>
          <View style={styles.heroStats}>
            <HeroStat icon="calendar" text={today.isPending ? "Loading today" : today.isError ? "Schedule unavailable" : `${today.data?.items.length ?? 0} classes today`} />
            <View style={styles.heroDivider} />
            <HeroStat icon="trending-up" text={progress.isPending ? "Loading progress" : progress.isError ? "Progress unavailable" : `${progress.data?.classesCompleted ?? 0} completed`} />
          </View>
        </LinearGradient>
        <Text style={[styles.quickLabel, { color: colors.muted }]}>QUICK START</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {mito?.chatEnabled !== false && mito?.doubtModeEnabled !== false && <Action label="Ask a doubt" icon="help-circle" active={mode === "doubt"} disabled={send.isPending} onPress={() => action("doubt", "Help me understand a topic. Ask which topic I need help with.")} colors={colors} />}
          {mito?.chatEnabled !== false && mito?.planModeEnabled !== false && <Action label="Today's plan" icon="calendar" active={mode === "plan"} disabled={send.isPending} onPress={() => action("plan", "Create my study plan for today from my real schedule.")} colors={colors} />}
          {mito?.chatEnabled !== false && mito?.reviewModeEnabled !== false && <Action label="Review a mistake" icon="refresh-cw" active={mode === "review"} disabled={send.isPending} onPress={() => action("review", "Help me review a mistake. Ask me what question I got wrong.")} colors={colors} />}
          {mito?.quizEnabled !== false && <Action label="Practice quiz" icon="award" active={false} disabled={!childId} onPress={() => router.push(`/mito-quiz?childId=${encodeURIComponent(childId)}` as Href)} colors={colors} />}
        </ScrollView>
        <ScrollView ref={scroller} style={[styles.fill, styles.chat]} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
          {messages.map((message, index) => (
            <View key={index} style={[styles.messageRow, message.role === "user" && styles.userRow]}>
              {message.role === "assistant" && <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}><Feather name="zap" size={14} color={colors.primary} /></View>}
              <View style={[styles.bubble, message.role === "user" ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                <Text style={[type.body, { color: message.role === "user" ? "#FFFFFF" : colors.text }]}>{message.text}</Text>
                {message.role === "assistant" && mito?.voiceEnabled !== false && <Pressable style={styles.listenButton} onPress={() => speak(message.text)} accessibilityRole="button" accessibilityLabel={`Read ${assistantName}'s reply aloud`}><Feather name="volume-2" size={14} color={colors.primary} /><Text style={[styles.listenText, { color: colors.primary }]}>Listen</Text></Pressable>}
              </View>
            </View>
          ))}
          {send.isPending && <View style={styles.messageRow}><View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}><Feather name="zap" size={14} color={colors.primary} /></View><View style={[styles.thinking, { backgroundColor: colors.card, borderColor: colors.border }]}><ActivityIndicator size="small" color={colors.primary} /><Text style={[type.caption, { color: colors.muted }]}>Mito is thinking</Text></View></View>}
          {send.isError && <View style={[styles.errorCard, { backgroundColor: colors.dangerSoft }]}><Feather name="alert-circle" size={16} color={colors.danger} /><Text accessibilityRole="alert" style={[type.caption, { color: colors.danger, flex: 1 }]}>{errorMessage(send.error, "Mito couldn't answer. Please try again.")}</Text></View>}
          {suggestions.length > 0 && !send.isPending && <View style={styles.suggestions}>{suggestions.map((item) => <Pressable key={item} onPress={() => submit(item)} style={[styles.suggestion, { borderColor: colors.primary }]}><Text style={[type.caption, { color: colors.primary }]}>{item}</Text></Pressable>)}</View>}
        </ScrollView>
        <View style={styles.composerArea}>
          {mito?.chatEnabled !== false && <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => submit()} placeholder="Ask anything about your learning..." placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text }]} multiline maxLength={2000} editable={!send.isPending} accessibilityLabel="Message Mito" />
            <Pressable onPress={() => submit()} disabled={!input.trim() || send.isPending} style={[styles.sendButton, { backgroundColor: colors.primary, opacity: !input.trim() || send.isPending ? 0.4 : 1 }]} accessibilityLabel="Send message"><Feather name="arrow-up" size={20} color="#FFFFFF" /></Pressable>
          </View>}
          <Text style={[styles.disclaimer, { color: colors.muted }]}>{assistantName} can make mistakes. Check important answers with your teacher.</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Action({ label, icon, active, disabled, onPress, colors }: { label: string; icon: "help-circle" | "calendar" | "refresh-cw" | "award"; active: boolean; disabled: boolean; onPress: () => void; colors: Colors }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border, opacity: disabled ? 0.5 : pressed ? 0.78 : 1 }]}><Feather name={icon} size={15} color={active ? "#FFFFFF" : colors.primary} /><Text style={[type.label, { color: active ? "#FFFFFF" : colors.text }]}>{label}</Text></Pressable>;
}

function HeroStat({ icon, text }: { icon: "calendar" | "trending-up"; text: string }) {
  return <View style={styles.heroStat}><Feather name={icon} size={14} color="#FFFFFF" /><Text style={styles.heroStatText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, hero: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, ...elevation.mid }, heroTop: { flexDirection: "row", alignItems: "center", gap: space.md }, heroText: { flex: 1 },
  mascot: { width: 50, height: 50, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, heroIconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }, heroIconDisabled: { opacity: 0.38 },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 5 }, onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#86EFAC" }, onlineText: { color: "rgba(255,255,255,0.82)", fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.1 }, heroTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.3, marginTop: 2 }, heroCaption: { color: "rgba(255,255,255,0.82)", fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.32)" }, heroStat: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, heroStatText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 11 }, heroDivider: { height: 18, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.35)" },
  quickLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, marginBottom: space.sm }, actions: { gap: space.sm, paddingBottom: space.md }, action: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 10 },
  chat: { marginHorizontal: -space.xs }, thread: { gap: space.md, paddingHorizontal: space.xs, paddingVertical: space.sm }, messageRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm }, userRow: { justifyContent: "flex-end" }, avatar: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 }, bubble: { maxWidth: "84%", borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.md, gap: 7, borderWidth: 1, borderColor: "transparent", ...elevation.low },
  listenButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, paddingTop: 2 }, listenText: { fontFamily: fonts.semibold, fontSize: 11 }, thinking: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md }, errorCard: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.md, padding: space.md },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm }, suggestion: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm },
  composerArea: { paddingTop: space.sm }, composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, borderWidth: 1, borderRadius: radius.xl, padding: 6, ...elevation.low },
  input: { flex: 1, minHeight: 42, maxHeight: 110, paddingHorizontal: space.sm, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15 },
  sendButton: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" }, disclaimer: { fontFamily: fonts.medium, fontSize: 10, textAlign: "center", marginTop: 6 },
});
