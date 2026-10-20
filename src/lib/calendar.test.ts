import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarMonths,
  buildMonthGrid,
  calendarMonthLabel,
  calendarMonthStart,
  localDateKey,
  sessionsForDate,
} from "./calendar.ts";

test("local date keys are zero-padded and do not convert through UTC", () => {
  assert.equal(localDateKey(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
});

test("month grid is a stable Sunday-first 6x7 calendar", () => {
  const days = buildMonthGrid(new Date(2026, 9, 20, 12), new Date(2026, 9, 20, 8));

  assert.equal(days.length, 42);
  assert.equal(days[0].key, "2026-09-27");
  assert.equal(days[4].key, "2026-10-01");
  assert.equal(days[41].key, "2026-11-07");
  assert.equal(days.filter((day) => day.inMonth).length, 31);
  assert.deepEqual(days.filter((day) => day.isToday).map((day) => day.key), ["2026-10-20"]);
});

test("month helpers step safely across year and short-month boundaries", () => {
  const january = addCalendarMonths(new Date(2026, 11, 31, 12), 1);
  const february = calendarMonthStart(new Date(2028, 1, 29, 12));

  assert.equal(localDateKey(january), "2027-01-01");
  assert.equal(localDateKey(february), "2028-02-01");
  assert.equal(calendarMonthLabel(february, "en-US"), "February 2028");
  assert.equal(buildMonthGrid(february).filter((day) => day.inMonth).length, 29);
});

test("selected-day sessions use local dates, sort by start, and leave input untouched", () => {
  const early = { id: "early", scheduledStartAtUtc: new Date(2026, 9, 20, 9).toISOString() };
  const late = { id: "late", scheduledStartAtUtc: new Date(2026, 9, 20, 17).toISOString() };
  const other = { id: "other", scheduledStartAtUtc: new Date(2026, 9, 21, 8).toISOString() };
  const sessions = [late, other, early];

  assert.deepEqual(sessionsForDate(sessions, "2026-10-20").map((session) => session.id), ["early", "late"]);
  assert.deepEqual(sessions.map((session) => session.id), ["late", "other", "early"]);
});
