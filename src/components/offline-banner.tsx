import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onRetry: () => void;
};

/**
 * Slim banner shown while the app is running on locally cached data because the
 * backend could not be reached at startup. It makes the degraded state explicit
 * (instead of silently failing later) and offers a manual re-check.
 */
export function OfflineBanner({ visible, onRetry }: Props): ReactNode {
  const insets = useSafeAreaInsets();
  if (!visible) {
    return null;
  }

  return (
    <View
      className="flex-row items-center gap-3 bg-amber-100 px-4 pb-2 dark:bg-amber-900/50"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Text className="flex-1 text-xs font-medium text-amber-800 dark:text-amber-200">
        تعذّر الاتصال بالخادم — يتم عرض البيانات المحفوظة.
      </Text>
      <Pressable
        onPress={onRetry}
        hitSlop={8}
        className="rounded-full border border-amber-300 px-3 py-1 dark:border-amber-700"
      >
        <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}
