import { Stack } from "expo-router";

import { fonts, useColors } from "@/lib/theme";

/** Tabs at the root of the signed-in app; detail screens push on top with a back button. */
export default function AppLayout() {
  const colors = useColors();
  return (
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
      <Stack.Screen name="class/[id]" options={{ title: "Class" }} />
      <Stack.Screen name="live/[id]" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="enrollment" options={{ title: "Enrollment" }} />
      <Stack.Screen name="portal" options={{ title: "Meet to Manage" }} />
      <Stack.Screen name="feedback" options={{ title: "Share feedback", presentation: "modal" }} />
      <Stack.Screen name="reports/index" options={{ title: "Progress reports" }} />
      <Stack.Screen name="reports/[id]" options={{ title: "Report" }} />
      <Stack.Screen name="resources" options={{ title: "Learning resources" }} />
      <Stack.Screen name="recordings/index" options={{ title: "Class recordings" }} />
      <Stack.Screen name="recordings/play" options={{ title: "Recording" }} />
      <Stack.Screen name="support/index" options={{ title: "Help & support" }} />
      <Stack.Screen name="support/new" options={{ title: "New request", presentation: "modal" }} />
      <Stack.Screen name="support/[id]" options={{ title: "Request" }} />
    </Stack>
  );
}
