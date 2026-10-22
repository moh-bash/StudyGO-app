import { FloatingTabBar } from "@/components/floating-tab-bar";
import { OfflineBanner } from "@/components/offline-banner";
import { useAuth } from "@/lib/auth/AuthContext";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AppLayout() {
  const { isLocalOnly, reconnect, status } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-950"
      style={{
        // The offline banner carries its own top inset, because it has to sit
        // *under* the status bar. When it is hidden the tab navigator has to
        // start below the status bar by itself.
        paddingTop: isLocalOnly ? 0 : insets.top,
      }}
    >
      <OfflineBanner
        visible={isLocalOnly}
        mode={status === "server-error" ? "server" : "offline"}
        onRetry={() => void reconnect()}
      />
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "الرئيسية" }} />
        <Tabs.Screen name="courses" options={{ title: "المقررات" }} />
        <Tabs.Screen name="account" options={{ title: "الإعدادات" }} />
      </Tabs>
    </View>
  );
}
