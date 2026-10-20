import { test } from "node:test";
import assert from "node:assert/strict";
import { belongsToChild, countdownLabel, groupByDay, isJoinable, isLive, monthGrid, nextClass, reminderPlan, sessionsByDay } from "./schedule.ts";
import type { ApiClassSession } from "../api/types";

test("monthGrid: whole Monday-first weeks covering the month", () => {
  const oct = monthGrid(2026, 9); // October 2026 starts on a Thursday
  assert.ok(oct.every((w) => w.length === 7));
  assert.equal(oct[0][0].key, "2026-09-28");
  assert.equal(oct[0][3].key, "2026-10-01");
  assert.equal(oct[0][3].inMonth, true);
  assert.equal(oct[0][0].inMonth, false);
  assert.equal(oct.flat().filter((d) => d.inMonth).length, 31);
});

const now = new Date("2026-10-20T10:00:00Z");
const at = (mins: number) => new Date(now.getTime() + mins * 60_000).toISOString();
const session = (over: Partial<ApiClassSession> = {}): ApiClassSession => ({
  id: "s1", batchId: "b1", batchName: "Phonics A1", teacherName: "Karan", type: "Regular", status: "Scheduled",
  scheduledStartAtUtc: at(30), scheduledEndAtUtc: at(90), cancellationReason: null, summary: null,
  childIds: ["c1"], hasRecording: false, recordingExpiresAtUtc: null, demoChildName: null, ...over,
});

test("join stays open until 3 hours after the start, matching the web portal", () => {
  assert.equal(isJoinable(session({ scheduledStartAtUtc: at(30) }), now), true);
  assert.equal(isJoinable(session({ scheduledStartAtUtc: at(-179) }), now), true);
  assert.equal(isJoinable(session({ scheduledStartAtUtc: at(-181) }), now), false);
  assert.equal(isJoinable(session({ status: "Cancelled" }), now), false);
  assert.equal(isJoinable(session({ status: "Rescheduled" }), now), false);
  assert.equal(isJoinable(session({ status: "InProgress", scheduledStartAtUtc: at(-10) }), now), true);
});

test("live means between start and end, or marked in progress", () => {
  assert.equal(isLive(session({ scheduledStartAtUtc: at(-5), scheduledEndAtUtc: at(55) }), now), true);
  assert.equal(isLive(session(), now), false);
  assert.equal(isLive(session({ status: "InProgress" }), now), true);
});

test("classes are filtered per child, demos by booked first name", () => {
  const family = [{ id: "c1", firstName: "Aarav", lastName: "Kapoor" }, { id: "c2", firstName: "Diya", lastName: "Kapoor" }];
  assert.equal(belongsToChild(session({ childIds: ["c1"] }), "c2", family), false);
  const demo = session({ childIds: [], type: "Demo", demoChildName: "Diya" });
  assert.equal(belongsToChild(demo, "c2", family), true);
  assert.equal(belongsToChild(demo, "c1", family), false);
  assert.equal(belongsToChild(session({ childIds: [], demoChildName: "Someone Else" }), "c1", family), true);
});

test("next class prefers a live one, then the soonest upcoming", () => {
  const later = session({ id: "later", scheduledStartAtUtc: at(300), scheduledEndAtUtc: at(360) });
  const soon = session({ id: "soon", scheduledStartAtUtc: at(30), scheduledEndAtUtc: at(90) });
  const done = session({ id: "done", status: "Completed", scheduledStartAtUtc: at(-120), scheduledEndAtUtc: at(-60) });
  assert.equal(nextClass([later, soon, done], now)?.id, "soon");
  const live = session({ id: "live", scheduledStartAtUtc: at(-10), scheduledEndAtUtc: at(50) });
  assert.equal(nextClass([later, soon, live], now)?.id, "live");
  assert.equal(nextClass([done], now), undefined);
});

test("countdown labels", () => {
  assert.equal(countdownLabel(session({ scheduledStartAtUtc: at(4) }), now), "Starts in 4 min");
  assert.equal(countdownLabel(session({ scheduledStartAtUtc: at(125) , scheduledEndAtUtc: at(185)}), now), "Starts in 2 h 5 min");
  assert.equal(countdownLabel(session({ scheduledStartAtUtc: at(-5), scheduledEndAtUtc: at(55) }), now), "Live now");
});

test("sessions group by day with friendly labels", () => {
  const groups = groupByDay([
    session({ id: "b", scheduledStartAtUtc: at(60 * 25) }),
    session({ id: "a", scheduledStartAtUtc: at(30) }),
  ], now);
  assert.deepEqual(groups.map((g) => [g.label, g.sessions.map((s) => s.id)]), [["Today", ["a"]], ["Tomorrow", ["b"]]]);
});

test("reminders: only future, only classes still scheduled, soonest first", () => {
  const plan = reminderPlan([
    session({ id: "far", scheduledStartAtUtc: at(600) }),
    session({ id: "near", scheduledStartAtUtc: at(30) }),
    session({ id: "past", scheduledStartAtUtc: at(5) }),
    session({ id: "cancelled", status: "Cancelled", scheduledStartAtUtc: at(120) }),
  ], 10, now);
  assert.deepEqual(plan.map((p) => p.sessionId), ["near", "far"]);
  assert.equal(plan[0].at.toISOString(), at(20));
});

test("sessionsByDay: groups by local day in start order", () => {
  const a = session({ id: "a", scheduledStartAtUtc: at(120) });
  const b = session({ id: "b", scheduledStartAtUtc: at(30) });
  const days = sessionsByDay([a, b]);
  const key = Object.keys(days)[0];
  assert.deepEqual(days[key].map((s) => s.id), ["b", "a"]);
});
