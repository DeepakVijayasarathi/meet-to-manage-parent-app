import { useQuery } from "@tanstack/react-query";

import { getChildren, getProgressReports, getSchedule } from "@/api/parent";
import { useRequiredSession } from "@/state/session";

/** Progress reports, shared by the list and detail screens (one cache entry). */
export function useReports() {
  const session = useRequiredSession();
  return useQuery({ queryKey: ["reports", session.token], queryFn: () => getProgressReports(session.token) });
}

export const SCHEDULE_WINDOW_DAYS = 30;

/** The ±30-day schedule shared by the Classes tab and class details (one cache entry). */
export function useScheduleWindow() {
  const session = useRequiredSession();
  return useQuery({
    queryKey: ["schedule-month", session.token],
    queryFn: () => getSchedule(
      session.token,
      new Date(Date.now() - SCHEDULE_WINDOW_DAYS * 86_400_000),
      new Date(Date.now() + SCHEDULE_WINDOW_DAYS * 86_400_000),
    ),
  });
}

export function useChildren() {
  const session = useRequiredSession();
  return useQuery({ queryKey: ["children", session.token], queryFn: () => getChildren(session.token) });
}
