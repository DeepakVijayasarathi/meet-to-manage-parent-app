import { useColorScheme } from "react-native";
import { useAppConfig } from "@/state/appConfig";

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
  background: "#F6F7F9",
  card: "#FFFFFF",
  text: brand.charcoal as string,
  textSoft: "#4B5563",
  muted: "#6B7280",
  mutedBg: "#F1F2F4",
  border: "#E6E8EB",
  primary: brand.orange as string,
  accent: brand.orangeTo as string,
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
  shadow: "rgba(16, 24, 40, 0.06)",
};

const dark: typeof light = {
  background: "#0C0E12",
  card: "#15181D",
  text: "#F3F4F6",
  textSoft: "#C9CDD4",
  muted: "#9CA3AF",
  mutedBg: "#1C2027",
  border: "#252A31",
  primary: "#FF8A3D",
  accent: "#F2611A",
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
  const base = useColorScheme() === "dark" ? dark : light;
  const configured = useAppConfig().config?.brand.primaryColor;
  const configuredAccent = useAppConfig().config?.brand.accentColor;
  const primary = configured && /^#[0-9a-f]{6}$/i.test(configured) ? configured : null;
  if (!primary) return base;
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(primary.slice(i, i + 2), 16));
  return {
    ...base,
    primary,
    accent: configuredAccent && /^#[0-9a-f]{6}$/i.test(configuredAccent) ? configuredAccent : primary,
    primaryInk: primary,
    primarySoft: `rgba(${r}, ${g}, ${b}, ${base === dark ? 0.18 : 0.11})`,
  };
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
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Keeps tablet and web layouts comfortably readable instead of stretching cards edge-to-edge. */
export const layout = { contentMax: 760, navigationMax: 720, formMax: 480 } as const;

/** Hairline shadows: surfaces are defined by their border, with just enough lift to separate. */
export const elevation = {
  low: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 },
  mid: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3 },
  high: { shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 28, elevation: 10 },
} as const;

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.8, lineHeight: 36 },
  title: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.6, lineHeight: 32 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.semibold, fontSize: 13 },
  caption: { fontFamily: fonts.medium, fontSize: 12 },
  overline: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" as const },
} as const;
