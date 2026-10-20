import { test } from "node:test";
import assert from "node:assert/strict";
import { daySlotsComplete, emptyForm, phoneError, realEmail, timeOptionsFor, toAnswers, validateStep } from "./enrollment.ts";

const now = new Date("2026-10-20T10:00:00Z");

test("student step requires the web form's fields and a 1-18 age", () => {
  const e = validateStep({ ...emptyForm(), dob: "2026-01-01" }, 0, now);
  assert.equal(e.childName, "Enter the student's full name.");
  assert.equal(e.dob, "The student's age must be between 1 and 18.");
  assert.ok(e.gender && e.grade && e.schoolName);
  const ok = validateStep({ ...emptyForm("Aarav Kapoor"), dob: "2018-05-01", gender: "male", grade: "Grade 2", schoolName: "Green Valley" }, 0, now);
  assert.deepEqual(ok, {});
});

test("contact step rejects a duplicate emergency number and bad phones", () => {
  assert.match(phoneError("12345", "Contact number")!, /valid contact number/);
  assert.equal(phoneError("+91 98765 43210", "Contact number"), undefined);
  const e = validateStep({ ...emptyForm(), parentName: "Priya", relationship: "mother", parentPhone: "9876543210", emergencyContactName: "Ravi", emergencyContactPhone: "98765 43210" }, 1, now);
  assert.equal(e.emergencyContactPhone, "The emergency contact should be a different number from your own.");
});

test("group batches need two distinct slots on every chosen day", () => {
  assert.equal(daySlotsComplete("16:00,16:00", 2), false);
  assert.equal(daySlotsComplete("16:00,18:00", 2), true);
  const form = { ...emptyForm(), courseInterest: "c1", batchType: "group" as const, daysPerWeek: 1, preferredDays: ["Mon"], dayTimes: { Mon: "16:00" }, startDate: "2026-11-01", consent: true };
  assert.equal(validateStep(form, 2, now).schedule, "Choose 2 different preferred time slots for each selected day.");
  assert.deepEqual(validateStep({ ...form, dayTimes: { Mon: "16:00,18:00" } }, 2, now), {});
});

test("class hours shift onto a family's own clock", () => {
  assert.equal(timeOptionsFor("group", "Asia/Kolkata")[0].label, "4:00 PM");
  assert.equal(timeOptionsFor("group", "Asia/Kolkata").length, 17);
  assert.equal(timeOptionsFor("group", "Asia/Dubai")[0].label, "2:30 PM");
});

test("answers keep week order, the legacy time bucket and the zone", () => {
  const answers = toAnswers({ ...emptyForm(), preferredDays: ["Thu", "Mon"], dayTimes: { Thu: "18:00", Mon: "16:30" } }, "Asia/Kolkata");
  assert.deepEqual(answers.preferredDays, ["Mon", "Thu"]);
  assert.equal(answers.preferredTime, "evening");
  assert.equal(answers.timeZoneId, "Asia/Kolkata");
});

test("mobile-login placeholder emails are never prefilled", () => {
  assert.equal(realEmail("98765@no-email.invalid"), "");
  assert.equal(realEmail(" a@b.com "), "a@b.com");
});
