import { useColorScheme } from "react-native";
import { Stack } from "expo-router";

export const unstable_settings = { anchor: "login" };

export default function AuthLayout() {
  const isDark = useColorScheme() === "dark";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: isDark ? "#020617" : "#ffffff" },
      }}
    />
  );
}
