import { Fragment, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { errorMessage } from "@/api/client";
import { ClassCalendar } from "@/components/ClassCalendar";
import { SessionRow } from "@/components/sessions";
import { Card, Chips, Divider, EmptyState, ErrorCard, Screen, Segmented, Skeleton } from "@/components/ui";
import { SCHEDULE_WINDOW_DAYS as WINDOW_DAYS, useChildren, useScheduleWindow } from "@/lib/queries";
import { belongsToChild, groupByDay, isLive } from "@/lib/schedule";
import { space, type, useColors } from "@/lib/theme";

type View_ = "upcoming" | "past" | "calendar";

export default function Classes() {
  const colors = useColors();
  const [view, setView] = useState<View_>("upcoming");
  const [childId, setChildId] = useState("all");

  const children = useChildren();
  const schedule = useScheduleWindow();

  const family = useMemo(() => (children.data ?? []).filter((c) => c.isActive), [children.data]);
  const fetchedAt = schedule.dataUpdatedAt;
  const groups = useMemo(() => {
    const now = new Date(fetchedAt);
    const mine = (schedule.data ?? []).filter((s) => childId === "all" || belongsToChild(s, childId, family));
    const upcoming = (s: (typeof mine)[number]) => new Date(s.scheduledEndAtUtc).getTime() > now.getTime() || isLive(s, now);
    return view === "upcoming"
      ? groupByDay(mine.filter(upcoming), now)
      : groupByDay(mine.filter((s) => !upcoming(s)), now, true);
  }, [schedule.data, fetchedAt, childId, family, view]);

  return (
    <Screen
      title="Classes"
      subtitle={view === "upcoming" ? `Your schedule for the next ${WINDOW_DAYS} days` : view === "past" ? `The last ${WINDOW_DAYS} days` : "Tap a day to see its classes"}
      refreshing={schedule.isRefetching}
      onRefresh={() => { void schedule.refetch(); void children.refetch(); }}
    >
      <View style={{ gap: space.md }}>
        <Segmented options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }, { value: "calendar", label: "Calendar" }]} value={view} onChange={setView} />
        {family.length > 1 && (
          <Chips
            options={[{ value: "all", label: "All children" }, ...family.map((c) => ({ value: c.id, label: c.firstName }))]}
            value={childId}
            onChange={setChildId}
          />
        )}
      </View>

      {view === "calendar" ? (
        <ClassCalendar childId={childId} family={family} />
      ) : schedule.isPending ? (
        <View style={{ gap: space.md }}><Skeleton height={20} style={{ width: 120 }} /><Skeleton height={150} /><Skeleton height={100} /></View>
      ) : schedule.isError ? (
        <ErrorCard message={errorMessage(schedule.error)} onRetry={() => schedule.refetch()} />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={view === "upcoming" ? "calendar" : "clock"}
            title={view === "upcoming" ? "No classes scheduled" : "No past classes"}
            description={view === "upcoming" ? "New classes will appear here as soon as they're booked." : `Nothing in the last ${WINDOW_DAYS} days.`}
          />
        </Card>
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ gap: space.sm }}>
            <Text style={[type.overline, { color: g.label === "Today" ? colors.primaryInk : colors.muted, paddingHorizontal: 2 }]}>
              {g.label} · {g.sessions.length} {g.sessions.length === 1 ? "class" : "classes"}
            </Text>
            <Card padded={false}>
              {g.sessions.map((s, i) => (
                <Fragment key={s.id}>
                  {i > 0 && <Divider />}
                  <SessionRow session={s} colors={colors} />
                </Fragment>
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}
