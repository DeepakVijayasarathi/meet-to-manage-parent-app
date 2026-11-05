import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getChildren, getSchedulePreference, saveSchedulePreference } from "@/api/parent";
import type { ApiSchedulePreference } from "@/api/types";
import { Field, Pills, SelectField } from "@/components/form";
import { Button, Card, Chips, EmptyState, ErrorCard, Screen, Skeleton } from "@/components/ui";
import { DAYS_PER_WEEK_OPTIONS, GROUP_SLOTS_PER_DAY, SCHEDULE_DAYS, classHoursLabel, deviceTimeZone, isAcademyClock, splitSlots, timeOptionsFor, zoneCity } from "@/lib/enrollment";
import { space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

/**
 * Change a child's preferred class days and times after enrolling. The academy's team still confirms the actual
 * timetable; this saves what the family would like, using the same endpoint as the web portal's schedule form.
 */
export default function SchedulePreference() {
  const session = useRequiredSession();
  const params = useLocalSearchParams<{ childId?: string }>();
  const children = useQuery({ queryKey: ["children", session.token], queryFn: () => getChildren(session.token) });
  const family = (children.data ?? []).filter((c) => c.isActive);
  const [picked, setPicked] = useState<string | null>(params.childId ?? null);
  const childId = picked && family.some((c) => c.id === picked) ? picked : family[0]?.id;

  const preference = useQuery({
    queryKey: ["schedule-preference", session.token, childId],
    queryFn: () => getSchedulePreference(session.token, childId!),
    enabled: !!childId,
  });

  return (
    <Screen refreshing={preference.isRefetching} onRefresh={() => preference.refetch()}>
      {family.length > 1 && <Chips options={family.map((c) => ({ value: c.id, label: c.firstName }))} value={childId ?? ""} onChange={setPicked} />}
      {children.isPending || (preference.isPending && !!childId) ? <View style={{ gap: space.md }}><Skeleton height={80} /><Skeleton height={200} /></View>
        : children.isError ? <ErrorCard message={errorMessage(children.error)} onRetry={() => children.refetch()} />
        : preference.isError ? <ErrorCard message={errorMessage(preference.error)} onRetry={() => preference.refetch()} />
        : !preference.data ? <Card><EmptyState icon="clock" title="No children yet" description="Preferences can be set once a child is enrolled." /></Card>
        // Keyed by child so switching children starts from that child's saved values, not the previous one's edits.
        : <PreferenceForm key={preference.data.childId} data={preference.data} />}
    </Screen>
  );
}

function PreferenceForm({ data }: { data: ApiSchedulePreference }) {
  const colors = useColors();
  const session = useRequiredSession();
  const queryClient = useQueryClient();
  // The zone the family's times are shown in: the saved one, else this phone's own.
  const zone = data.timeZoneId || deviceTimeZone();
  const [days, setDays] = useState<string[]>(data.preferredDays);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(data.daysPerWeek ?? (data.preferredDays.length || null));
  const [times, setTimes] = useState<Record<string, string>>(data.dayTimes);
  // A group class asks for a first and second choice per day; keep whatever the family already has.
  const slotsPerDay = Math.min(GROUP_SLOTS_PER_DAY, Math.max(1, ...Object.values(data.dayTimes).map((v) => splitSlots(v).length)));
  const options = timeOptionsFor(slotsPerDay > 1 ? "group" : "individual", zone);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const touch = () => { setSaved(false); setError(null); };
  const chooseCount = (count: number) => {
    const kept = days.slice(0, count);
    setDaysPerWeek(count);
    setDays(kept);
    setTimes((t) => Object.fromEntries(Object.entries(t).filter(([d]) => kept.includes(d))));
    touch();
  };
  const toggleDay = (day: string) => {
    if (days.includes(day)) {
      setDays(days.filter((d) => d !== day));
      setTimes((t) => Object.fromEntries(Object.entries(t).filter(([d]) => d !== day)));
    } else if (daysPerWeek !== null && days.length < daysPerWeek) setDays([...days, day]);
    touch();
  };
  const setSlot = (day: string, slot: number, time: string) => {
    setTimes((t) => {
      const slots = splitSlots(t[day]);
      slots[slot] = time;
      return { ...t, [day]: Array.from({ length: Math.max(slots.length, slot + 1) }, (_, i) => slots[i] ?? "").join(",") };
    });
    touch();
  };

  const ordered = SCHEDULE_DAYS.filter((d) => days.includes(d));
  const complete = daysPerWeek !== null && ordered.length === daysPerWeek
    && ordered.every((d) => { const s = splitSlots(times[d]); return s.length === slotsPerDay && s.every(Boolean) && new Set(s).size === s.length; });

  const save = useMutation({
    mutationFn: () => {
      // A start date already in the past would be rejected, and it no longer matters for an enrolled child.
      const start = data.preferredStartDate && data.preferredStartDate >= new Date().toISOString().slice(0, 10) ? data.preferredStartDate : null;
      return saveSchedulePreference(session.token, data.childId, {
        courseId: data.courseId, preferredStartDate: start, daysPerWeek: daysPerWeek!, preferredDays: ordered,
        dayTimes: Object.fromEntries(ordered.map((d) => [d, splitSlots(times[d]).join(",")])), timeZoneId: zone,
        schoolName: data.schoolName, grade: data.grade, dateOfBirth: data.dateOfBirth, gender: data.gender,
        priorExperience: data.priorExperience, allergies: data.allergies, notes: data.notes,
      });
    },
    onSuccess: () => { setSaved(true); void queryClient.invalidateQueries({ queryKey: ["schedule-preference", session.token] }); },
    onError: (e) => setError(errorMessage(e)),
  });

  const first = data.childName.split(" ")[0];
  return (
    <View style={styles.form}>
      <Card style={{ gap: space.xs }}>
        <Text style={[type.heading, { color: colors.text }]}>{first}&apos;s preferred schedule</Text>
        <Text style={[type.caption, { color: colors.muted }]}>
          {data.courseName ? `${data.courseName}. ` : ""}Tell us the days and times that suit you. Our team will confirm the final timetable and let you know.
        </Text>
      </Card>

      <Card style={styles.section}>
      <Field label="How many days per week?">
        <Pills options={DAYS_PER_WEEK_OPTIONS.map((n) => ({ value: n, label: `${n} day${n === 1 ? "" : "s"}` }))} value={daysPerWeek} onChange={chooseCount} />
      </Field>

      {daysPerWeek !== null && (
        <Field label={`Preferred days (${days.length} of ${daysPerWeek})`}>
          <Pills options={SCHEDULE_DAYS.map((d) => ({ value: d as string, label: d }))} value={days} onChange={toggleDay} disabled={() => days.length >= daysPerWeek} />
        </Field>
      )}
      </Card>

      {ordered.length > 0 && (
        <Card style={styles.section}>
          <Text style={[type.label, { color: colors.textSoft }]}>{slotsPerDay > 1 ? "First and second choice for each day" : "Preferred time for each day"}</Text>
          {!isAcademyClock(zone) && (
            <Text style={[type.caption, { color: colors.muted }]}>Times are in your local time ({zoneCity(zone)}). Classes run {classHoursLabel(slotsPerDay > 1 ? "group" : "individual", zone)} for you.</Text>
          )}
          {ordered.map((d) => {
            const current = splitSlots(times[d]);
            return (
              <View key={d} style={styles.dayRow}>
                <Text style={[styles.dayName, { color: colors.text }]}>{d}</Text>
                <View style={{ flex: 1, gap: space.sm }}>
                  {Array.from({ length: slotsPerDay }, (_, i) => (
                    <SelectField
                      key={i}
                      title={slotsPerDay > 1 ? `${d} · ${i === 0 ? "first" : "second"} choice` : `${d} · preferred time`}
                      placeholder={slotsPerDay > 1 ? `${i === 0 ? "1st" : "2nd"} choice` : "Select time"}
                      value={current[i] ?? ""}
                      options={options}
                      onChange={(v) => setSlot(d, i, v)}
                      disabled={(v) => current.some((s, j) => j !== i && s === v)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {error && <Text style={[type.label, { color: colors.danger }]} accessibilityRole="alert">{error}</Text>}
      {saved && <Text style={[type.label, { color: colors.success }]} accessibilityRole="alert">Saved. Our team will confirm the timetable with you.</Text>}
      <View style={{ gap: space.md }}>
        <Button label="Save preferences" icon="check" onPress={() => save.mutate()} disabled={!complete} loading={save.isPending} />
        {!complete && <Text style={[type.caption, { color: colors.muted, textAlign: "center" }]}>Pick the days and a time for each to save.</Text>}
        <Text style={[type.caption, { color: colors.muted, textAlign: "center", paddingHorizontal: space.md }]}>To move a single class instead, open it from Classes and choose &quot;Request a reschedule&quot;.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl },
  section: { gap: space.xl },
  dayRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  dayName: { width: 40, paddingTop: 14, fontSize: 15, fontWeight: "700" },
});
