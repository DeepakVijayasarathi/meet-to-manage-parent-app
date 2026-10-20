import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useState, type ComponentProps } from "react";
import { useColorScheme } from "react-native";

import { SessionProvider, useSession } from "@/state/session";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  // A font failure falls back to the system font rather than holding the splash forever.
  const fontsReady = fontsLoaded || !!fontError;
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000 } } }));
  return (
    <ThemeProvider value={(colorScheme === "dark" ? DarkTheme : DefaultTheme) as ComponentProps<typeof ThemeProvider>["value"]}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SplashController fontsReady={fontsReady} />
          {fontsReady && <RootNavigator />}
          <StatusBar style="auto" />
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
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
