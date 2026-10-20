import type { SupportTicketCategory, SupportTicketStatus } from "@/api/types";
import type { IconName, Tone } from "@/components/ui";

// Same categories and wording as the web portal (meettomanage/src/api/supportTickets.ts).
export const TICKET_CATEGORIES: { value: SupportTicketCategory; label: string; icon: IconName }[] = [
  { value: "ClassSchedule", label: "Class timing", icon: "calendar" },
  { value: "Teacher", label: "Teacher", icon: "user" },
  { value: "BillingPayment", label: "Billing", icon: "credit-card" },
  { value: "Technical", label: "Technical", icon: "smartphone" },
  { value: "Enrollment", label: "Enrollment", icon: "clipboard" },
  { value: "Other", label: "Other", icon: "help-circle" },
];

export const TICKET_STATUS: Record<SupportTicketStatus, { label: string; tone: Tone }> = {
  Open: { label: "Open", tone: "warning" },
  InProgress: { label: "In progress", tone: "info" },
  Resolved: { label: "Resolved", tone: "success" },
  Closed: { label: "Closed", tone: "neutral" },
};

export function categoryLabel(category: SupportTicketCategory): string {
  return TICKET_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}
