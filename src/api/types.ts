// Shapes returned by the Meet to Manage API (mirrors meettomanage/src/api/*.ts).

export type ApiRole =
  | "Admin"
  | "SubAdmin"
  | "AdmissionTeam"
  | "Teacher"
  | "Parent"
  | "Student"
  | (string & {});

export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: ApiRole;
  timeZoneId: string;
}

export interface LoginResponse {
  tenantId?: string | null;
  tenantCode?: string | null;
  accessToken: string;
  expiresAtUtc: string;
  user: ApiUser;
  permissions: string[];
  defaultRoute: string;
}

export interface ApiParentChild {
  id: string;
  firstName: string;
  lastName: string;
  academicLevel: string | null;
  isActive: boolean;
}

export interface ApiParentChildSummary {
  childId: string;
  name: string;
  academicLevel: string | null;
  classesCompleted: number;
  classesRemaining: number;
  attendancePercent: number | null;
  feeStatus: "paid" | "due" | "overdue" | "suspended";
  isSuspended: boolean;
  suspendedInvoiceId: string | null;
}

export interface ApiParentDashboard {
  enrollmentFormCompleted: boolean;
  isSuspended: boolean;
  allChildrenSuspended: boolean;
  children: ApiParentChildSummary[];
}

export type SessionStatus =
  | "Scheduled"
  | "InProgress"
  | "Completed"
  | "Cancelled"
  | "Rescheduled"
  | "TeacherNoShow"
  | "StudentNoShow"
  | "CarriedForward";

export interface ApiClassSession {
  id: string;
  batchId: string | null;
  batchName: string | null;
  teacherName: string;
  type: "Regular" | "Demo";
  status: SessionStatus;
  scheduledStartAtUtc: string;
  scheduledEndAtUtc: string;
  cancellationReason: string | null;
  summary: string | null;
  childIds?: string[];
  hasRecording: boolean;
  recordingExpiresAtUtc: string | null;
  demoChildName: string | null;
}

export type ApiResourceType = "ReadingBook" | "Worksheet" | "Other";

export interface ApiResource {
  id: string;
  title: string;
  type: ApiResourceType;
  mimeType: string | null;
  fileSizeBytes: number | null;
  batchName: string | null;
  isDownloadable: boolean;
  description: string | null;
  createdAtUtc: string;
}

export interface ApiResourcePlayback {
  url: string;
  mimeType: string | null;
  expiresAtUtc: string;
}

export interface ApiParentRecording {
  id: string;
  classSessionId: string;
  storageUrl: string;
  durationSeconds: number | null;
  expiresAtUtc: string | null;
  createdAtUtc: string;
  batchName: string | null;
  scheduledStartAtUtc: string;
  childIds: string[];
}

export interface ApiLeaderboardEntry {
  participantName: string;
  stars: number;
  badges: string[];
}

export interface ApiNotification {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  isRead: boolean;
  createdAtUtc: string;
}

export interface ApiNotificationFeed {
  unreadCount: number;
  items: ApiNotification[];
}

export interface ApiProgressReport {
  id: string;
  childId: string;
  childName: string;
  periodYear: number;
  periodMonth: number;
  status: "Draft" | "Sent";
  content: string;
  sentAtUtc: string | null;
}

export interface ApiChatMessage {
  id: string;
  sender: "User" | "Bot";
  text: string;
  matchedFaqId: string | null;
  wasHelpful: boolean | null;
  createdAtUtc: string;
}

export interface AskChatbotResponse {
  userMessage: ApiChatMessage;
  botMessage: ApiChatMessage;
  matched: boolean;
  escalated: boolean;
}

export type SupportTicketStatus = "Open" | "InProgress" | "Resolved" | "Closed";
export type SupportTicketCategory = "ClassSchedule" | "Teacher" | "BillingPayment" | "Technical" | "Enrollment" | "Other";

export interface ApiSupportTicketSummary {
  id: string;
  reference: string;
  subject: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  childName: string | null;
  awaitingStaffReply: boolean;
  messageCount: number;
  lastMessagePreview: string | null;
  createdAtUtc: string;
  lastActivityAtUtc: string;
}

export interface ApiSupportTicketMessage {
  id: string;
  authorName: string;
  isStaff: boolean;
  body: string;
  createdAtUtc: string;
}

export interface ApiSupportTicketDetail extends ApiSupportTicketSummary {
  messages: ApiSupportTicketMessage[];
}

export type ApiInvoiceStatus = "Pending" | "PartiallyPaid" | "Paid" | "Overdue" | "Cancelled";

export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  childId: string | null;
  childName: string | null;
  courseName: string | null;
  departmentName: string;
  amount: number;
  amountPaid: number;
  currency: string;
  status: ApiInvoiceStatus;
  dueDate: string;
  issuedAtUtc: string;
  paidAtUtc: string | null;
}

export interface ApiJitsiJoin {
  /** The session actually joined (differs from the one asked for if it was rescheduled). */
  sessionId: string;
  room: string;
  domain: string;
  token: string | null;
  scheduledEndAtUtc: string;
  isDemo: boolean;
}

export type ParentFeedbackKind = "Demo" | "CourseCompletion";

export interface ApiPendingParentFeedback {
  kind: ParentFeedbackKind;
  demoBookingId: string | null;
  batchId: string | null;
  childId: string | null;
  childName: string;
  courseName: string | null;
  endedAtUtc: string;
}

export interface ApiCourseOption {
  id: string;
  name: string;
  type: "Individual" | "Group";
}

export interface ApiMyAccount {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  timeZoneId: string;
}

export interface ApiEnrollmentForm {
  id: string;
  childId: string | null;
  formDataJson: string;
  status: "Pending" | "Submitted" | "Approved" | "Rejected";
  submittedAtUtc: string | null;
  reviewedAtUtc: string | null;
}

/** GET /api/app/config: what the administrator configured for this academy's app. */
export interface ApiAppConfig {
  tenantCode: string | null;
  appAccessGranted: boolean;
  /** Where the app opens payments, adding a child and other website pages. Null when none is configured. */
  webBaseUrl: string | null;
  organisationName: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  announcement: string | null;
  /** Minutes before a class starts that Join Class is enabled. */
  joinOpensMinutesBefore: number;
  /** First-launch tour set by the administrator; empty fields fall back to the app's own wording. */
  welcome?: { enabled: boolean; title: string | null; subtitle: string | null; features: string | null };
  brand: {
    name: string | null; logoUrl: string | null; primaryColor: string | null; accentColor: string | null;
    fontFamily: string | null; headingFont: string | null;
  };
}
