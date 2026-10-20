import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { errorMessage } from "@/api/client";
import { createSupportTicket, getChildren } from "@/api/parent";
import type { SupportTicketCategory } from "@/api/types";
import { Button, Chips, Screen } from "@/components/ui";
import { TICKET_CATEGORIES } from "@/lib/support";
import { fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

export default function NewRequest() {
  const colors = useColors();
  const session = useRequiredSession();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<SupportTicketCategory | null>(null);
  const [childId, setChildId] = useState("none");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const children = useQuery({ queryKey: ["children", session.token], queryFn: () => getChildren(session.token) });
  const family = (children.data ?? []).filter((c) => c.isActive);

  const submit = useMutation({
    mutationFn: () => createSupportTicket(session.token, {
      category: category!, subject: subject.trim(), message: message.trim(), childId: childId === "none" ? null : childId,
    }),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ["tickets", session.token] });
      router.dismiss();
      router.push({ pathname: "/support/[id]", params: { id: ticket.id } });
    },
  });
  const ready = !!category && subject.trim().length >= 3 && message.trim().length >= 5;
  const input = [styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }];

  return (
      <Screen>
        <View style={styles.group}>
          <Text style={[type.label, { color: colors.textSoft }]}>What is it about?</Text>
          <View style={styles.categories}>
            {TICKET_CATEGORIES.map((c) => {
              const active = c.value === category;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[styles.category, { backgroundColor: active ? colors.primarySoft : colors.card, borderColor: active ? colors.primary : colors.border }]}
                >
                  <Feather name={c.icon} size={18} color={active ? colors.primaryInk : colors.muted} />
                  <Text style={[type.label, { color: active ? colors.primaryInk : colors.text }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {family.length > 0 && (
          <View style={styles.group}>
            <Text style={[type.label, { color: colors.textSoft }]}>For which child? (optional)</Text>
            <Chips options={[{ value: "none", label: "Not specific" }, ...family.map((c) => ({ value: c.id, label: c.firstName }))]} value={childId} onChange={setChildId} />
          </View>
        )}

        <View style={styles.group}>
          <Text style={[type.label, { color: colors.textSoft }]}>Subject</Text>
          <TextInput style={input} value={subject} onChangeText={setSubject} placeholder="A short summary" placeholderTextColor={colors.muted} maxLength={200} accessibilityLabel="Subject" />
        </View>

        <View style={styles.group}>
          <Text style={[type.label, { color: colors.textSoft }]}>Message</Text>
          <TextInput
            style={[input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what happened and how we can help"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            maxLength={4000}
            accessibilityLabel="Message"
          />
        </View>

        {submit.isError && <Text style={[type.label, { color: colors.danger }]}>{errorMessage(submit.error)}</Text>}
        <Button label="Send request" icon="send" onPress={() => submit.mutate()} disabled={!ready} loading={submit.isPending} />
      </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  category: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, flexBasis: "47%", flexGrow: 1 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14, fontFamily: fonts.medium, fontSize: 16 },
  textarea: { minHeight: 140 },
});
