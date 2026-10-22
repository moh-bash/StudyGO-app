import { cn } from "@/lib/cn";
import { Text, View } from "react-native";

type StatTileProps = {
  label: string;
  value: number | string;
  /**
   * `good` marks a positive count, `warn` marks a count that needs attention,
   * `default` is a neutral figure.
   */
  tone?: "default" | "good" | "warn";
  className?: string;
};

const VALUE_CLASSES = {
  default: "text-slate-900 dark:text-white",
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
} as const;

/**
 * A single figure with its caption — the building block of the dashboard's
 * counter grid.
 */
export function StatTile({ label, value, tone = "default", className }: StatTileProps) {
  return (
    <View
      className={cn(
        "flex-1 items-center gap-1 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <Text className={cn("text-xl font-bold leading-7", VALUE_CLASSES[tone])}>{value}</Text>
      <Text className="text-center text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        {label}
      </Text>
    </View>
  );
}
