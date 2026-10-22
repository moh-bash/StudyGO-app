import { useThemeColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

export type CalloutTone = "info" | "warning" | "danger" | "success" | "brand" | "neutral";

type CalloutProps = {
  tone?: CalloutTone;
  /** A short bold line above the message. */
  title?: string;
  message: string;
  /** The leading icon. It sits at the right edge, where Arabic reads first. */
  icon?: LucideIcon;
  /** A quieter line under the message. */
  hint?: string;
  /** An optional action (a button, a link) under the message. */
  action?: ReactNode;
  className?: string;
};

const SURFACE: Record<CalloutTone, string> = {
  info: "border-sky-200 bg-sky-50 dark:border-sky-900/70 dark:bg-sky-950/40",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/40",
  danger: "border-red-200 bg-red-50 dark:border-red-900/70 dark:bg-red-950/40",
  success: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/40",
  brand: "border-brand-200 bg-brand-50 dark:border-brand-900/70 dark:bg-brand-950/30",
  neutral: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60",
};

const TITLE: Record<CalloutTone, string> = {
  info: "text-sky-800 dark:text-sky-200",
  warning: "text-amber-800 dark:text-amber-200",
  danger: "text-red-800 dark:text-red-200",
  success: "text-emerald-800 dark:text-emerald-200",
  brand: "text-brand-800 dark:text-brand-200",
  neutral: "text-slate-800 dark:text-slate-200",
};

const MESSAGE: Record<CalloutTone, string> = {
  info: "text-sky-700 dark:text-sky-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  success: "text-emerald-700 dark:text-emerald-300",
  brand: "text-brand-800 dark:text-brand-200",
  neutral: "text-slate-600 dark:text-slate-400",
};

/**
 * An inline notice — a warning, an error, a hint.
 *
 * Every notice in the app uses this one component, so a warning always looks
 * the same wherever it appears, and the Arabic message is always right-anchored.
 */
export function Callout({
  tone = "info",
  title,
  message,
  icon: Icon,
  hint,
  action,
  className,
}: CalloutProps) {
  const colors = useThemeColors();

  const iconColor = {
    info: colors.info,
    warning: colors.warning,
    danger: colors.danger,
    success: colors.success,
    brand: colors.accent,
    neutral: colors.slate500,
  }[tone];

  return (
    <View className={cn("gap-2 rounded-2xl border p-3", SURFACE[tone], className)}>
      <View className="flex-row items-start gap-2">
        <View className="flex-1 items-end gap-1">
          {title ? (
            <Text className={cn("text-right text-sm font-semibold", TITLE[tone])}>{title}</Text>
          ) : null}
          <Text className={cn("text-right text-xs leading-5", MESSAGE[tone])}>{message}</Text>
          {hint ? (
            <Text className="text-right text-[11px] leading-4 opacity-80">{hint}</Text>
          ) : null}
        </View>
        {Icon ? <Icon color={iconColor} size={18} /> : null}
      </View>
      {action ? <View className="items-stretch">{action}</View> : null}
    </View>
  );
}
