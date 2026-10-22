import { cn } from "@/lib/cn";
import { useThemeColors } from "@/constants/theme";
import { CloudOff, RefreshCw, ServerCrash } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Which degraded state produced the banner. The wording must match what
 * actually happened on the wire:
 *
 * - `offline`: the device could not reach the backend (transport failure).
 * - `server`: the backend *answered* but failed (5xx) — the student is online;
 *   saying "no connection" here is the reported false-warning bug.
 */
export type OfflineBannerMode = "offline" | "server";

type Props = {
  visible: boolean;
  onRetry: () => void;
  mode?: OfflineBannerMode;
};

const COPY: Record<OfflineBannerMode, string> = {
  offline: "تعذّر الاتصال بالخادم — يتم عرض البيانات المحفوظة.",
  server: "الخادم يواجه خللًا حاليًا — يتم عرض البيانات المحفوظة.",
};

/**
 * Slim banner shown while the app is running on locally cached data because
 * the session could not be validated remotely. It makes the degraded state
 * explicit (instead of silently failing later) and offers a manual re-check.
 */
export function OfflineBanner({ visible, onRetry, mode = "offline" }: Props): ReactNode {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  if (!visible) {
    return null;
  }

  const Icon = mode === "server" ? ServerCrash : CloudOff;

  return (
    <View
      className={cn(
        "flex-row items-center gap-3 border-b border-amber-200/70 bg-amber-50 px-4 pb-2.5 dark:border-amber-900/60 dark:bg-amber-950/50",
      )}
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="flex-1 items-end gap-0.5">
        <Text className="text-right text-xs font-semibold leading-4 text-amber-900 dark:text-amber-100">
          {mode === "server" ? "خلل في الخادم" : "لا يوجد اتصال"}
        </Text>
        <Text className="text-right text-[11px] leading-4 text-amber-800 dark:text-amber-200/90">
          {COPY[mode]}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="إعادة المحاولة"
        onPress={onRetry}
        hitSlop={8}
        className="flex-row items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/70 px-3 py-1.5 active:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/40 dark:active:bg-amber-900"
      >
        <RefreshCw color={colors.warning} size={13} />
        <Text className="text-[11px] font-semibold leading-4 text-amber-900 dark:text-amber-100">
          إعادة المحاولة
        </Text>
      </Pressable>
      <Icon color={colors.warning} size={18} />
    </View>
  );
}
