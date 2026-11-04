import type { ApiFamilyAssignment } from "../api/types";

export type HomeworkBucket = "todo" | "done" | "results";

/** Which tab a piece of work belongs in: still to do, handed in and waiting, or checked/marked. */
export function homeworkBucket(a: ApiFamilyAssignment): HomeworkBucket {
  if (a.marks != null || a.feedback || a.status === "Graded" || a.status === "Excused") return "results";
  if (a.kind === "Homework" && a.status === "Submitted") return "done";
  return "todo";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function homeworkSubtitle(a: ApiFamilyAssignment): string {
  const due = a.dueAtUtc ? ` · due ${shortDate(a.dueAtUtc)}` : "";
  return `${a.childName.split(" ")[0]} · ${a.batchName}${due}`;
}
