// Live-classroom REST calls, mirroring the web's api/quizQuestions.ts, gamification.ts and
// engagement.ts. Awards and engagement are fire-and-forget: tracking must never disturb a class.
import { apiFetch } from "./client";

export interface ApiQuizQuestionOption { id: string; text: string; isCorrect: boolean; displayOrder: number }
export interface ApiQuizQuestion { id: string; prompt: string; displayOrder: number; options: ApiQuizQuestionOption[] }
export interface ApiLeaderboardEntry { participantName: string; stars: number; badges: string[] }

export type EngagementType = "QuizAttempt" | "QuizCorrect" | "ActivityClick" | "ActivityCompleted" | "WhiteboardInteraction" | "HandRaise" | "AttentionPing";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActivityMode = "DragDrop" | "TagMatch" | "Hotspot";
export interface ApiActivityItem { id: string; emoji: string; label: string | null; isTarget: boolean; displayOrder: number }
export interface ApiWhiteboardActivity { id: string; mode: ActivityMode; prompt: string; displayOrder: number; items: ApiActivityItem[] }

/** This class's resolved activity bank (course's own, else its department's). */
export function getSessionActivities(token: string, sessionId: string): Promise<ApiWhiteboardActivity[]> {
  if (!GUID.test(sessionId)) return Promise.resolve([]);
  return apiFetch<ApiWhiteboardActivity[]>(`/api/whiteboard-activities/for-session/${sessionId}`, { token });
}

export function getSessionQuiz(token: string, sessionId: string): Promise<ApiQuizQuestion[]> {
  return apiFetch<ApiQuizQuestion[]>(`/api/quiz-questions/for-session/${sessionId}`, { token });
}

export function getLeaderboard(token: string, sessionId: string, top = 10): Promise<ApiLeaderboardEntry[]> {
  return apiFetch<ApiLeaderboardEntry[]>(`/api/gamification/leaderboard?sessionId=${encodeURIComponent(sessionId)}&top=${top}`, { token });
}

export function postAward(token: string, sessionId: string, participantName: string, kind: "Star" | "Badge" | "Milestone" = "Star", points = 1): void {
  if (!GUID.test(sessionId)) return;
  apiFetch<void>("/api/gamification/awards", { token, method: "POST", body: JSON.stringify({ sessionId, participantName, kind, points }) }).catch(() => undefined);
}

export function postEngagement(token: string, sessionId: string, participantName: string, type: EngagementType, value = 1): void {
  if (!GUID.test(sessionId)) return;
  apiFetch<void>(`/api/sessions/${sessionId}/engagement`, {
    token, method: "POST", body: JSON.stringify({ events: [{ participantName, type, value }] }),
  }).catch(() => undefined);
}
