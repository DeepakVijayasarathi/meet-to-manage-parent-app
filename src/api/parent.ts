import { apiFetch } from "./client";
import type {
  ApiAppConfig, ApiClassSession, ApiCourseOption, ApiEnrollmentForm, ApiInvoice, ApiMyAccount, ApiJitsiJoin, ApiPendingParentFeedback, ApiNotificationFeed, ApiParentChild, ApiParentDashboard, ApiParentRecording, ApiProgressReport,
  ApiResource, ApiResourcePlayback, ApiSupportTicketDetail, ApiSupportTicketSummary, LoginResponse, SupportTicketCategory,
} from "./types";

export function login(identifier: string, pin: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: identifier.trim(), pin }),
  });
}

export function getChildren(token: string): Promise<ApiParentChild[]> {
  return apiFetch<ApiParentChild[]>("/api/parent-portal/children", { token });
}

export function getSchedule(token: string, from: Date, to: Date): Promise<ApiClassSession[]> {
  const query = `fromUtc=${encodeURIComponent(from.toISOString())}&toUtc=${encodeURIComponent(to.toISOString())}`;
  return apiFetch<ApiClassSession[]>(`/api/parent-portal/schedule?${query}`, { token });
}

export function getDashboard(token: string): Promise<ApiParentDashboard> {
  return apiFetch<ApiParentDashboard>("/api/parent-portal/dashboard", { token });
}

export function getInvoices(token: string): Promise<ApiInvoice[]> {
  return apiFetch<ApiInvoice[]>("/api/parent-portal/invoices", { token });
}

export function getNotifications(token: string, take = 50): Promise<ApiNotificationFeed> {
  return apiFetch<ApiNotificationFeed>(`/api/notifications/mine?take=${take}`, { token });
}

export function markNotificationRead(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/api/notifications/${id}/read`, { token, method: "POST" });
}

export function markAllNotificationsRead(token: string): Promise<void> {
  return apiFetch<void>("/api/notifications/read-all", { token, method: "POST" });
}

export function getProgressReports(token: string): Promise<ApiProgressReport[]> {
  return apiFetch<ApiProgressReport[]>("/api/progress-reports/mine", { token });
}

export function getResources(token: string): Promise<ApiResource[]> {
  return apiFetch<ApiResource[]>("/api/parent-portal/resources", { token });
}

export function getResourcePlayUrl(token: string, id: string): Promise<ApiResourcePlayback> {
  return apiFetch<ApiResourcePlayback>(`/api/parent-portal/resources/${id}/play`, { token });
}

export function getRecordings(token: string): Promise<ApiParentRecording[]> {
  return apiFetch<ApiParentRecording[]>("/api/parent-portal/recordings", { token });
}

export function getSupportTickets(token: string): Promise<ApiSupportTicketSummary[]> {
  return apiFetch<ApiSupportTicketSummary[]>("/api/support-tickets/mine", { token });
}

export function getSupportTicket(token: string, id: string): Promise<ApiSupportTicketDetail> {
  return apiFetch<ApiSupportTicketDetail>(`/api/support-tickets/mine/${id}`, { token });
}

export function createSupportTicket(
  token: string,
  input: { category: SupportTicketCategory; subject: string; message: string; childId?: string | null },
): Promise<ApiSupportTicketDetail> {
  return apiFetch<ApiSupportTicketDetail>("/api/support-tickets/mine", { token, method: "POST", body: JSON.stringify(input) });
}

export function replyToSupportTicket(token: string, id: string, message: string): Promise<ApiSupportTicketDetail> {
  return apiFetch<ApiSupportTicketDetail>(`/api/support-tickets/mine/${id}/messages`, { token, method: "POST", body: JSON.stringify({ message }) });
}

/** Authorizes this family for the session and returns the Jitsi room plus a signed join token. */
export function getJitsiJoin(token: string, sessionId: string): Promise<ApiJitsiJoin> {
  return apiFetch<ApiJitsiJoin>(`/api/sessions/${sessionId}/jitsi-join`, { token });
}

/** Takes effect immediately: the teacher is emailed the reason and a make-up is scheduled. */
export function cancelClass(token: string, sessionId: string, reason: string): Promise<ApiClassSession> {
  return apiFetch<ApiClassSession>(`/api/sessions/${sessionId}/parent-cancel`, { token, method: "POST", body: JSON.stringify({ reason }) });
}

export function getPendingFeedback(token: string): Promise<ApiPendingParentFeedback[]> {
  return apiFetch<ApiPendingParentFeedback[]>("/api/parent-feedback/pending", { token });
}

export function submitFeedback(token: string, pending: ApiPendingParentFeedback, rating: number, comment: string): Promise<void> {
  return apiFetch<void>("/api/parent-feedback", {
    token,
    method: "POST",
    body: JSON.stringify({
      kind: pending.kind, demoBookingId: pending.demoBookingId, batchId: pending.batchId, childId: pending.childId,
      rating, comment: comment.trim() || null,
    }),
  });
}

export function getCourseOptions(token: string): Promise<ApiCourseOption[]> {
  return apiFetch<ApiCourseOption[]>("/api/courses/options", { token });
}

export function getMyAccount(token: string): Promise<ApiMyAccount> {
  return apiFetch<ApiMyAccount>("/api/users/me", { token });
}

export function getMyEnrollmentForms(token: string): Promise<ApiEnrollmentForm[]> {
  return apiFetch<ApiEnrollmentForm[]>("/api/enrollment-forms/mine", { token });
}

/** Answers travel as a JSON document; `childId` fills in details for a child the academy already created. */
export function submitEnrollment(token: string, answers: Record<string, unknown>, childId?: string): Promise<ApiEnrollmentForm> {
  return apiFetch<ApiEnrollmentForm>("/api/enrollment-forms", {
    token,
    method: "POST",
    body: JSON.stringify({ formDataJson: JSON.stringify(answers), childId }),
  });
}

export function getAppConfig(token: string): Promise<ApiAppConfig> {
  return apiFetch<ApiAppConfig>("/api/app/config", { token });
}

export function sendAppHeartbeat(token: string, payload: {
  installationId: string; platform: string; appVersion: string; buildNumber?: string | null; runtimeVersion?: string | null;
  notificationsEnabled: boolean; biometricLockEnabled: boolean; successfulSync: boolean; errorCategory?: string | null; pushToken?: string | null;
}): Promise<{ id: string; lastSeenAtUtc: string }> {
  return apiFetch("/api/app/installations/heartbeat", { token, method: "POST", body: JSON.stringify(payload) });
}
