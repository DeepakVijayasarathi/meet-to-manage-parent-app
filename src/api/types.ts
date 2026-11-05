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
  /** What a tap should open ("invoice", "class", "report", "ticket", "homework", ...). Missing on older servers. */
  targetType?: string | null;
  targetId?: string | null;
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

export interface MitoChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface MitoChatResponse {
  reply: string;
  expression: "happy" | "thinking" | "encouraging" | string;
  suggestedPrompts: string[];
  /** Questions left today under the academy's daily limit; null/missing when unlimited. */
  remainingToday?: number | null;
}

export interface MitoTodayResponse {
  studentName: string;
  generatedAtUtc: string;
  items: { sessionId: string; title: string; teacherName: string; startsAtUtc: string; endsAtUtc: string; status: string }[];
  /** Homework and tests due within a week (or overdue) that still need attention. Missing on older servers. */
  homework?: { submissionId: string; title: string; kind: string; batchName: string; dueAtUtc: string | null; isOverdue: boolean }[];
}

export type AssignmentKind = "Homework" | "Test";
export type SubmissionStatus = "Pending" | "Submitted" | "Graded" | "Excused";

/** One child's homework or test, as the family sees it. Test marks stay null until results are released. */
export interface ApiFamilyAssignment {
  assignmentId: string;
  submissionId: string;
  childId: string;
  childName: string;
  batchName: string;
  courseName: string | null;
  teacherName: string | null;
  kind: AssignmentKind;
  title: string;
  instructions: string | null;
  topic: string | null;
  attachmentFileName: string | null;
  dueAtUtc: string | null;
  maxMarks: number | null;
  status: SubmissionStatus;
  answerText: string | null;
  submissionFileName: string | null;
  submittedAtUtc: string | null;
  isOverdue: boolean;
  marks: number | null;
  feedback: string | null;
  resultsReleased: boolean;
  classAverage: number | null;
  canSubmit: boolean;
}

export interface MitoProgressResponse {
  studentName: string;
  academicLevel: string | null;
  classesCompleted: number;
  classesRemaining: number;
  attendancePercent: number | null;
  summary: string;
}
export interface MitoQuizQuestion { id: string; prompt: string; courseName: string | null; options: { id: string; text: string }[] }
export interface MitoQuizAnswer { correct: boolean; correctOptionId: string; correctAnswer: string; feedback: string }

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
  maintenance?: { active: boolean; message: string | null; startsAtUtc: string | null; endsAtUtc: string | null };
  minimumVersion?: string | null;
  forceUpgrade?: boolean;
  quickActions?: string | null;
  features?: { classes: boolean; fees: boolean; updates: boolean; reports: boolean; resources: boolean; recordings: boolean; enrollment: boolean; support: boolean; feedback: boolean; mito: boolean };
  mito?: { chatEnabled: boolean; quizEnabled: boolean; voiceEnabled: boolean; doubtModeEnabled: boolean; planModeEnabled: boolean; reviewModeEnabled: boolean; displayName: string; welcomeMessage: string | null };
  /** First-launch tour set by the administrator; empty fields fall back to the app's own wording. */
  welcome?: { enabled: boolean; title: string | null; subtitle: string | null; features: string | null };
  brand: {
    name: string | null; logoUrl: string | null; primaryColor: string | null; accentColor: string | null;
    fontFamily: string | null; headingFont: string | null;
  };
}

export interface ApiChildReward { label: string; kind: "Star" | "Badge" | "Milestone" | string; earnedAtUtc: string }
export interface ApiChildRewards {
  childId: string; childName: string; totalStars: number; starsLast30Days: number;
  rewards: ApiChildReward[]; nextMilestoneStars: number | null; nextMilestoneLabel: string | null;
}

export interface ApiSchedulePreference {
  childId: string; childName: string; dateOfBirth: string | null; gender: string | null; grade: string | null;
  courseId: string | null; courseName: string | null; preferredStartDate: string | null; daysPerWeek: number | null;
  preferredDays: string[]; dayTimes: Record<string, string>; timeZoneId: string | null;
  schoolName: string | null; priorExperience: string | null; allergies: string | null; notes: string | null;
  hasSubmitted: boolean; submittedAtUtc: string | null;
}
export type ApiSchedulePreferenceSave = Pick<ApiSchedulePreference, "courseId" | "preferredStartDate" | "preferredDays" | "dayTimes" | "timeZoneId" | "schoolName" | "grade" | "dateOfBirth" | "gender" | "priorExperience" | "allergies" | "notes"> & { daysPerWeek: number };

export interface ApiPaymentMethod { key: string; name: string }
/** `redirect` carries a gateway checkout `url`; `cash` records an intent for staff to confirm; `unavailable` explains why not. */
export interface ApiPaymentResult { mode: "redirect" | "cash" | "unavailable" | string; url: string | null; gatewayReference: string | null; message: string }

/** A course-completion certificate. */
export interface ApiCertificate {
  id: string;
  childId: string;
  code: string;
  studentName: string;
  courseName: string;
  teacherName: string | null;
  batchName: string | null;
  issuedAtUtc: string;
}
