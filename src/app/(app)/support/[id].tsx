import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";
import { getSupportTicket, replyToSupportTicket } from "@/api/parent";
import { KeyboardSafe, useKeyboardVisible } from "@/components/keyboard";
import { Badge, Card, ErrorCard, Skeleton } from "@/components/ui";
import { TICKET_STATUS, categoryLabel } from "@/lib/support";
import { formatDate } from "@/lib/format";
import { brand, fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

export default function Ticket() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // The home-indicator gap is only needed while the keyboard is down.
  const bottomGap = useKeyboardVisible() ? 0 : insets.bottom;
  const session = useRequiredSession();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reply, setReply] = useState("");
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const key = ["ticket", session.token, id];
  const ticket = useQuery({ queryKey: key, queryFn: () => getSupportTicket(session.token, id) });

  const send = useMutation({
    mutationFn: () => replyToSupportTicket(session.token, id, reply.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData(key, updated);
      void queryClient.invalidateQueries({ queryKey: ["tickets", session.token] });
      setReply("");
    },
  });

  const t = ticket.data;
  const closed = t?.status === "Closed";

  return (
    <KeyboardSafe style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: t?.reference ?? "Request" }} />
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {ticket.isPending ? <><Skeleton height={80} /><Skeleton height={60} style={{ width: "70%" }} /></>
          : ticket.isError || !t ? <ErrorCard message={errorMessage(ticket.error)} onRetry={() => ticket.refetch()} />
          : (
            <>
              <Card style={{ gap: space.sm }}>
                <Text style={[type.heading, { color: colors.text }]}>{t.subject}</Text>
                <View style={styles.metaRow}>
                  <Badge label={TICKET_STATUS[t.status].label} tone={TICKET_STATUS[t.status].tone} />
                  <Text style={[type.caption, { color: colors.muted }]}>{categoryLabel(t.category)}{t.childName ? ` · ${t.childName}` : ""}</Text>
                </View>
              </Card>
              {t.messages.map((m) => (
                <View key={m.id} style={[styles.bubbleRow, m.isStaff ? styles.left : styles.right]}>
                  <View
                    style={[
                      styles.bubble,
                      m.isStaff
                        ? { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 4 }
                        : { backgroundColor: brand.orange, borderBottomRightRadius: 4 },
                    ]}
                  >
                    {m.isStaff && <Text style={[type.caption, { color: colors.primaryInk, fontFamily: fonts.bold }]}>{m.authorName}</Text>}
                    <Text style={[styles.message, { color: m.isStaff ? colors.text : "#FFFFFF" }]} selectable>{m.body}</Text>
                    <Text style={[styles.time, { color: m.isStaff ? colors.muted : "rgba(255,255,255,0.8)" }]}>
                      {formatDate(m.createdAtUtc, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
      </ScrollView>

      {t && (closed ? (
        <View style={[styles.closed, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.card }]}>
          <Text style={[type.caption, { color: colors.muted }]}>This request is closed. Start a new one if you need more help.</Text>
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: bottomGap + space.sm, backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          {send.isError && <Text style={[type.caption, { color: colors.danger }]}>{errorMessage(send.error)}</Text>}
          <View style={styles.composerRow}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.mutedBg, color: colors.text }]}
              value={reply}
              onChangeText={setReply}
              placeholder="Write a reply…"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={4000}
              accessibilityLabel="Reply"
            />
            <Pressable
              onPress={() => send.mutate()}
              disabled={!reply.trim() || send.isPending}
              accessibilityRole="button"
              accessibilityLabel="Send reply"
              style={[styles.send, { backgroundColor: reply.trim() ? brand.orange : colors.mutedBg }]}
            >
              {send.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="send" size={18} color={reply.trim() ? "#FFFFFF" : colors.muted} />}
            </Pressable>
          </View>
        </View>
      ))}
    </KeyboardSafe>
  );
}

const styles = StyleSheet.create({
  thread: { padding: space.lg, gap: space.md },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  bubbleRow: { flexDirection: "row" },
  left: { justifyContent: "flex-start" },
  right: { justifyContent: "flex-end" },
  bubble: { maxWidth: "82%", borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  message: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  time: { fontFamily: fonts.medium, fontSize: 11, alignSelf: "flex-end" },
  composer: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.xs, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: -2 }, elevation: 10 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: { flex: 1, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 15, maxHeight: 120 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  closed: { alignItems: "center", paddingTop: space.md, paddingHorizontal: space.lg },
});
