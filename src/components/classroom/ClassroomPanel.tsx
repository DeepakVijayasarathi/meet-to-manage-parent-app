import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import type { Classroom } from "@/lib/useClassroom";
import { brand, fonts, radius, space, type, useColors } from "@/lib/theme";

import { SlidesView } from "./SlidesView";
import { Whiteboard } from "./Whiteboard";

type Tab = "board" | "slides" | "chat" | "stars" | "people";
export type Snap = "peek" | "half" | "full";

/**
 * The classroom bottom sheet over the video: the web panel's Board / Chat / Stars / People.
 * Collapsed it is just the tab bar; tapping a tab opens it, the handle cycles its height.
 */
export function ClassroomPanel({ room, displayName, snap, onSnap }: { room: Classroom; displayName: string; snap: Snap; onSnap: (s: Snap) => void }) {
  const colors = useColors();
  const [tab, setTab] = useState<Tab>("board");
  // Follow the teacher (web: InteractivePanel.followTeacher): her new slide, board stroke or
  // board grant opens that tab, big enough to read or draw on. Quizzes pop up on their own.
  const [lastActivity, setLastActivity] = useState(room.teacherActivity?.at ?? 0);
  const activity = room.teacherActivity;
  if (activity && activity.at !== lastActivity) {
    setLastActivity(activity.at);
    if (activity.what !== "quiz") {
      setTab(activity.what);
      if (snap === "peek" || activity.what === "slides" || room.canDraw) onSnap("full");
    }
  }
  function pickTab(t: Tab) {
    if (t === tab && snap !== "peek") { onSnap("peek"); return; }
    setTab(t);
    if (t === "chat") room.clearUnreadChat();
    if (snap === "peek") onSnap(t === "board" || t === "slides" ? "full" : "half");
  }
  const cycle = () => onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "peek");
  const tabs: { id: Tab; label: string; icon: React.ComponentProps<typeof Feather>["name"]; badge?: number }[] = [
    { id: "board", label: "Board", icon: "edit-3" },
    { id: "slides", label: "Slides", icon: "monitor" },
    { id: "chat", label: "Chat", icon: "message-circle", badge: tab === "chat" ? 0 : room.unreadChat },
    { id: "stars", label: "Stars", icon: "star" },
    { id: "people", label: "People", icon: "users" },
  ];

  return (
    <View style={[styles.panel, { backgroundColor: colors.card, shadowColor: "#000" }]}>
      <Pressable onPress={cycle} hitSlop={8} accessibilityRole="button" accessibilityLabel={snap === "full" ? "Collapse panel" : "Expand panel"} style={styles.handleArea}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
      </Pressable>
      <View style={styles.tabBar}>
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable key={t.id} onPress={() => pickTab(t.id)}
              accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: active && snap !== "peek" }}
              style={[styles.tab, active && snap !== "peek" && { backgroundColor: colors.primarySoft }]}>
              <Feather name={t.icon} size={16} color={active ? colors.primaryInk : colors.muted} />
              {active && snap !== "peek" && <Text style={[styles.tabText, { color: colors.primaryInk }]} numberOfLines={1}>{t.label}</Text>}
              {!!t.badge && <View style={styles.badge}><Text style={styles.badgeText}>{t.badge > 9 ? "9+" : t.badge}</Text></View>}
            </Pressable>
          );
        })}
        <Pressable onPress={room.toggleHand} accessibilityRole="button" accessibilityLabel={room.handRaised ? "Lower hand" : "Raise hand"}
          style={[styles.hand, room.handRaised ? { backgroundColor: brand.orange } : { backgroundColor: colors.mutedBg }]}>
          <Text style={{ fontSize: 18 }}>✋</Text>
        </Pressable>
      </View>

      {room.hubState !== "connected" && (
        <View style={[styles.syncNote, { backgroundColor: colors.warningSoft }]}>
          <Feather name={room.hubState === "reconnecting" ? "refresh-cw" : "wifi-off"} size={13} color={colors.warningText} />
          <Text style={[type.caption, { color: colors.warningText, flex: 1 }]}>
            {room.hubState === "reconnecting" ? "Reconnecting live board…" : room.hubError ?? "Live board connecting…"}
          </Text>
        </View>
      )}

      {snap !== "peek" && <View style={styles.body}>
        {tab === "board" && <Whiteboard board={room.board} canDraw={room.canDraw} onLocalOp={room.boardOp} onInteraction={room.boardInteraction}
          activities={room.activities} onActivityComplete={room.completeActivity} />}
        {tab === "slides" && <SlidesView room={room} />}
        {tab === "chat" && <Chat room={room} />}
        {tab === "stars" && <Stars room={room} displayName={displayName} />}
        {tab === "people" && <People room={room} />}
      </View>}
    </View>
  );
}

function Chat({ room }: { room: Classroom }) {
  const colors = useColors();
  const [text, setText] = useState("");
  const list = useRef<FlatList<Classroom["chat"][number]>>(null);
  useEffect(() => { room.clearUnreadChat(); }, [room.chat.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = () => { room.sendChat(text); setText(""); };
  return (
    <View style={{ flex: 1, gap: space.sm }}>
      <FlatList
        ref={list}
        data={room.chat}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm }}
        ListEmptyComponent={<Text style={[type.caption, { color: colors.muted, textAlign: "center", marginTop: space.xl }]}>Say hello to your class 👋</Text>}
        renderItem={({ item }) => (
          <View style={[styles.msg, item.mine ? { alignSelf: "flex-end", backgroundColor: brand.orange } : { alignSelf: "flex-start", backgroundColor: colors.mutedBg }]}>
            {!item.mine && <Text style={[styles.msgAuthor, { color: colors.primaryInk }]}>{item.author}</Text>}
            <Text style={[styles.msgText, { color: item.mine ? "#FFFFFF" : colors.text }]}>{item.text}</Text>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          returnKeyType="send"
          placeholder="Message the class…"
          placeholderTextColor={colors.muted}
          style={[styles.input, { backgroundColor: colors.mutedBg, color: colors.text }]}
          accessibilityLabel="Chat message"
        />
        <Pressable onPress={send} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Send"
          style={[styles.send, { backgroundColor: text.trim() ? brand.orange : colors.mutedBg }]}>
          <Feather name="send" size={17} color={text.trim() ? "#FFFFFF" : colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function Stars({ room, displayName }: { room: Classroom; displayName: string }) {
  const colors = useColors();
  const rows = [...room.leaderboard].sort((a, b) => b.stars - a.stars);
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.name}
      contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm }}
      ListEmptyComponent={<Text style={[type.caption, { color: colors.muted, textAlign: "center", marginTop: space.xl }]}>Answer quizzes and join in to earn stars ⭐</Text>}
      renderItem={({ item, index }) => {
        const me = item.name === displayName;
        return (
          <View style={[styles.starRow, { backgroundColor: me ? colors.primarySoft : colors.mutedBg }]}>
            <Text style={styles.rank}>{medal[index] ?? `${index + 1}`}</Text>
            <Text style={[styles.starName, { color: colors.text }]} numberOfLines={1}>{item.name}{me ? " (you)" : ""}</Text>
            <Text style={[styles.starCount, { color: colors.primaryInk }]}>⭐ {item.stars}</Text>
          </View>
        );
      }}
    />
  );
}

function People({ room }: { room: Classroom }) {
  const colors = useColors();
  const people = [...room.roster].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "teacher" ? -1 : 1));
  return (
    <FlatList
      data={people}
      keyExtractor={(p) => p.connectionId}
      contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm }}
      ListEmptyComponent={<Text style={[type.caption, { color: colors.muted, textAlign: "center", marginTop: space.xl }]}>Waiting for the class to join…</Text>}
      renderItem={({ item }) => (
        <View style={[styles.person, { borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: item.role === "teacher" ? brand.orange : colors.mutedBg }]}>
            <Text style={[styles.avatarText, { color: item.role === "teacher" ? "#FFFFFF" : colors.textSoft }]}>{item.name.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[styles.starName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          {item.role === "teacher" && <Text style={[type.caption, { color: colors.primaryInk }]}>Teacher</Text>}
          {item.handRaised && <Text style={{ fontSize: 16 }}>✋</Text>}
        </View>
      )}
    />
  );
}

/** Teacher-started quiz question (hub QuizStarted): pick an answer, get instant feedback and a star. */
export function QuizOverlay({ room }: { room: Classroom }) {
  const colors = useColors();
  const index = room.quizIndex;
  const question = index === null ? undefined : room.questions[index];
  const picked = index === null ? undefined : room.answered[index];
  // Same order as the web classroom (and the teacher's tally): the API's, unsorted.
  const options = question?.options ?? [];
  const correctIndex = options.findIndex((o) => o.isCorrect);

  return (
    <Modal visible={!!question} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.dim}>
        <Animated.View entering={ZoomIn.duration(300)} style={[styles.quiz, { backgroundColor: colors.card }]}>
          <View style={styles.quizHead}>
            <Text style={[type.overline, { color: colors.primaryInk }]}>Quiz time · Question {(index ?? 0) + 1}</Text>
            <Text style={[styles.quizPrompt, { color: colors.text }]}>{question?.prompt}</Text>
          </View>
          {options.map((o, i) => {
            const chosen = picked === i;
            const reveal = picked !== undefined;
            const right = reveal && i === correctIndex;
            const wrong = reveal && chosen && i !== correctIndex;
            return (
              <Pressable key={o.id} disabled={reveal} onPress={() => index !== null && room.answerQuiz(index, i)} accessibilityRole="button"
                style={[styles.option, { borderColor: right ? colors.success : wrong ? colors.danger : colors.border, backgroundColor: right ? colors.successSoft : wrong ? colors.dangerSoft : colors.card }]}>
                <View style={[styles.optionLetter, { backgroundColor: right ? colors.success : wrong ? colors.danger : colors.mutedBg }]}>
                  <Text style={[styles.optionLetterText, { color: right || wrong ? "#FFFFFF" : colors.textSoft }]}>{String.fromCharCode(65 + i)}</Text>
                </View>
                <Text style={[styles.optionText, { color: colors.text }]}>{o.text}</Text>
                {right && <Feather name="check-circle" size={18} color={colors.success} />}
                {wrong && <Feather name="x-circle" size={18} color={colors.danger} />}
              </Pressable>
            );
          })}
          {picked !== undefined && (
            <Animated.Text entering={FadeIn} style={[styles.quizResult, { color: picked === correctIndex ? colors.success : colors.textSoft }]}>
              {picked === correctIndex ? "Correct! You earned a star ⭐" : "Good try! Wait for the teacher's next question."}
            </Animated.Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Teacher's "Celebrate" (hub Celebrate): a short confetti-style burst over the class. */
export function CelebrationOverlay({ room }: { room: Classroom }) {
  const { celebration, dismissCelebration } = room;
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(dismissCelebration, 3500);
    return () => clearTimeout(t);
  }, [celebration, dismissCelebration]);
  if (!celebration) return null;
  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(400)} style={styles.celebrate} pointerEvents="none">
      <Animated.View entering={ZoomIn.springify()}>
        <LinearGradient colors={[brand.orangeFrom, brand.orangeTo]} style={styles.celebrateCard}>
          <Text style={styles.celebrateEmoji}>🎉 ⭐ 🎉</Text>
          <Text style={styles.celebrateText}>{celebration.message || "Great job, class!"}</Text>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.md, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 16 },
  handleArea: { alignItems: "center", paddingTop: 8, paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3 },
  tabBar: { flexDirection: "row", alignItems: "center", gap: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: radius.pill },
  tabText: { fontFamily: fonts.semibold, fontSize: 12 },
  badge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: brand.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { fontFamily: fonts.bold, fontSize: 9, color: "#FFFFFF" },
  hand: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  syncNote: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, marginTop: space.sm },
  body: { flex: 1, paddingVertical: space.sm },
  msg: { maxWidth: "82%", borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  msgAuthor: { fontFamily: fonts.bold, fontSize: 11 },
  msgText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  composer: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  input: { flex: 1, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  starRow: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12 },
  rank: { width: 28, textAlign: "center", fontFamily: fonts.bold, fontSize: 16 },
  starName: { flex: 1, fontFamily: fonts.semibold, fontSize: 15 },
  starCount: { fontFamily: fonts.bold, fontSize: 15 },
  person: { flexDirection: "row", alignItems: "center", gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: 14 },
  dim: { flex: 1, backgroundColor: "rgba(16,24,40,0.55)", justifyContent: "center", padding: space.xl },
  quiz: { borderRadius: radius.xl, padding: space.xl, gap: space.md },
  quizHead: { gap: space.sm, marginBottom: space.xs },
  quizPrompt: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1.5, borderRadius: radius.lg, padding: space.md },
  optionLetter: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  optionLetterText: { fontFamily: fonts.bold, fontSize: 14 },
  optionText: { flex: 1, fontFamily: fonts.semibold, fontSize: 16 },
  quizResult: { fontFamily: fonts.bold, fontSize: 15, textAlign: "center", marginTop: space.xs },
  celebrate: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(16,24,40,0.25)" },
  celebrateCard: { borderRadius: radius.xl, paddingHorizontal: space.xxl, paddingVertical: space.xl, alignItems: "center", gap: space.sm },
  celebrateEmoji: { fontSize: 36 },
  celebrateText: { fontFamily: fonts.bold, fontSize: 20, color: "#FFFFFF", textAlign: "center" },
});
