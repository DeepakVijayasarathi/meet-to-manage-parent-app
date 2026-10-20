import { useColorScheme } from "react-native";

// Built from the logo: its orange gradient (tailwind brand.orange from/to) for actions and
// highlights, its charcoal for text and dark surfaces, on calm neutral greys.
export const brand = {
  orangeFrom: "#F7931E",
  orangeTo: "#F2611A",
  orange: "#F26B1D",
  charcoal: "#20242C",
  charcoalSoft: "#2C313B",
} as const;

const light = {
  background: "#FFFFFF",
  card: "#FFFFFF",
  text: brand.charcoal as string,
  textSoft: "#4B5260",
  muted: "#6B7280",
  mutedBg: "#F7F8FA",
  border: "#EEF0F3",
  primary: brand.orange as string,
  primaryText: "#FFFFFF",
  primarySoft: "rgba(242, 107, 29, 0.10)",
  primaryInk: "#C2410C",
  success: "#15803D",
  successSoft: "rgba(21, 128, 61, 0.10)",
  warning: "#D97706",
  warningText: "#92400E",
  warningSoft: "rgba(217, 119, 6, 0.12)",
  danger: "#DC2626",
  dangerSoft: "rgba(220, 38, 38, 0.09)",
  info: "#2563EB",
  infoSoft: "rgba(37, 99, 235, 0.09)",
  shadow: "rgba(16, 24, 40, 0.07)",
};

const dark: typeof light = {
  background: "#0F1115",
  card: "#171A20",
  text: "#F3F4F6",
  textSoft: "#C9CDD4",
  muted: "#9CA3AF",
  mutedBg: "#1F232B",
  border: "#272B33",
  primary: "#FF8A3D",
  primaryText: "#FFFFFF",
  primarySoft: "rgba(255, 138, 61, 0.14)",
  primaryInk: "#FFA45C",
  success: "#4ADE80",
  successSoft: "rgba(74, 222, 128, 0.12)",
  warning: "#FBBF24",
  warningText: "#FCD34D",
  warningSoft: "rgba(251, 191, 36, 0.14)",
  danger: "#F87171",
  dangerSoft: "rgba(248, 113, 113, 0.13)",
  info: "#60A5FA",
  infoSoft: "rgba(96, 165, 250, 0.13)",
  shadow: "rgba(0, 0, 0, 0.45)",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

/** Custom fonts carry their weight in the family name (fontWeight is ignored on Android). */
export const fonts = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
} as const;

/** 4-pt spacing scale and radii shared by every screen. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Soft, wide shadows (modern "floating" surfaces); colour comes from the palette's `shadow`. */
export const elevation = {
  low: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  mid: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 24, elevation: 6 },
  high: { shadowOffset: { width: 0, height: 16 }, shadowOpacity: 1, shadowRadius: 40, elevation: 12 },
} as const;

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1, lineHeight: 40 },
  title: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.7, lineHeight: 34 },
  heading: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.semibold, fontSize: 13 },
  caption: { fontFamily: fonts.medium, fontSize: 12 },
  overline: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" as const },
} as const;
