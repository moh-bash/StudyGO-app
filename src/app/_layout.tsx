import { AppLoader } from "@/components/ui/app-loader";
import { OnboardingProvider, useOnboarding } from "@/features/onboarding/onboarding-provider";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "./global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <OnboardingProvider>
            <RootNavigator />
            <StatusBar style="auto" />
          </OnboardingProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Boot gate + route guards.
 *
 * While the stored onboarding flag and the session restore are resolving, no
 * navigator is mounted at all — only the branded {@link AppLoader}, which the
 * native splash screen covers. This is what prevents a screen (notably the
 * onboarding/welcome slides) from mounting and then being replaced once the
 * stored state arrives.
 */
function RootNavigator() {
  const { status } = useAuth();
  const { isReady, hasOnboarded } = useOnboarding();
  const isDark = useColorScheme() === "dark";

  const booting = !isReady || status === "initializing";

  useEffect(() => {
    if (!booting) {
      void SplashScreen.hideAsync();
    }
  }, [booting]);

  if (booting) {
    return <AppLoader />;
  }

  // Signed-in *or* local-only (offline with a stored, non-rejected session) both
  // open the app; only an explicit signed-out state goes to the auth screens.
  const canUseApp = status === "authenticated" || status === "offline";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
      }}
    >
      <Stack.Protected guard={!hasOnboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={hasOnboarded && !canUseApp}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={hasOnboarded && canUseApp}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={hasOnboarded && canUseApp}>
        <Stack.Screen name="course/[id]" />
      </Stack.Protected>
    </Stack>
  );
}
