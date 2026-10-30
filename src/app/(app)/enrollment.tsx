import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";
import { getCourseOptions, getMyAccount, submitEnrollment } from "@/api/parent";
import { KeyboardSafe } from "@/components/keyboard";
import { CheckRow, DateField, Field, Pills, SelectField, Stepper, TextField } from "@/components/form";
import { Button, Card, IconTile } from "@/components/ui";
import {
  DAYS_PER_WEEK_OPTIONS, GROUP_SLOTS_PER_DAY, SCHEDULE_DAYS, classHoursLabel, deviceTimeZone, emptyForm, hasErrors,
  isAcademyClock, realEmail, slotLabel, splitSlots, timeOptionsFor, toAnswers, validateStep, zoneCity,
  type BatchType, type EnrollmentForm, type FieldErrors,
} from "@/lib/enrollment";
import { useChildren } from "@/lib/queries";
import { fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

const STEPS = ["Student details", "Parent & contact", "Course & consent"] as const;

/**
 * The mandatory enrollment form, native. Same fields, rules and answers JSON as the web
 * portal's /parent/enrollment. `?childId=` fills in preferences for a child the academy
 * already created instead of registering a new one.
 */
export default function Enrollment() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const session = useRequiredSession();
  const queryClient = useQueryClient();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  const children = useChildren();
  const existing = children.data?.find((c) => c.id === childId);
  const account = useQuery({ queryKey: ["account", session.token], queryFn: () => getMyAccount(session.token) });
  const courses = useQuery({ queryKey: ["course-options", session.token], queryFn: () => getCourseOptions(session.token) });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EnrollmentForm>(() => ({ ...emptyForm(), parentName: session.userName }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const zone = account.data?.timeZoneId || deviceTimeZone();
  const slotsPerDay = form.batchType === "group" ? GROUP_SLOTS_PER_DAY : 1;
  const times = useMemo(() => timeOptionsFor(form.batchType, zone), [form.batchType, zone]);

  // Prefill blank fields once after account and child data arrives. Keeping this
  // outside the render pass avoids a discarded frame on slower Android devices.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (prefilled || account.isPending || children.isPending) return;
    const a = account.data;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefilled(true);
    setForm((f) => ({
      ...f,
      childName: f.childName || (existing ? `${existing.firstName} ${existing.lastName}`.trim() : ""),
      parentName: f.parentName || a?.fullName || "",
      parentPhone: f.parentPhone || a?.phone || "",
      parentEmail: f.parentEmail || realEmail(a?.email),
    }));
  }, [account.data, account.isPending, children.isPending, existing, prefilled]);

  const submit = useMutation({
    mutationFn: () => submitEnrollment(session.token, toAnswers(form, zone), existing?.id),
    onSuccess: () => {
      for (const key of ["dashboard", "children", "schedule", "schedule-month"]) void queryClient.invalidateQueries({ queryKey: [key, session.token] });
    },
  });

  function update<K extends keyof EnrollmentForm>(key: K, value: EnrollmentForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }
  const clearSchedule = () => setErrors((e) => (e.schedule ? { ...e, schedule: undefined } : e));

  function go(next: number) {
    setStep(next);
    scroller.current?.scrollTo({ y: 0, animated: true });
  }

  function onNext() {
    const e = validateStep(form, step);
    setErrors(e);
    if (!hasErrors(e)) go(step + 1);
  }

  function onSubmit() {
    // Back-and-edit can invalidate an earlier step: re-check all of them.
    for (const target of [0, 1, 2]) {
      const e = validateStep(form, target);
      if (hasErrors(e)) { setErrors(e); go(target); return; }
    }
    submit.mutate();
  }

  function pickCourse(id: string) {
    const course = courses.data?.find((c) => c.id === id);
    const type: BatchType = course?.type === "Individual" ? "individual" : course ? "group" : "";
    setForm((f) => ({ ...f, courseInterest: id, batchType: f.batchType || type }));
    setErrors((e) => ({ ...e, courseInterest: undefined }));
  }

  function setBatchType(next: "group" | "individual") {
    setForm((f) => {
      if (f.batchType === next) return f;
      const allowed = new Set(timeOptionsFor(next, zone).map((t) => t.value));
      const max = next === "group" ? GROUP_SLOTS_PER_DAY : 1;
      const dayTimes = Object.fromEntries(Object.entries(f.dayTimes)
        .map(([d, v]) => [d, splitSlots(v).filter((t) => allowed.has(t)).slice(0, max).join(",")] as const)
        .filter(([, v]) => v));
      return { ...f, batchType: next, dayTimes };
    });
    setErrors((e) => ({ ...e, batchType: undefined, schedule: undefined }));
  }

  function setDaysPerWeek(count: number) {
    setForm((f) => {
      const days = f.preferredDays.slice(0, count);
      return { ...f, daysPerWeek: count, preferredDays: days, dayTimes: Object.fromEntries(Object.entries(f.dayTimes).filter(([d]) => days.includes(d))) };
    });
    clearSchedule();
  }

  function toggleDay(day: string) {
    setForm((f) => {
      if (f.preferredDays.includes(day)) {
        const { [day]: _removed, ...rest } = f.dayTimes;
        return { ...f, preferredDays: f.preferredDays.filter((d) => d !== day), dayTimes: rest };
      }
      if (f.daysPerWeek !== null && f.preferredDays.length >= f.daysPerWeek) return f;
      return { ...f, preferredDays: [...f.preferredDays, day] };
    });
    clearSchedule();
  }

  function setDayTime(day: string, slot: number, time: string) {
    setForm((f) => {
      const slots = splitSlots(f.dayTimes[day]);
      slots[slot] = time;
      const filled = Array.from({ length: Math.max(slots.length, slot + 1) }, (_, i) => slots[i] ?? "");
      return { ...f, dayTimes: { ...f.dayTimes, [day]: filled.join(",") } };
    });
    clearSchedule();
  }

  const firstName = (existing?.firstName ?? form.childName.trim().split(" ")[0]) || "your child";

  if (submit.isSuccess) {
    return (
      <View style={[styles.done, { backgroundColor: colors.background, paddingBottom: insets.bottom + space.xl }]}>
        <Stack.Screen options={{ title: "Enrollment" }} />
        <IconTile icon="check-circle" tone="success" size={72} />
        <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{firstName}&apos;s enrollment is submitted!</Text>
        <Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>
          Our team will use your preferred days and times to set up the class schedule. You&apos;ll get an update as soon as classes are booked.
        </Text>
        <Button label="Go to home" icon="home" onPress={() => router.dismissTo("/")} style={{ alignSelf: "stretch", marginTop: space.lg }} />
      </View>
    );
  }

  return (
    <KeyboardSafe style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: existing ? `${existing.firstName}'s preferences` : "Enrollment" }} />
      <ScrollView ref={scroller} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>
            {existing ? `Share ${existing.firstName}'s class preferences` : "Complete your child's enrollment"}
          </Text>
          <Text style={[type.body, { color: colors.muted }]}>
            {existing ? "Preferred days, timings and school details help us set up the class schedule." : "A few quick details unlock classes, attendance, resources and billing."}
          </Text>
        </View>

        <Stepper steps={STEPS} current={step} />

        {step === 0 && (
          <Card style={styles.section}>
            <Field label="Student's full name" required error={errors.childName}>
              <TextField value={form.childName} onChangeText={(v) => update("childName", v)} placeholder="e.g. Aarav Kapoor" autoCapitalize="words" error={!!errors.childName} />
            </Field>
            <Field label="Date of birth" required error={errors.dob}>
              <DateField value={form.dob} onChange={(v) => update("dob", v)} placeholder="Select date of birth" maximumDate={new Date()} error={!!errors.dob} />
            </Field>
            <Field label="Gender" required error={errors.gender}>
              <Pills options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }]} value={form.gender} onChange={(v) => update("gender", v)} />
            </Field>
            <Field label="Grade / class" required error={errors.grade}>
              <TextField value={form.grade} onChangeText={(v) => update("grade", v)} placeholder="e.g. Pre-K, Grade 2" error={!!errors.grade} />
            </Field>
            <Field label="Current school" required error={errors.schoolName}>
              <TextField value={form.schoolName} onChangeText={(v) => update("schoolName", v)} placeholder="e.g. Green Valley School" autoCapitalize="words" error={!!errors.schoolName} />
            </Field>
            <Field label="Prior experience in this subject">
              <Pills
                options={[{ value: "none", label: "Complete beginner" }, { value: "some", label: "Some exposure" }, { value: "confident", label: "Confident" }]}
                value={form.priorExperience}
                onChange={(v) => update("priorExperience", form.priorExperience === v ? "" : v)}
              />
            </Field>
          </Card>
        )}

        {step === 1 && (
          <Card style={styles.section}>
            <Field label="Parent / guardian name" required error={errors.parentName}>
              <TextField value={form.parentName} onChangeText={(v) => update("parentName", v)} placeholder="e.g. Priya Kapoor" autoCapitalize="words" error={!!errors.parentName} />
            </Field>
            <Field label="Relationship to student" required error={errors.relationship}>
              <Pills
                options={[{ value: "mother", label: "Mother" }, { value: "father", label: "Father" }, { value: "guardian", label: "Guardian" }, { value: "other", label: "Other" }]}
                value={form.relationship}
                onChange={(v) => update("relationship", v)}
              />
            </Field>
            <Field label="Contact number" required error={errors.parentPhone}>
              <TextField value={form.parentPhone} onChangeText={(v) => update("parentPhone", v)} placeholder="+91 98765 43210" keyboardType="phone-pad" autoComplete="tel" error={!!errors.parentPhone} />
            </Field>
            <Field label="Email (optional)" error={errors.parentEmail}>
              <TextField value={form.parentEmail} onChangeText={(v) => update("parentEmail", v)} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={!!errors.parentEmail} />
            </Field>
            <Field label="Emergency contact name" required error={errors.emergencyContactName}>
              <TextField value={form.emergencyContactName} onChangeText={(v) => update("emergencyContactName", v)} placeholder="Another guardian / relative" autoCapitalize="words" error={!!errors.emergencyContactName} />
            </Field>
            <Field label="Emergency contact number" required error={errors.emergencyContactPhone}>
              <TextField value={form.emergencyContactPhone} onChangeText={(v) => update("emergencyContactPhone", v)} placeholder="+91 98765 43210" keyboardType="phone-pad" error={!!errors.emergencyContactPhone} />
            </Field>
            <Field label="Home address (optional)" error={errors.address}>
              <TextField value={form.address} onChangeText={(v) => update("address", v)} placeholder="Street, city, state, PIN" multiline error={!!errors.address} />
            </Field>
          </Card>
        )}

        {step === 2 && (
          <>
            <Card style={styles.section}>
              <Field label="Course of interest" required error={errors.courseInterest}>
                <View style={{ gap: space.sm }}>
                  {(courses.data ?? []).map((c) => {
                    const active = form.courseInterest === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => pickCourse(c.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        style={[styles.course, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }]}
                      >
                        <View style={[styles.radio, { borderColor: active ? colors.primary : colors.muted }]}>
                          {active && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                        </View>
                        <Text style={[type.label, { color: colors.text, flex: 1, fontSize: 15 }]}>{c.name}</Text>
                        <Text style={[type.caption, { color: colors.muted }]}>{c.type === "Individual" ? "1:1" : "Group"}</Text>
                      </Pressable>
                    );
                  })}
                  {courses.isPending && <Text style={[type.caption, { color: colors.muted }]}>Loading courses…</Text>}
                  {courses.isError && <Text style={[type.caption, { color: colors.danger }]}>{errorMessage(courses.error)}</Text>}
                </View>
              </Field>
              <Field label="Batch type" required error={errors.batchType} hint="Group learns alongside other students; Individual is one-on-one with the teacher.">
                <Pills options={[{ value: "group" as const, label: "Group batch" }, { value: "individual" as const, label: "Individual batch" }]} value={form.batchType || null} onChange={setBatchType} />
              </Field>
            </Card>

            <Card style={styles.section}>
              <View style={{ gap: 4 }}>
                <Text style={[type.heading, { color: colors.text }]}>Schedule preference</Text>
                <Text style={[type.caption, { color: colors.muted, fontSize: 13 }]}>Tell us when you&apos;d like classes so our team can set up the schedule without calling you.</Text>
              </View>
              <Field label="How many days per week?" required>
                <Pills options={DAYS_PER_WEEK_OPTIONS.map((n) => ({ value: n, label: `${n} day${n === 1 ? "" : "s"}` }))} value={form.daysPerWeek} onChange={setDaysPerWeek} />
              </Field>
              {form.daysPerWeek !== null && (
                <Field label={`Preferred days (${form.preferredDays.length} of ${form.daysPerWeek})`}>
                  <Pills
                    options={SCHEDULE_DAYS.map((d) => ({ value: d as string, label: d }))}
                    value={form.preferredDays}
                    onChange={toggleDay}
                    disabled={() => form.preferredDays.length >= (form.daysPerWeek ?? 0)}
                  />
                </Field>
              )}
              {form.preferredDays.length > 0 && (
                <View style={{ gap: space.md }}>
                  <Text style={[type.label, { color: colors.textSoft }]}>
                    {slotsPerDay > 1 ? `${slotsPerDay} preferred time slots for each day` : "Preferred time for each day"}
                  </Text>
                  {!isAcademyClock(zone) && (
                    <Text style={[type.caption, { color: colors.muted, fontSize: 13 }]}>
                      Times are in your local time ({zoneCity(zone)}). Classes run {classHoursLabel(form.batchType, "Asia/Kolkata")} India time, which is {classHoursLabel(form.batchType, zone)} for you.
                    </Text>
                  )}
                  {SCHEDULE_DAYS.filter((d) => form.preferredDays.includes(d)).map((d) => (
                    <View key={d} style={styles.dayRow}>
                      <Text style={[styles.dayName, { color: colors.text }]}>{d}</Text>
                      <View style={{ flex: 1, gap: space.sm }}>
                        {Array.from({ length: slotsPerDay }, (_, i) => {
                          const current = splitSlots(form.dayTimes[d]);
                          return (
                            <SelectField
                              key={i}
                              title={slotsPerDay > 1 ? `${d} · ${i === 0 ? "first" : "second"} choice` : `${d} · preferred time`}
                              placeholder={slotsPerDay > 1 ? `${i === 0 ? "1st" : "2nd"} choice` : "Select time"}
                              value={current[i] ?? ""}
                              options={times}
                              onChange={(v) => setDayTime(d, i, v)}
                              disabled={(v) => current.some((s, j) => j !== i && s === v)}
                            />
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {errors.schedule && <Text style={[type.caption, { color: colors.danger }]} accessibilityRole="alert">{errors.schedule}</Text>}
            </Card>

            <Card style={styles.section}>
              <Field label="Preferred start date" required error={errors.startDate}>
                <DateField value={form.startDate} onChange={(v) => update("startDate", v)} placeholder="When should classes start?" minimumDate={new Date()} error={!!errors.startDate} />
              </Field>
              <Field label="Allergies or medical notes (optional)">
                <TextField value={form.allergies} onChangeText={(v) => update("allergies", v)} placeholder="e.g. None, or specify allergies" multiline />
              </Field>
              <Field label="Anything else we should know? (optional)">
                <TextField value={form.notes} onChangeText={(v) => update("notes", v)} placeholder="Learning style, goals…" multiline />
              </Field>
              <CheckRow checked={form.consent} onChange={(v) => update("consent", v)} error={!!errors.consent}>
                I confirm the details above are correct, and I consent to my child attending online classes that may be recorded for learning and quality purposes, per Meet to Manage&apos;s terms.
              </CheckRow>
              {errors.consent && <Text style={[type.caption, { color: colors.danger }]}>{errors.consent}</Text>}
            </Card>

            {form.preferredDays.length > 0 && (
              <Card style={[styles.summary, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
                <Feather name="calendar" size={16} color={colors.primaryInk} />
                <Text style={[type.caption, { color: colors.primaryInk, flex: 1, fontSize: 13 }]}>
                  {SCHEDULE_DAYS.filter((d) => form.preferredDays.includes(d))
                    .map((d) => `${d} ${splitSlots(form.dayTimes[d]).map(slotLabel).join(" / ") || "—"}`).join(" · ")}
                </Text>
              </Card>
            )}
          </>
        )}

        {submit.isError && <Text style={[type.label, { color: colors.danger }]} accessibilityRole="alert">{errorMessage(submit.error, "Could not submit the form. Please try again.")}</Text>}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Button label="Back" variant="secondary" onPress={() => go(step - 1)} disabled={step === 0} style={{ flex: 1 }} />
        {step < STEPS.length - 1
          ? <Button label="Next" icon="arrow-right" onPress={onNext} style={{ flex: 2 }} />
          : <Button label="Submit" icon="check" onPress={onSubmit} loading={submit.isPending} style={{ flex: 2 }} />}
      </View>
    </KeyboardSafe>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  section: { gap: space.xl },
  course: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  dayRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  dayName: { width: 44, fontFamily: fonts.bold, fontSize: 15, paddingTop: 15 },
  summary: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  bar: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  done: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.md },
});
