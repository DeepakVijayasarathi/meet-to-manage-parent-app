import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Speech from "expo-speech";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useRef, useState, type ElementRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { errorMessage } from "@/api/client";
import { askMito, getMitoProgress, getMitoToday } from "@/api/parent";
import type { MitoChatTurn } from "@/api/types";
import { Screen } from "@/components/ui";
import { fonts, radius, space, type, useColors, type Colors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

type MitoMode = "general" | "doubt" | "plan" | "review";

export default function MitoScreen() {
  const colors = useColors();
  const session = useRequiredSession();
  const { childId, name } = useLocalSearchParams<{ childId: string; name?: string }>();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<MitoMode>("general");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<MitoChatTurn[]>([
    { role: "assistant", text: `Hi${name ? ` ${name.split(" ")[0]}` : ""}! I'm Mito. Ask me a learning question or let's look at your upcoming classes.` },
  ]);
  const today = useQuery({ queryKey: ["mito-today", session.token, childId], queryFn: () => getMitoToday(session.token, childId), enabled: !!childId });
  const progress = useQuery({ queryKey: ["mito-progress", session.token, childId], queryFn: () => getMitoProgress(session.token, childId), enabled: !!childId });
  const scroller = useRef<ElementRef<typeof ScrollView>>(null);
  const send = useMutation({
    mutationFn: ({ conversation, requestMode }: { conversation: MitoChatTurn[]; requestMode: MitoMode }) => askMito(session.token, childId, conversation, requestMode),
    onSuccess: (result) => {
      setMessages((current) => [...current, { role: "assistant", text: result.reply }]);
      setSuggestions(result.suggestedPrompts ?? []);
      Speech.stop();
      Speech.speak(result.reply, { rate: 0.92 });
    },
  });

  useEffect(() => () => { Speech.stop(); }, []);
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
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={96}>
        <View style={styles.hero}>
          <View style={[styles.robot, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
            <View style={[styles.eye, { backgroundColor: colors.primary }]} /><View style={[styles.eye, { backgroundColor: colors.primary }]} />
            <View style={[styles.smile, { borderColor: colors.primary }]} />
          </View>
          <View style={styles.heroText}><Text style={[type.heading, { color: colors.text }]}>Your AI learning companion</Text><Text style={[type.caption, { color: colors.muted }]}>Grounded in your authorized learning context</Text></View>
          <Pressable onPress={() => Speech.stop()} accessibilityLabel="Stop speaking"><Feather name="volume-x" size={20} color={colors.muted} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          <Action label="Ask a doubt" icon="help-circle" active={mode === "doubt"} onPress={() => action("doubt", "Help me understand a topic. Ask which topic I need help with.")} colors={colors} />
          <Action label="Today's plan" icon="calendar" active={mode === "plan"} onPress={() => action("plan", "Create my study plan for today from my real schedule.")} colors={colors} />
          <Action label="Review a mistake" icon="refresh-cw" active={mode === "review"} onPress={() => action("review", "Help me review a mistake. Ask me what question I got wrong.")} colors={colors} />
          <Action label="Practice quiz" icon="award" active={false} onPress={() => router.push(`/mito-quiz?childId=${encodeURIComponent(childId)}` as Href)} colors={colors} />
        </ScrollView>
        <View style={[styles.context, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ContextItem icon="calendar" text={today.isPending ? "Loading today..." : `${today.data?.items.length ?? 0} classes today`} colors={colors} />
          <View style={[styles.contextDivider, { backgroundColor: colors.border }]} />
          <ContextItem icon="trending-up" text={progress.isPending ? "Loading progress..." : `${progress.data?.classesCompleted ?? 0} completed`} colors={colors} />
        </View>
        <ScrollView ref={scroller} style={styles.fill} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
          {messages.map((message, index) => (
            <View key={index} style={[styles.bubble, message.role === "user" ? { alignSelf: "flex-end", backgroundColor: colors.primary } : { alignSelf: "flex-start", backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[type.body, { color: message.role === "user" ? "#FFFFFF" : colors.text }]}>{message.text}</Text>
              {message.role === "assistant" && <Pressable onPress={() => Speech.speak(message.text)} accessibilityLabel="Read Mito's reply aloud"><Feather name="volume-2" size={15} color={colors.muted} /></Pressable>}
            </View>
          ))}
          {send.isPending && <Text style={[type.caption, { color: colors.muted }]}>Mito is thinking...</Text>}
          {send.isError && <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{errorMessage(send.error, "Mito couldn't answer. Please try again.")}</Text>}
          {suggestions.length > 0 && !send.isPending && <View style={styles.suggestions}>{suggestions.map((item) => <Pressable key={item} onPress={() => submit(item)} style={[styles.suggestion, { borderColor: colors.primary }]}><Text style={[type.caption, { color: colors.primary }]}>{item}</Text></Pressable>)}</View>}
        </ScrollView>
        <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => submit()} placeholder="Ask Mito a question..." placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text }]} multiline maxLength={2000} editable={!send.isPending} accessibilityLabel="Message Mito" />
          <Pressable onPress={() => submit()} disabled={!input.trim() || send.isPending} style={[styles.sendButton, { backgroundColor: colors.primary, opacity: !input.trim() || send.isPending ? 0.45 : 1 }]} accessibilityLabel="Send message"><Feather name="arrow-up" size={20} color="#FFFFFF" /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Action({ label, icon, active, onPress, colors }: { label: string; icon: "help-circle" | "calendar" | "refresh-cw" | "award"; active: boolean; onPress: () => void; colors: Colors }) {
  return <Pressable onPress={onPress} style={[styles.action, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}><Feather name={icon} size={15} color={active ? "#FFFFFF" : colors.primary} /><Text style={[type.label, { color: active ? "#FFFFFF" : colors.text }]}>{label}</Text></Pressable>;
}

function ContextItem({ icon, text, colors }: { icon: "calendar" | "trending-up"; text: string; colors: Colors }) {
  return <View style={styles.contextItem}><Feather name={icon} size={15} color={colors.primary} /><Text style={[type.caption, { color: colors.text }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, hero: { flexDirection: "row", alignItems: "center", gap: space.md, paddingBottom: space.md }, heroText: { flex: 1 },
  robot: { width: 58, height: 48, borderRadius: 18, borderWidth: 2, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12 },
  eye: { width: 7, height: 10, borderRadius: 4 }, smile: { position: "absolute", width: 18, height: 9, bottom: 7, borderBottomWidth: 2, borderRadius: 9 },
  actions: { gap: space.sm, paddingBottom: space.sm }, action: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 9 },
  context: { flexDirection: "row", borderWidth: 1, borderRadius: radius.md, padding: space.sm, marginBottom: space.xs }, contextItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, contextDivider: { width: StyleSheet.hairlineWidth },
  thread: { gap: space.sm, paddingVertical: space.sm }, bubble: { maxWidth: "86%", borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm, gap: 6 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm }, suggestion: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, borderWidth: 1, borderRadius: radius.xl, padding: 6 },
  input: { flex: 1, minHeight: 42, maxHeight: 110, paddingHorizontal: space.sm, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15 },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
