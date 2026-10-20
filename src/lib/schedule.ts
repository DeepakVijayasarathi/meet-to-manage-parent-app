// Pure class-schedule rules (no React Native imports, so they run under `node --test`).
import type { ApiClassSession, ApiParentChild } from "../api/types";

/** Mirrors the web portal (features/parent/utils.ts): Join stays open until 3 hours after the
 *  scheduled start; the backend's /jitsi-join check is the real gate. */
export const JOIN_GRACE_MINUTES = 3 * 60;

const JOINABLE: ApiClassSession["status"][] = ["Scheduled", "InProgress", "CarriedForward"];

export function isJoinable(s: ApiClassSession, now: Date = new Date()): boolean {
  if (!JOINABLE.includes(s.status)) return false;
  const start = new Date(s.scheduledStartAtUtc).getTime();
  return now.getTime() < start + JOIN_GRACE_MINUTES * 60_000;
}

/** The class is happening right now (between scheduled start and end, or marked in progress). */
export function isLive(s: ApiClassSession, now: Date = new Date()): boolean {
  if (s.status === "InProgress") return true;
  if (!JOINABLE.includes(s.status)) return false;
  const t = now.getTime();
  return t >= new Date(s.scheduledStartAtUtc).getTime() && t <= new Date(s.scheduledEndAtUtc).getTime();
}

/**
 * Whether a class belongs to this child (web: lib/sessionForChild.ts). Batch classes list the
 * family's children; a demo has none and is matched by the booked child's first name.
 */
export function belongsToChild(s: ApiClassSession, childId: string, family: Pick<ApiParentChild, "id" | "firstName" | "lastName">[]): boolean {
  if (s.childIds && s.childIds.length > 0) return s.childIds.includes(childId);
  const demo = s.demoChildName?.trim().toLowerCase();
  if (!demo) return true;
  const first = (n: string) => n.trim().toLowerCase().split(/\s+/)[0] ?? "";
  const match = family.find((c) => {
    const full = `${c.firstName} ${c.lastName}`.trim().toLowerCase();
    return full === demo || first(full) === first(demo);
  });
  return match ? match.id === childId : true;
}

/** Next class to show on Home: the live one, else the soonest still joinable or upcoming. */
export function nextClass(sessions: ApiClassSession[], now: Date = new Date()): ApiClassSession | undefined {
  const live = sessions.find((s) => isLive(s, now));
  if (live) return live;
  return [...sessions]
    .filter((s) => JOINABLE.includes(s.status) && new Date(s.scheduledEndAtUtc).getTime() > now.getTime())
    .sort((a, b) => a.scheduledStartAtUtc.localeCompare(b.scheduledStartAtUtc))[0];
}

/** "Starts in 2 h 5 min", "Starts in 4 min", "Live now", "Started 12 min ago". */
export function countdownLabel(s: ApiClassSession, now: Date = new Date()): string {
  if (isLive(s, now)) return "Live now";
  const mins = Math.round((new Date(s.scheduledStartAtUtc).getTime() - now.getTime()) / 60_000);
  if (mins < 0) return `Started ${-mins} min ago`;
  if (mins < 1) return "Starting now";
  if (mins < 60) return `Starts in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `Starts in ${h} h ${m} min` : `Starts in ${h} h`;
  const days = Math.round(h / 24);
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

export type DayGroup = { key: string; label: string; sessions: ApiClassSession[] };

/** Groups sessions by local calendar day, in order, with Today/Tomorrow/Yesterday labels. */
export function groupByDay(sessions: ApiClassSession[], now: Date = new Date(), descending = false): DayGroup[] {
  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const sorted = [...sessions].sort((a, b) =>
    descending ? b.scheduledStartAtUtc.localeCompare(a.scheduledStartAtUtc) : a.scheduledStartAtUtc.localeCompare(b.scheduledStartAtUtc)
  );
  const groups: DayGroup[] = [];
  for (const s of sorted) {
    const d = new Date(s.scheduledStartAtUtc);
    const key = dayKey(d);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const label =
        key === today ? "Today" : key === tomorrow ? "Tomorrow" : key === yesterday ? "Yesterday"
          : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
      g = { key, label, sessions: [] };
      groups.push(g);
    }
    g.sessions.push(s);
  }
  return groups;
}

/** Local reminder times for upcoming classes: `leadMinutes` before each start, future only. */
export function reminderPlan(sessions: ApiClassSession[], leadMinutes: number, now: Date = new Date()): { sessionId: string; at: Date }[] {
  return sessions
    .filter((s) => s.status === "Scheduled" || s.status === "CarriedForward")
    .map((s) => ({ sessionId: s.id, at: new Date(new Date(s.scheduledStartAtUtc).getTime() - leadMinutes * 60_000) }))
    .filter((r) => r.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function timeRange(s: ApiClassSession): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${new Date(s.scheduledStartAtUtc).toLocaleTimeString(undefined, opts)} – ${new Date(s.scheduledEndAtUtc).toLocaleTimeString(undefined, opts)}`;
}

export function classTitle(s: ApiClassSession): string {
  return s.batchName ?? (s.type === "Demo" ? "Demo class" : "Class");
}

/** "2026-10-20" for a date in local time. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface CalendarDay { key: string; date: Date; inMonth: boolean }

/** A month as whole weeks (Monday first), padded with the neighbouring months' days. */
export function monthGrid(year: number, month: number): CalendarDay[][] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const lastDay = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((offset + lastDay) / 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(year, month, 1 - offset + w * 7 + d);
      return { key: localDayKey(date), date, inMonth: date.getMonth() === ((month % 12) + 12) % 12 };
    }),
  );
}

/** Classes per local day, each day's list in start-time order. */
export function sessionsByDay(sessions: ApiClassSession[]): Record<string, ApiClassSession[]> {
  const out: Record<string, ApiClassSession[]> = {};
  for (const s of [...sessions].sort((a, b) => a.scheduledStartAtUtc.localeCompare(b.scheduledStartAtUtc))) {
    (out[localDayKey(new Date(s.scheduledStartAtUtc))] ??= []).push(s);
  }
  return out;
}

/** Web's default parent.cancelCutoffMinutes; the backend enforces the academy's real policy. */
export const CANCEL_CUTOFF_MINUTES = 60;

/** Parents may cancel only an upcoming batch class, not a demo or one about to start. */
export function canParentCancel(s: ApiClassSession, now: Date = new Date()): boolean {
  const minutesAhead = (new Date(s.scheduledStartAtUtc).getTime() - now.getTime()) / 60_000;
  return s.status === "Scheduled" && !!s.batchId && minutesAhead >= CANCEL_CUTOFF_MINUTES;
}

/** Name shown in the classroom: the enrolled child's first name, else the demo child's, else the parent's. */
export function joinDisplayName(s: ApiClassSession, family: Pick<ApiParentChild, "id" | "firstName">[], fallback: string): string {
  const child = family.find((c) => s.childIds?.includes(c.id));
  return child?.firstName || s.demoChildName?.trim() || fallback;
}
