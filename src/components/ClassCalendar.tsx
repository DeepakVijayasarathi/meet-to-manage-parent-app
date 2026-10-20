import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getSchedule } from "@/api/parent";
import type { ApiClassSession, ApiParentChild } from "@/api/types";
import { SessionRow } from "@/components/sessions";
import { Card, Divider, EmptyState, ErrorCard } from "@/components/ui";
import { belongsToChild, localDayKey, monthGrid, sessionsByDay } from "@/lib/schedule";
import { brand, fonts, space, type, useColors, type Colors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Dot colour for a day: live/upcoming orange, done green, cancelled red. */
function dotColor(s: ApiClassSession, colors: Colors): string {
  if (s.status === "Cancelled") return colors.danger;
  if (s.status === "Completed") return colors.success;
  if (s.type === "Demo") return colors.warning;
  return brand.orange;
}

/** Month calendar of the family's classes; tapping a day lists its classes underneath. */
export function ClassCalendar({ childId, family }: { childId: string; family: ApiParentChild[] }) {
  const colors = useColors();
  const session = useRequiredSession();
  const today = new Date();
  const [month, setMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(localDayKey(today));

  const weeks = useMemo(() => monthGrid(month.year, month.month), [month]);
  const from = weeks[0][0].date;
  const last = weeks[weeks.length - 1][6].date;
  const to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);

  // Each visible month (with its padding days) is fetched on its own and cached.
  const schedule = useQuery({
    queryKey: ["schedule-cal", session.token, localDayKey(from)],
    queryFn: () => getSchedule(session.token, from, to),
  });
  const days = useMemo(
    () => sessionsByDay((schedule.data ?? []).filter((s) => childId === "all" || belongsToChild(s, childId, family))),
    [schedule.data, childId, family],
  );

  const shift = (delta: number) => setMonth((m) => {
    const d = new Date(m.year, m.month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const goToday = () => { setMonth({ year: today.getFullYear(), month: today.getMonth() }); setSelected(localDayKey(today)); };
  const todayKey = localDayKey(today);
  const dayList = days[selected] ?? [];
  const selectedDate = new Date(`${selected}T00:00:00`);

  return (
    <View style={{ gap: space.lg }}>
      <Card style={{ gap: space.md }}>
        <View style={styles.head}>
          <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month" style={[styles.nav, { backgroundColor: colors.mutedBg }]}>
            <Feather name="chevron-left" size={18} color={colors.text} />
          </Pressable>
          <Pressable onPress={goToday} accessibilityRole="button" accessibilityLabel="Go to today" style={{ flex: 1, alignItems: "center" }}>
            <Text style={[type.heading, { color: colors.text }]}>
              {new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </Text>
          </Pressable>
          <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month" style={[styles.nav, { backgroundColor: colors.mutedBg }]}>
            <Feather name="chevron-right" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.row}>
          {WEEKDAYS.map((d) => <Text key={d} style={[styles.weekday, { color: colors.muted }]}>{d}</Text>)}
        </View>

        {weeks.map((week) => (
          <View key={week[0].key} style={styles.row}>
            {week.map((day) => {
              const list = days[day.key] ?? [];
              const isSel = day.key === selected;
              const isToday = day.key === todayKey;
              return (
                <Pressable
                  key={day.key}
                  onPress={() => { setSelected(day.key); if (!day.inMonth) setMonth({ year: day.date.getFullYear(), month: day.date.getMonth() }); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.date.toDateString()}, ${list.length} ${list.length === 1 ? "class" : "classes"}`}
                  accessibilityState={{ selected: isSel }}
                  style={styles.cell}
                >
                  <View style={[styles.dayCircle, isSel && { backgroundColor: brand.orange }, !isSel && isToday && { borderWidth: 1.5, borderColor: brand.orange }]}>
                    <Text style={[styles.dayNum, { color: isSel ? "#FFFFFF" : day.inMonth ? colors.text : colors.border }]}>{day.date.getDate()}</Text>
                  </View>
                  <View style={styles.dots}>
                    {list.slice(0, 3).map((s) => <View key={s.id} style={[styles.dot, { backgroundColor: dotColor(s, colors) }]} />)}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.legend}>
          {[["Upcoming", brand.orange], ["Completed", colors.success], ["Demo", colors.warning], ["Cancelled", colors.danger]].map(([label, c]) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: c }]} />
              <Text style={[type.caption, { color: colors.muted }]}>{label}</Text>
            </View>
          ))}
        </View>
        {schedule.isFetching && <ActivityIndicator style={styles.spinner} color={colors.primary} />}
      </Card>

      <View style={{ gap: space.sm }}>
        <Text style={[type.overline, { color: selected === todayKey ? colors.primaryInk : colors.muted, paddingHorizontal: 2 }]}>
          {selected === todayKey ? "Today" : selectedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          {dayList.length ? ` · ${dayList.length} ${dayList.length === 1 ? "class" : "classes"}` : ""}
        </Text>
        {schedule.isError ? <ErrorCard message={errorMessage(schedule.error)} onRetry={() => schedule.refetch()} />
          : dayList.length === 0 ? (
            <Card><EmptyState icon="sun" title="No classes this day" description="Pick a day with a dot to see its classes." /></Card>
          ) : (
            <Card padded={false}>
              {dayList.map((s, i) => (
                <Fragment key={s.id}>
                  {i > 0 && <Divider />}
                  <SessionRow session={s} colors={colors} />
                </Fragment>
              ))}
            </Card>
          )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  nav: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5 },
  cell: { flex: 1, alignItems: "center", paddingVertical: 3, gap: 3 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dayNum: { fontFamily: fonts.semibold, fontSize: 14 },
  dots: { flexDirection: "row", gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.md, paddingTop: space.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  spinner: { position: "absolute", top: space.lg, right: 60 },
});
