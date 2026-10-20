// Class-session pieces shared by Home and the Classes tab.
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ApiClassSession, SessionStatus } from "@/api/types";
import { Badge, type Tone } from "@/components/ui";
import { classTitle, timeRange } from "@/lib/schedule";
import { fonts, radius, space, type Colors } from "@/lib/theme";

export const SESSION_STATUS: Record<SessionStatus, { label: string; tone: Tone }> = {
  Scheduled: { label: "Scheduled", tone: "info" },
  InProgress: { label: "Live", tone: "success" },
  Completed: { label: "Completed", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
  Rescheduled: { label: "Rescheduled", tone: "warning" },
  TeacherNoShow: { label: "Teacher absent", tone: "neutral" },
  StudentNoShow: { label: "Missed", tone: "neutral" },
  CarriedForward: { label: "Carried forward", tone: "info" },
};


export function DateTile({ iso, colors }: { iso: string; colors: Colors }) {
  const d = new Date(iso);
  return (
    <View style={[styles.dateTile, { backgroundColor: colors.mutedBg }]}>
      <Text style={[styles.dateMonth, { color: colors.primaryInk }]}>{d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</Text>
      <Text style={[styles.dateDay, { color: colors.text }]}>{d.getDate()}</Text>
    </View>
  );
}


export function SessionRow({ session, colors }: { session: ApiClassSession; colors: Colors }) {
  const cancelled = session.status === "Cancelled";
  const status = session.type === "Demo" && !cancelled ? { label: "Demo", tone: "warning" as Tone } : SESSION_STATUS[session.status] ?? { label: session.status, tone: "neutral" as Tone };
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/class/[id]", params: { id: session.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${classTitle(session)}, ${dayLabel(session)}, ${timeRange(session)}, ${status.label}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.mutedBg }]}
    >
      <DateTile iso={session.scheduledStartAtUtc} colors={colors} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }, cancelled && styles.struck]} numberOfLines={1}>{classTitle(session)}</Text>
        <Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={1}>{timeRange(session)} · {session.teacherName}</Text>
      </View>
      <Badge label={status.label} tone={status.tone} />
      <Feather name="chevron-right" size={16} color={colors.muted} />
    </Pressable>
  );
}


export function dayLabel(s: ApiClassSession): string {
  const d = new Date(s.scheduledStartAtUtc);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === new Date(today.getTime() + 86_400_000).toDateString()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}


const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14 },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  struck: { textDecorationLine: "line-through" },
  dateTile: { width: 44, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  dateMonth: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8 },
  dateDay: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22 },
});
