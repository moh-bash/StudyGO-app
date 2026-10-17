import { useOnboarding } from "@/features/onboarding/onboarding-provider";
import { useAuth } from "@/lib/auth/AuthContext";
import { LogOut, RotateCcw, UserRound } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenPlaceholder } from "@/components/ui/screen-placeholder";

export default function AccountScreen() {
  const { user, status, isLocalOnly, signOut } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  if (!user) {
    return (
      <View className="flex-1 bg-white dark:bg-slate-950">
        <ScreenPlaceholder title="الحساب" subtitle="تعذّر تحميل بيانات الحساب." />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="items-center gap-3">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-50 dark:bg-slate-800">
            <UserRound color={isDark ? "#e2e8f0" : "#208aef"} size={36} />
          </View>
          <View className="items-center gap-1">
            <Text className="text-2xl font-bold text-slate-900 dark:text-white">{user.fullName}</Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400">{user.email}</Text>
          </View>
          {isLocalOnly ? (
            <View className="rounded-full bg-amber-100 px-3 py-1 dark:bg-amber-900/40">
              <Text className="text-xs font-medium text-amber-700 dark:text-amber-300">
                وضع دون اتصال — تُعرض البيانات المحفوظة
              </Text>
            </View>
          ) : (
            <View className="rounded-full bg-emerald-100 px-3 py-1 dark:bg-emerald-900/40">
              <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                متصل بالخادم
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="gap-2 px-6" style={{ paddingBottom: Math.max(insets.bottom, 90) }}>
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut || status === "unauthenticated"}
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-slate-100 px-6 py-4 active:bg-slate-200 disabled:opacity-60 dark:bg-slate-800 dark:active:bg-slate-700"
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={isDark ? "#f1f5f9" : "#0f172a"} />
          ) : (
            <LogOut size={18} color={isDark ? "#f1f5f9" : "#0f172a"} />
          )}
          <Text className="text-base font-semibold text-slate-900 dark:text-white">تسجيل الخروج</Text>
        </Pressable>
        <Pressable
          onPress={resetOnboarding}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-slate-200 px-6 py-4 active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-900"
        >
          <RotateCcw size={18} color={isDark ? "#94a3b8" : "#64748b"} />
          <Text className="text-sm font-medium text-slate-600 dark:text-slate-400">
            إعادة الإعداد التعريفي (تجريبي)
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
