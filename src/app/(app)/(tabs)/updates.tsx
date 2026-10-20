import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/api/parent";
import type { ApiNotification, ApiNotificationFeed } from "@/api/types";
import { Card, Divider, EmptyState, ErrorCard, IconTile, Screen, Skeleton, type IconName, type Tone } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { fonts, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

/** Picks an icon from the notification type (types are backend enum names like "ClassReminder"). */
function iconFor(n: ApiNotification): { icon: IconName; tone: Tone } {
  const t = n.type.toLowerCase();
  if (t.includes("payment") || t.includes("invoice") || t.includes("fee")) return { icon: "credit-card", tone: "warning" };
  if (t.includes("cancel")) return { icon: "x-circle", tone: "danger" };
  if (t.includes("class") || t.includes("session") || t.includes("reschedul") || t.includes("remind")) return { icon: "calendar", tone: "brand" };
  if (t.includes("report") || t.includes("progress")) return { icon: "file-text", tone: "info" };
  if (t.includes("ticket") || t.includes("support")) return { icon: "life-buoy", tone: "info" };
  return { icon: "bell", tone: "neutral" };
}

export default function Updates() {
  const colors = useColors();
  const session = useRequiredSession();
  const queryClient = useQueryClient();
  const key = ["notifications", session.token];
  const feed = useQuery({ queryKey: key, queryFn: () => getNotifications(session.token) });

  // Optimistic: the dot and the tab badge clear at once; a refetch reconciles afterwards.
  const setRead = (ids: string[] | "all") =>
    queryClient.setQueryData<ApiNotificationFeed>(key, (old) => old && {
      unreadCount: ids === "all" ? 0 : Math.max(0, old.unreadCount - old.items.filter((n) => !n.isRead && ids.includes(n.id)).length),
      items: old.items.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, isRead: true } : n)),
    });
  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(session.token, id),
    onMutate: (id) => setRead([id]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(session.token),
    onMutate: () => setRead("all"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const items = feed.data?.items ?? [];
  const unread = feed.data?.unreadCount ?? 0;

  return (
    <Screen
      title="Updates"
      subtitle={unread ? `${unread} unread` : "You're all caught up"}
      refreshing={feed.isRefetching}
      onRefresh={() => feed.refetch()}
      right={unread > 0 ? (
        <Pressable onPress={() => readAll.mutate()} hitSlop={10} accessibilityRole="button" style={[styles.markAll, { backgroundColor: colors.primarySoft }]}>
          <Text style={[type.label, { color: colors.primaryInk }]}>Mark all read</Text>
        </Pressable>
      ) : undefined}
    >
      {feed.isPending ? <View style={{ gap: space.md }}><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></View>
        : feed.isError ? <ErrorCard message={errorMessage(feed.error)} onRetry={() => feed.refetch()} />
        : items.length === 0 ? (
          <Card><EmptyState icon="bell" title="No updates yet" description="Class changes, reminders and messages from your academy will appear here." /></Card>
        ) : (
          <Card padded={false}>
            {items.map((n, i) => {
              const { icon, tone } = iconFor(n);
              return (
                <Fragment key={n.id}>
                  {i > 0 && <Divider />}
                  <Pressable
                    onPress={() => { if (!n.isRead) readOne.mutate(n.id); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${n.isRead ? "" : "Unread. "}${n.subject ?? ""} ${n.body}`}
                    style={({ pressed }) => [styles.item, !n.isRead && { backgroundColor: colors.primarySoft }, pressed && { opacity: 0.8 }]}
                  >
                    <IconTile icon={icon} tone={tone} size={40} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.text, fontFamily: n.isRead ? fonts.semibold : fonts.bold }]} numberOfLines={1}>
                          {n.subject || "Update"}
                        </Text>
                        <Text style={[type.caption, { color: colors.muted }]}>{timeAgo(n.createdAtUtc)}</Text>
                      </View>
                      <Text style={[styles.body, { color: colors.textSoft }]} numberOfLines={3}>{n.body}</Text>
                    </View>
                    {!n.isRead && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                  </Pressable>
                </Fragment>
              );
            })}
          </Card>
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 4 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1, fontSize: 15 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
