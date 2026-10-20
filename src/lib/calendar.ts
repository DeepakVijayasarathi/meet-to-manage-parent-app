// Pure local-calendar helpers (no React Native imports, so they run under `node --test`).

export const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type CalendarDay = {
  date: Date;
  key: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

/** A YYYY-MM-DD key in the device's local timezone. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** The first day of the represented month, at local noon to avoid DST-midnight edge cases. */
export function calendarMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

/** Move between calendar months without carrying a day such as the 31st into the next month. */
export function addCalendarMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

export function calendarMonthLabel(date: Date, locale?: string): string {
  return calendarMonthStart(date).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

/** A fixed Sunday-first 6x7 grid, including the adjacent-month days needed to fill each row. */
export function buildMonthGrid(month: Date, today: Date = new Date()): CalendarDay[] {
  const start = calendarMonthStart(month);
  const firstGridDate = new Date(start.getFullYear(), start.getMonth(), 1 - start.getDay(), 12);
  const monthNumber = start.getMonth();
  const todayKey = localDateKey(today);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate.getFullYear(), firstGridDate.getMonth(), firstGridDate.getDate() + index, 12);
    const key = localDateKey(date);
    return {
      date,
      key,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === monthNumber,
      isToday: key === todayKey,
    };
  });
}

/** Sessions shown after selecting a day, ordered without mutating the query result. */
export function sessionsForDate<T extends { scheduledStartAtUtc: string }>(sessions: readonly T[], dateKey: string): T[] {
  return sessions
    .filter((session) => localDateKey(new Date(session.scheduledStartAtUtc)) === dateKey)
    .sort((a, b) => a.scheduledStartAtUtc.localeCompare(b.scheduledStartAtUtc));
}
