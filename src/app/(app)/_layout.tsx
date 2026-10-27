import { Stack } from "expo-router";

import { WelcomeGate } from "@/components/Welcome";
import { AppMonitoringController, BiometricGate, NotificationController, OfflineBanner } from "@/components/MobileServices";
import { OperationalGate } from "@/components/OperationalGate";
import { fonts, useColors } from "@/lib/theme";
import { useAppConfig } from "@/state/appConfig";
import type { ApiAppConfig } from "@/api/types";

type AppFeature = keyof NonNullable<ApiAppConfig["features"]>;

/** Tabs at the root of the signed-in app; detail screens push on top with a back button. */
export default function AppLayout() {
  const colors = useColors();
  const { config } = useAppConfig();
  const enabled = (feature: AppFeature) => config?.features?.[feature] !== false;
  return (
    <>
    <OfflineBanner />
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="mito" options={{ title: "Mito" }} />
      <Stack.Screen name="mito-quiz" options={{ title: "Mito Practice" }} />
      <Stack.Protected guard={enabled("classes")}>
        <Stack.Screen name="class/[id]" options={{ title: "Class" }} />
        <Stack.Screen name="live/[id]" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      </Stack.Protected>
      <Stack.Protected guard={enabled("enrollment")}><Stack.Screen name="enrollment" options={{ title: "Enrollment" }} /></Stack.Protected>
      <Stack.Screen name="portal" options={{ title: "Meet to Manage" }} />
      <Stack.Protected guard={enabled("feedback")}><Stack.Screen name="feedback" options={{ title: "Share feedback", presentation: "modal" }} /></Stack.Protected>
      <Stack.Protected guard={enabled("reports")}>
        <Stack.Screen name="reports/index" options={{ title: "Progress reports" }} />
        <Stack.Screen name="reports/[id]" options={{ title: "Report" }} />
      </Stack.Protected>
      <Stack.Protected guard={enabled("resources")}><Stack.Screen name="resources" options={{ title: "Learning resources" }} /></Stack.Protected>
      <Stack.Protected guard={enabled("recordings")}>
        <Stack.Screen name="recordings/index" options={{ title: "Class recordings" }} />
        <Stack.Screen name="recordings/play" options={{ title: "Recording" }} />
      </Stack.Protected>
      <Stack.Protected guard={enabled("support")}>
        <Stack.Screen name="support/index" options={{ title: "Help & support" }} />
        <Stack.Screen name="support/new" options={{ title: "New request", presentation: "modal" }} />
        <Stack.Screen name="support/[id]" options={{ title: "Request" }} />
      </Stack.Protected>
    </Stack>
    <NotificationController />
    <AppMonitoringController />
    <BiometricGate />
    <OperationalGate />
    <WelcomeGate />
    </>
  );
}
