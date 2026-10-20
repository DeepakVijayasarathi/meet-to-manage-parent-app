// Enrollment form rules, ported from the web portal (features/parent/Enrollment.tsx,
// lib/schedulePreference.ts, lib/familyTime.ts) so both send the same answers JSON.
// No React Native imports: these run under `node --test`.

export const SCHEDULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAYS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
/** A group batch asks for a first and a second choice on each day; an individual batch one. */
export const GROUP_SLOTS_PER_DAY = 2;
const ACADEMY_ZONE = "Asia/Kolkata";

export type BatchType = "group" | "individual" | "";

export interface EnrollmentForm {
  childName: string;
  dob: string;
  grade: string;
  gender: string;
  schoolName: string;
  priorExperience: string;
  parentName: string;
  relationship: string;
  parentPhone: string;
  parentEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  address: string;
  courseInterest: string;
  batchType: BatchType;
  daysPerWeek: number | null;
  preferredDays: string[];
  /** Preferred start time per chosen day; a group day holds two comma-joined slots ("16:00,18:00"). */
  dayTimes: Record<string, string>;
  preferredTime: string;
  startDate: string;
  allergies: string;
  notes: string;
  consent: boolean;
}

export type FieldErrors = Partial<Record<keyof EnrollmentForm | "schedule", string>>;

export function emptyForm(childName = ""): EnrollmentForm {
  return {
    childName, dob: "", grade: "", gender: "", schoolName: "", priorExperience: "",
    parentName: "", relationship: "", parentPhone: "", parentEmail: "",
    emergencyContactName: "", emergencyContactPhone: "", address: "",
    courseInterest: "", batchType: "", daysPerWeek: null, preferredDays: [], dayTimes: {},
    preferredTime: "", startDate: "", allergies: "", notes: "", consent: false,
  };
}

// --- time zones --------------------------------------------------------------------------

/** Minutes east of UTC for `zone` at `instant` (+330 for India). */
export function zoneOffsetMinutes(zone: string, instant: Date = new Date()): number {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
    if (!m) return 0;
    const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
    return m[1] === "-" ? -minutes : minutes;
  } catch {
    return 0;
  }
}

export function isAcademyClock(zone: string | null | undefined): boolean {
  return !zone || zone === ACADEMY_ZONE || zoneOffsetMinutes(zone) === zoneOffsetMinutes(ACADEMY_ZONE);
}

export function zoneCity(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ACADEMY_ZONE;
  } catch {
    return ACADEMY_ZONE;
  }
}

// --- time slots --------------------------------------------------------------------------

function toLabel(minutesOfDay: number): string {
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function quarterHours(fromHour: number, toHour: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let m = fromHour * 60; m <= toHour * 60; m += 15) options.push({ value: hhmm(m), label: toLabel(m) });
  return options;
}

/** Group classes run 4–8 PM IST, individual 10 AM–10 PM IST, offered every 15 minutes. */
const GROUP_TIMES = quarterHours(16, 20);
const INDIVIDUAL_TIMES = quarterHours(10, 22);

/** The IST class hours shown on the family's own clock (order kept even across midnight). */
export function timeOptionsFor(batch: BatchType, zone?: string | null): { value: string; label: string }[] {
  const ist = batch === "group" ? GROUP_TIMES : INDIVIDUAL_TIMES;
  if (!zone || isAcademyClock(zone)) return ist;
  const shift = zoneOffsetMinutes(zone) - zoneOffsetMinutes(ACADEMY_ZONE);
  return ist.map((t) => {
    const [h, m] = t.value.split(":").map(Number);
    const local = (((h * 60 + m + shift) % 1440) + 1440) % 1440;
    return { value: hhmm(local), label: toLabel(local) };
  });
}

export function classHoursLabel(batch: BatchType, zone?: string | null): string {
  const options = timeOptionsFor(batch, zone);
  return `${options[0].label} – ${options[options.length - 1].label}`;
}

export function splitSlots(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function daySlotsComplete(value: string | undefined, slotsNeeded: number): boolean {
  const slots = splitSlots(value);
  return slots.length === slotsNeeded && new Set(slots).size === slots.length;
}

export function slotLabel(value: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  return m ? toLabel(Number(m[1]) * 60 + Number(m[2])) : value;
}

export function timeBucket(value: string): "morning" | "afternoon" | "evening" | "" {
  const hour = Number(value.slice(0, 2));
  if (!Number.isFinite(hour) || value === "") return "";
  if (hour < 12) return "morning";
  return hour < 16 ? "afternoon" : "evening";
}

// --- validation --------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const digits = (v: string) => v.replace(/\D/g, "");

/** 10 local digits, or up to 13 with a country code (e.g. +91 98765 43210). */
export function phoneError(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required.`;
  if (/[^\d\s()+-]/.test(value.trim())) return `${label} can only contain digits, spaces, + ( ) -.`;
  const n = digits(value).length;
  if (n < 10 || n > 13) return `Enter a valid ${label.toLowerCase()} (10 digits, or up to 13 with country code).`;
  return undefined;
}

export function validateStep(form: EnrollmentForm, step: number, now: Date = new Date()): FieldErrors {
  const e: FieldErrors = {};
  if (step === 0) {
    if (form.childName.trim().length < 2) e.childName = "Enter the student's full name.";
    if (!form.dob) e.dob = "Date of birth is required.";
    else {
      const age = (now.getTime() - new Date(form.dob).getTime()) / (365.25 * 86_400_000);
      if (Number.isNaN(age) || age < 0) e.dob = "Date of birth must be in the past.";
      else if (age < 1 || age > 18) e.dob = "The student's age must be between 1 and 18.";
    }
    if (!form.gender) e.gender = "Select a gender.";
    if (!form.grade.trim()) e.grade = "Grade / class is required.";
    if (!form.schoolName.trim()) e.schoolName = "Current school is required.";
  } else if (step === 1) {
    if (form.parentName.trim().length < 2) e.parentName = "Parent / guardian name is required.";
    if (!form.relationship) e.relationship = "Select your relationship to the student.";
    const parentPhone = phoneError(form.parentPhone, "Contact number");
    if (parentPhone) e.parentPhone = parentPhone;
    if (form.parentEmail.trim() && !EMAIL_RE.test(form.parentEmail.trim())) e.parentEmail = "Enter a valid email address.";
    if (form.emergencyContactName.trim().length < 2) e.emergencyContactName = "Emergency contact name is required.";
    const emergency = phoneError(form.emergencyContactPhone, "Emergency contact number");
    if (emergency) e.emergencyContactPhone = emergency;
    else if (!parentPhone && digits(form.emergencyContactPhone) === digits(form.parentPhone))
      e.emergencyContactPhone = "The emergency contact should be a different number from your own.";
    if (form.address.trim().length > 0 && form.address.trim().length < 10)
      e.address = "Enter the full home address (street, city, PIN), or leave it blank.";
  } else {
    const slots = form.batchType === "group" ? GROUP_SLOTS_PER_DAY : 1;
    if (!form.courseInterest) e.courseInterest = "Select a course to continue.";
    if (!form.batchType) e.batchType = "Select group or individual batch.";
    if (!form.daysPerWeek) e.schedule = "Select how many days a week you'd like classes.";
    else if (form.preferredDays.length !== form.daysPerWeek)
      e.schedule = `Choose exactly ${form.daysPerWeek} preferred day${form.daysPerWeek === 1 ? "" : "s"} (${form.preferredDays.length} selected).`;
    else if (form.preferredDays.some((d) => !daySlotsComplete(form.dayTimes[d], slots)))
      e.schedule = slots > 1 ? `Choose ${slots} different preferred time slots for each selected day.` : "Choose a preferred time for each selected day.";
    if (!form.startDate) e.startDate = "Choose the date you'd like classes to start.";
    if (!form.consent) e.consent = "Please confirm the details and give consent to submit.";
  }
  return e;
}

export const hasErrors = (e: FieldErrors) => Object.values(e).some(Boolean);

/** The answers JSON the backend stores (same shape the web form submits). */
export function toAnswers(form: EnrollmentForm, timeZoneId: string): Record<string, unknown> {
  const orderedDays = SCHEDULE_DAYS.filter((d) => form.preferredDays.includes(d));
  const earliest = orderedDays.flatMap((d) => splitSlots(form.dayTimes[d])).sort()[0] ?? "";
  return { ...form, preferredDays: orderedDays, preferredTime: timeBucket(earliest), timeZoneId };
}

/** A real email as-is; the internal mobile-login key (…@no-email.invalid) becomes "". */
export function realEmail(email: string | null | undefined): string {
  return !email || email.trim().toLowerCase().endsWith("@no-email.invalid") ? "" : email.trim();
}

/** "2026-10-20" for a Date, in local time (what the backend's date answers expect). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
