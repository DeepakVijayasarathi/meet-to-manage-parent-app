import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ComponentProps } from "react";
import { AppState, Platform, useColorScheme, type AppStateStatus } from "react-native";

import { AppConfigProvider } from "@/state/appConfig";
import { SessionProvider, useSession } from "@/state/session";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  // A font failure falls back to the system font rather than holding the splash forever.
  const fontsReady = fontsLoaded || !!fontError;
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000 } } }));
  return (
    <AppErrorBoundary>
    <ThemeProvider value={(colorScheme === "dark" ? DarkTheme : DefaultTheme) as ComponentProps<typeof ThemeProvider>["value"]}>
      <QueryClientProvider client={queryClient}>
        <AppFocusController />
        <SessionProvider>
          <AppConfigProvider>
            <SplashController fontsReady={fontsReady} />
            {fontsReady && <RootNavigator />}
            <StatusBar style="auto" />
          </AppConfigProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </AppErrorBoundary>
  );
}

/** Let React Query refresh stale data after a family returns to the app. */
function AppFocusController() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const onChange = (status: AppStateStatus) => focusManager.setFocused(status === "active");
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);
  return null;
}

function SplashController({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading } = useSession();
  if (!isLoading && fontsReady) SplashScreen.hide();
  return null;
}

/** Signed-in families see the app; everyone else only the sign-in screen. */
function RootNavigator() {
  const { session } = useSession();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
