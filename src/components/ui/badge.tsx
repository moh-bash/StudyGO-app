import { cn } from "@/lib/cn";
import { Text, View } from "react-native";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  className?: string;
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 dark:bg-slate-800",
  brand: "bg-brand-50 dark:bg-brand-950/50",
  success: "bg-emerald-100 dark:bg-emerald-900/40",
  warning: "bg-amber-100 dark:bg-amber-900/40",
  danger: "bg-red-100 dark:bg-red-900/40",
  info: "bg-sky-100 dark:bg-sky-900/40",
};

const TEXT_CLASSES: Record<BadgeTone, string> = {
  neutral: "text-slate-700 dark:text-slate-300",
  brand: "text-brand-700 dark:text-brand-300",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  info: "text-sky-700 dark:text-sky-300",
};

/**
 * A small status pill — a grade letter, a course count, a state flag.
 *
 * Badges carry a tinted background *and* a matching dark text, so the label
 * stays readable in both appearances instead of relying on colour alone.
 *
 * The badge does not set its own cross-axis alignment: it inherits it from the
 * parent, so it hugs the text in a column and stays centred in a row.
 */
export function Badge({ label, tone = "neutral", className }: BadgeProps) {
  return (
    <View className={cn("rounded-full px-2 py-0.5", TONE_CLASSES[tone])}>
      <Text className={cn("text-[11px] leading-4 font-semibold", TEXT_CLASSES[tone])}>
        {label}
      </Text>
    </View>
  );
}
