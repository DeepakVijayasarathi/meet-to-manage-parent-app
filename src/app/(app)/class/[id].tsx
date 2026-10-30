import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router, useLocalSearchParams, type Href } from "expo-router";
import { Fragment, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { errorMessage } from "@/api/client";
import { cancelClass } from "@/api/parent";
import { SESSION_STATUS } from "@/components/sessions";
import { Badge, Button, Card, Divider, EmptyState, ListRow, Screen, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useChildren, useScheduleWindow } from "@/lib/queries";
import { CANCEL_CUTOFF_MINUTES, canParentCancel, classTitle, countdownLabel, isJoinable, isLive, joinDisplayName, joinOpensAt, joinOpensLabel } from "@/lib/schedule";
import { useNow } from "@/lib/useNow";
import { brand, fonts, radius, space, type, useColors } from "@/lib/theme";
import { useAppConfig } from "@/state/appConfig";
import { useRequiredSession } from "@/state/session";

export default function ClassDetails() {
  const colors = useColors();
  const session = useRequiredSession();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const schedule = useScheduleWindow();
  const children = useChildren();
  const { config } = useAppConfig();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const cls = schedule.data?.find((s) => s.id === id);
  const cancel = useMutation({
    mutationFn: () => cancelClass(session.token, id, reason.trim()),
    onSuccess: () => {
      setCancelling(false);
      for (const key of ["schedule", "schedule-month", "dashboard"]) void queryClient.invalidateQueries({ queryKey: [key, session.token] });
    },
  });

  const now = useNow();

  if (schedule.isPending) return <Screen><Skeleton height={190} style={{ borderRadius: radius.xl }} /><Skeleton height={220} /></Screen>;
  if (!cls) return <Screen><Card><EmptyState icon="calendar" title="Class not found" description="It may have been moved or removed. Pull to refresh your schedule." /></Card></Screen>;

  const live = isLive(cls, now);
  const joinable = isJoinable(cls, config?.joinOpensMinutesBefore, now);
  const opensAt = joinOpensAt(cls, config?.joinOpensMinutesBefore, now);
  const start = new Date(cls.scheduledStartAtUtc);
  const end = new Date(cls.scheduledEndAtUtc);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const status = SESSION_STATUS[cls.status] ?? { label: cls.status, tone: "neutral" as const };
  const name = joinDisplayName(cls, children.data ?? [], session.userName);
  const join = () => router.push({ pathname: "/live/[id]", params: { id: cls.id, title: classTitle(cls), name } });

  const details = [
    { icon: "user" as const, title: "Teacher", value: cls.teacherName },
    { icon: "calendar" as const, title: "Date", value: formatDate(cls.scheduledStartAtUtc, { weekday: "long", day: "numeric", month: "long" }) },
    { icon: "clock" as const, title: "Time", value: `${time(start)} – ${time(end)} · ${minutes} min` },
    { icon: cls.type === "Demo" ? "star" as const : "video" as const, title: "Class type", value: cls.type === "Demo" ? "Demo class" : "Online class" },
  ];

  return (
    <Screen refreshing={schedule.isRefetching} onRefresh={() => schedule.refetch()}>
      <Stack.Screen options={{ title: classTitle(cls) }} />

      <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={[styles.pill, { backgroundColor: live ? "#16A34A" : "#FFFFFF" }]}>
            <Text style={[styles.pillText, { color: live ? "#FFFFFF" : brand.orangeTo }]}>
              {live ? "Live now" : cls.status === "Scheduled" || cls.status === "CarriedForward" ? countdownLabel(cls) : status.label}
            </Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>{classTitle(cls)}</Text>
        <Text style={styles.heroTime}>{time(start)} – {time(end)}</Text>
        <Text style={styles.heroDate}>{formatDate(cls.scheduledStartAtUtc, { weekday: "long", day: "numeric", month: "long" })}</Text>
        {joinable && (
          <Button label={live ? "Join class now" : "Join class"} icon="video" variant="secondary" onPress={join} style={{ marginTop: space.md }} />
        )}
        {opensAt && <Button label={joinOpensLabel(opensAt, now)} icon="lock" variant="secondary" disabled style={{ marginTop: space.md }} />}
      </LinearGradient>

      <Card padded={false}>
        {details.map((d, i) => (
          <Fragment key={d.title}>
            {i > 0 && <Divider />}
            <ListRow icon={d.icon} title={d.value} subtitle={d.title} chevron={false} />
          </Fragment>
        ))}
        <Divider />
        <ListRow icon="info" title={status.label} subtitle="Status" chevron={false} right={<Badge label={status.label} tone={status.tone} />} />
      </Card>

      {cls.status === "Cancelled" && cls.cancellationReason ? (
        <Card style={{ gap: space.sm }}>
          <Text style={[type.overline, { color: colors.muted }]}>Cancellation reason</Text>
          <Text style={[type.body, { color: colors.text }]}>{cls.cancellationReason}</Text>
        </Card>
      ) : null}

      {cls.summary?.trim() ? (
        <Card style={{ gap: space.sm }}>
          <Text style={[type.overline, { color: colors.muted }]}>Class summary</Text>
          <Text style={[type.body, { color: colors.text }]} selectable>{cls.summary.trim()}</Text>
        </Card>
      ) : null}

      {cls.hasRecording && (
        <Card padded={false}>
          <ListRow icon="play-circle" tone="success" title="Watch the recording" subtitle="Available in Class recordings" onPress={() => router.push("/recordings" as Href)} />
        </Card>
      )}

      {canParentCancel(cls) && !cancel.isSuccess && (
        cancelling ? (
          <Card style={{ gap: space.md }}>
            <Text style={[type.heading, { color: colors.text }]}>Cancel this class?</Text>
            <Text style={[type.body, { color: colors.muted }]}>
              The teacher is told right away with your reason. For a private class a make-up is scheduled automatically; in a group class only your child is marked absent.
            </Text>
            <TextInput
              style={[styles.reason, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (required), e.g. unwell, travelling"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              maxLength={500}
              accessibilityLabel="Reason for cancelling"
            />
            {cancel.isError && <Text style={[type.label, { color: colors.danger }]}>{errorMessage(cancel.error)}</Text>}
            <View style={styles.actions}>
              <Button label="Keep class" variant="secondary" onPress={() => setCancelling(false)} style={{ flex: 1 }} />
              <Button label="Cancel class" onPress={() => cancel.mutate()} disabled={!reason.trim()} loading={cancel.isPending} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <View style={{ gap: space.sm }}>
            <Button label="Cancel this class" icon="x-circle" variant="ghost" onPress={() => setCancelling(true)} />
            <Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>Classes can be cancelled up to {CANCEL_CUTOFF_MINUTES} minutes before they start.</Text>
          </View>
        )
      )}

      {cancel.isSuccess && (
        <Card style={[styles.done, { backgroundColor: colors.successSoft, borderColor: colors.successSoft }]}>
          <Feather name="check-circle" size={18} color={colors.success} />
          <Text style={[type.label, { color: colors.success, flex: 1 }]}>Cancellation sent. The teacher has been notified, and any make-up class will appear in your schedule.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, gap: 4 },
  heroTop: { flexDirection: "row", marginBottom: space.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.5, color: "#FFFFFF" },
  heroTime: { fontFamily: fonts.semibold, fontSize: 17, color: "#FFFFFF" },
  heroDate: { fontFamily: fonts.medium, fontSize: 14, color: "rgba(255,255,255,0.9)" },
  reason: { borderWidth: 1, borderRadius: radius.md, padding: space.md, minHeight: 90, fontFamily: fonts.regular, fontSize: 15 },
  actions: { flexDirection: "row", gap: space.sm },
  done: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
});
