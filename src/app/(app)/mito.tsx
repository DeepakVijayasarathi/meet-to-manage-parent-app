import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Speech from "expo-speech";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useRef, useState, type ElementRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";
import { askMito, getMitoProgress, getMitoToday } from "@/api/parent";
import type { MitoChatTurn } from "@/api/types";
import { KeyboardSafe, useKeyboardVisible } from "@/components/keyboard";
import { Screen } from "@/components/ui";
import { elevation, fonts, radius, space, type, useColors, type Colors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";
import { useAppConfig } from "@/state/appConfig";

type MitoMode = "general" | "doubt" | "plan" | "review";

export default function MitoScreen() {
  const colors = useColors();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const compact = height < 700;
  const session = useRequiredSession();
  const { config } = useAppConfig();
  const mito = config?.mito;
  const assistantName = mito?.displayName?.trim() || "Mito";
  const { childId, name } = useLocalSearchParams<{ childId: string; name?: string }>();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<MitoMode>("general");
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<MitoChatTurn[]>([]);
  const greeting: MitoChatTurn = { role: "assistant", text: `Hi${name ? ` ${name.split(" ")[0]}` : ""}! I'm ${assistantName}. ${mito?.welcomeMessage || "Ask me a learning question or let's look at your upcoming classes."}` };
  const conversation = messages.length > 0 ? messages : [greeting];
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
  const speak = (text: string, index: number) => {
    Speech.stop();
    setSpeakingIndex(index);
    Speech.speak(text, { rate: 0.92, onDone: () => setSpeakingIndex(null), onStopped: () => setSpeakingIndex(null), onError: () => setSpeakingIndex(null) });
  };
  const submit = (suggestedText?: string, requestMode = mode) => {
    const text = (suggestedText ?? input).trim();
    if (!text || !childId || send.isPending) return;
    const next = [...conversation, { role: "user", text } satisfies MitoChatTurn];
    setMessages(next);
    setSuggestions([]);
    setInput("");
    send.mutate({ conversation: next.slice(-20), requestMode });
  };
  const action = (nextMode: MitoMode, prompt: string) => { setMode(nextMode); submit(prompt, nextMode); };
  const newChat = () => {
    Speech.stop();
    setSpeakingIndex(null);
    setMessages([]);
    setSuggestions([]);
    setInput("");
    setMode("general");
    send.reset();
  };
  const shareReply = (text: string) => { void Share.share({ title: `${assistantName} learning answer`, message: text }); };

  return (
    <Screen scroll={false}>
      <KeyboardSafe style={styles.fill}>
        {!keyboardVisible && <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, compact && styles.heroCompact, { shadowColor: colors.shadow }]}>
          <View style={styles.heroTop}>
            <View style={styles.mascot}><Feather name="zap" size={24} color={colors.primary} /></View>
            <View style={styles.heroText}>
              <View style={styles.onlineRow}><View style={styles.onlineDot} /><Text style={styles.onlineText}>{assistantName.toUpperCase()} IS READY</Text></View>
              <Text style={styles.heroTitle}>Learn smarter with {assistantName}</Text>
              {!compact && <Text style={styles.heroCaption}>Personal help using your classes and progress</Text>}
            </View>
            <View style={styles.heroControls}>
              {conversation.length > 1 && <Pressable style={styles.heroIconButton} onPress={newChat} accessibilityRole="button" accessibilityLabel="Start a new chat"><Feather name="edit" size={17} color="#FFFFFF" /></Pressable>}
              {mito?.voiceEnabled !== false && speakingIndex !== null && <Pressable style={styles.heroIconButton} onPress={() => { Speech.stop(); setSpeakingIndex(null); }} accessibilityRole="button" accessibilityLabel="Stop speaking"><Feather name="volume-x" size={18} color="#FFFFFF" /></Pressable>}
            </View>
          </View>
          <View style={[styles.heroStats, compact && styles.heroStatsCompact]}>
            <HeroStat icon="calendar" text={today.isPending ? "Loading today" : today.isError ? "Schedule unavailable" : `${today.data?.items.length ?? 0} classes today`} />
            <View style={styles.heroDivider} />
            <HeroStat icon="trending-up" text={progress.isPending ? "Loading progress" : progress.isError ? "Progress unavailable" : `${progress.data?.classesCompleted ?? 0} completed`} />
          </View>
        </LinearGradient>}
        {!keyboardVisible && <Text style={[styles.quickLabel, compact && styles.quickLabelCompact, { color: colors.muted }]}>QUICK START</Text>}
        {!keyboardVisible && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions} keyboardShouldPersistTaps="handled">
          {mito?.chatEnabled !== false && mito?.doubtModeEnabled !== false && <Action label="Ask a doubt" icon="help-circle" active={mode === "doubt"} disabled={send.isPending} onPress={() => action("doubt", "Help me understand a topic. Ask which topic I need help with.")} colors={colors} />}
          {mito?.chatEnabled !== false && mito?.planModeEnabled !== false && <Action label="Today's plan" icon="calendar" active={mode === "plan"} disabled={send.isPending} onPress={() => action("plan", "Create my study plan for today from my real schedule.")} colors={colors} />}
          {mito?.chatEnabled !== false && mito?.reviewModeEnabled !== false && <Action label="Review a mistake" icon="refresh-cw" active={mode === "review"} disabled={send.isPending} onPress={() => action("review", "Help me review a mistake. Ask me what question I got wrong.")} colors={colors} />}
          {mito?.quizEnabled !== false && <Action label="Practice quiz" icon="award" active={false} disabled={!childId} onPress={() => router.push(`/mito-quiz?childId=${encodeURIComponent(childId)}` as Href)} colors={colors} />}
        </ScrollView>}
        <ScrollView ref={scroller} style={[styles.fill, styles.chat]} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
          {conversation.map((message, index) => (
            <View key={index} style={[styles.messageRow, message.role === "user" && styles.userRow]}>
              {message.role === "assistant" && <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}><Feather name="zap" size={14} color={colors.primary} /></View>}
              <View style={[styles.bubble, message.role === "user" ? [styles.userBubble, { backgroundColor: colors.primary }] : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]]}>
                <Text style={[type.body, { color: message.role === "user" ? "#FFFFFF" : colors.text }]}>{message.text}</Text>
                {message.role === "assistant" && <View style={styles.replyActions}>
                  {mito?.voiceEnabled !== false && <Pressable style={[styles.listenButton, speakingIndex === index && { backgroundColor: colors.primarySoft }]} onPress={() => speakingIndex === index ? (Speech.stop(), setSpeakingIndex(null)) : speak(message.text, index)} accessibilityRole="button" accessibilityLabel={speakingIndex === index ? "Stop reading reply" : `Read ${assistantName}'s reply aloud`}><Feather name={speakingIndex === index ? "square" : "volume-2"} size={13} color={colors.primary} /><Text style={[styles.listenText, { color: colors.primary }]}>{speakingIndex === index ? "Stop" : "Listen"}</Text></Pressable>}
                  <Pressable style={styles.listenButton} onPress={() => shareReply(message.text)} accessibilityRole="button" accessibilityLabel="Share this answer"><Feather name="share-2" size={13} color={colors.primary} /><Text style={[styles.listenText, { color: colors.primary }]}>Share</Text></Pressable>
                </View>}
              </View>
            </View>
          ))}
          {send.isPending && <View style={styles.messageRow}><View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}><Feather name="zap" size={14} color={colors.primary} /></View><View style={[styles.thinking, { backgroundColor: colors.card, borderColor: colors.border }]}><ActivityIndicator size="small" color={colors.primary} /><Text style={[type.caption, { color: colors.muted }]}>{assistantName} is thinking</Text></View></View>}
          {send.isError && <View style={[styles.errorCard, { backgroundColor: colors.dangerSoft }]}><Feather name="alert-circle" size={16} color={colors.danger} /><Text accessibilityRole="alert" style={[type.caption, { color: colors.danger, flex: 1 }]}>{errorMessage(send.error, `${assistantName} couldn't answer. Please try again.`)}</Text>{send.variables && <Pressable accessibilityRole="button" onPress={() => send.mutate(send.variables!)}><Text style={[type.label, { color: colors.danger }]}>Retry</Text></Pressable>}</View>}
          {suggestions.length > 0 && !send.isPending && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions} keyboardShouldPersistTaps="handled">{suggestions.map((item) => <Pressable key={item} onPress={() => submit(item)} style={({ pressed }) => [styles.suggestion, { backgroundColor: colors.primarySoft, opacity: pressed ? 0.75 : 1 }]}><Feather name="arrow-up-right" size={13} color={colors.primary} /><Text numberOfLines={2} style={[type.caption, styles.suggestionText, { color: colors.primary }]}>{item}</Text></Pressable>)}</ScrollView>}
        </ScrollView>
        <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 6) }]}>
          {mito?.chatEnabled !== false && <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => submit()} placeholder="Ask anything about your learning..." placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text }]} multiline maxLength={2000} editable={!send.isPending} accessibilityLabel="Message Mito" />
            <Pressable onPress={() => submit()} disabled={!input.trim() || send.isPending} style={[styles.sendButton, { backgroundColor: colors.primary, opacity: !input.trim() || send.isPending ? 0.4 : 1 }]} accessibilityRole="button" accessibilityState={{ disabled: !input.trim() || send.isPending }} accessibilityLabel="Send message"><Feather name="arrow-up" size={20} color="#FFFFFF" /></Pressable>
          </View>}
          {!keyboardVisible && <Text style={[styles.disclaimer, { color: colors.muted }]}>{assistantName} can make mistakes. Check important answers with your teacher.</Text>}
        </View>
      </KeyboardSafe>
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
  fill: { flex: 1, minHeight: 0 }, hero: { flexShrink: 0, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, ...elevation.mid }, heroCompact: { paddingVertical: space.md }, heroTop: { flexDirection: "row", alignItems: "center", gap: space.md }, heroText: { flex: 1 },
  mascot: { width: 50, height: 50, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, heroControls: { flexDirection: "row", gap: 6 }, heroIconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 5 }, onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#86EFAC" }, onlineText: { color: "rgba(255,255,255,0.82)", fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.1 }, heroTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.3, marginTop: 2 }, heroCaption: { color: "rgba(255,255,255,0.82)", fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.32)" }, heroStatsCompact: { marginTop: space.md, paddingTop: space.sm }, heroStat: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, heroStatText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 11 }, heroDivider: { height: 18, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.35)" },
  quickLabel: { flexShrink: 0, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, marginBottom: space.sm }, quickLabelCompact: { marginBottom: space.xs }, actions: { gap: space.sm, paddingBottom: space.md }, action: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 10 },
  chat: { marginHorizontal: -space.xs }, thread: { flexGrow: 1, justifyContent: "flex-end", gap: space.md, paddingHorizontal: space.xs, paddingTop: space.sm, paddingBottom: space.md }, messageRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm }, userRow: { justifyContent: "flex-end" }, avatar: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 2 }, bubble: { maxWidth: "84%", borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 11, gap: 7, borderWidth: 1, borderColor: "transparent", ...elevation.low }, assistantBubble: { borderBottomLeftRadius: 7 }, userBubble: { borderBottomRightRadius: 7 },
  replyActions: { flexDirection: "row", alignItems: "center", gap: 2 }, listenButton: { minHeight: 30, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, borderRadius: radius.pill, paddingHorizontal: 8, marginLeft: -8 }, listenText: { fontFamily: fonts.semibold, fontSize: 11 }, thinking: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md }, errorCard: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.md, padding: space.md },
  suggestions: { gap: space.sm, paddingRight: space.sm }, suggestion: { maxWidth: 230, minHeight: 42, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm }, suggestionText: { flexShrink: 1 },
  composerArea: { flexShrink: 0, paddingTop: space.sm }, composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, borderWidth: 1, borderRadius: radius.xl, padding: 6, ...elevation.low },
  input: { flex: 1, minHeight: 42, maxHeight: 110, paddingHorizontal: space.sm, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15 },
  sendButton: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" }, disclaimer: { fontFamily: fonts.medium, fontSize: 10, textAlign: "center", marginTop: 6 },
});
