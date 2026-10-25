import type Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";

import type { ApiAppConfig } from "@/api/types";

type FeatherName = ComponentProps<typeof Feather>["name"];

export interface WelcomeFeature { title: string; text: string; icon: FeatherName }
export interface WelcomeContent { title: string; subtitle: string; features: WelcomeFeature[] }

const ICONS: FeatherName[] = ["video", "bar-chart-2", "credit-card", "book-open", "bell", "message-circle"];
const MAX_FEATURES = 6;

/** Shown when the administrator hasn't written their own list. */
const DEFAULT_FEATURES: Omit<WelcomeFeature, "icon">[] = [
  { title: "Live classes", text: "Join your child's class with one tap, right when it starts." },
  { title: "Progress reports", text: "See how your child is doing, with feedback from their teachers." },
  { title: "Fees & payments", text: "View invoices and pay securely, with receipts kept for you." },
  { title: "Resources & recordings", text: "Revisit notes and class recordings whenever you need them." },
  { title: "Help & updates", text: "Get announcements and reach your academy without leaving the app." },
];

/** One "Title | Description" per line; a line without a bar is a title on its own. */
export function parseFeatures(raw: string | null | undefined): Omit<WelcomeFeature, "icon">[] {
  return (raw ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, MAX_FEATURES).map((line) => {
    const [title, ...rest] = line.split("|");
    return { title: title.trim(), text: rest.join("|").trim() };
  }).filter((f) => f.title.length > 0);
}

export function brandName(config: ApiAppConfig | null): string {
  return config?.brand.name || config?.organisationName || "Meet to Manage";
}

export function welcomeContent(config: ApiAppConfig): WelcomeContent | null {
  if (config.welcome && !config.welcome.enabled) return null;
  const custom = parseFeatures(config.welcome?.features);
  const base = custom.length > 0 ? custom : DEFAULT_FEATURES;
  return {
    title: config.welcome?.title || `Welcome to ${brandName(config)}`,
    subtitle: config.welcome?.subtitle || "Classes, progress and fees for your family, all in one place.",
    features: base.map((f, i) => ({ ...f, icon: ICONS[i % ICONS.length] })),
  };
}

/** Remembered per device and organisation, so a second organisation on the same phone still gets its own welcome. */
export const welcomeSeenKey = (tenantCode: string | null) => `mtm.welcome.${tenantCode ?? "default"}`;
