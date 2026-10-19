import { FloatingTabBar } from "@/components/floating-tab-bar";
import { OfflineBanner } from "@/components/offline-banner";
import { useAuth } from "@/lib/auth/AuthContext";
import { Tabs } from "expo-router";
import { View } from "react-native";

export default function AppLayout() {
  const { isLocalOnly, reconnect } = useAuth();

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner visible={isLocalOnly} onRetry={() => void reconnect()} />
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "الرئيسية" }} />
        <Tabs.Screen name="courses" options={{ title: "المقررات" }} />
        <Tabs.Screen name="account" options={{ title: "الحساب" }} />
      </Tabs>
    </View>
  );
}
