import { accentClasses, useThemeColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type LoadingStateProps = {
  /** The label under the spinner. */
  label?: string;
  className?: string;
};

/** The "we are fetching something" state. */
export function LoadingState({ label = "جارٍ التحميل…", className }: LoadingStateProps) {
  const colors = useThemeColors();

  return (
    <View className={cn("items-center justify-center gap-2 py-16", className)}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text className="text-sm text-slate-500 dark:text-slate-400">{label}</Text>
    </View>
  );
}

type ErrorStateProps = {
  message: string;
  /** Renders a retry button when provided. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra line under the message, e.g. "the data shown is cached". */
  hint?: string;
  className?: string;
};

/**
 * The "something went wrong" state.
 *
 * It always shows the server's own Arabic wording — the app never invents a
 * generic "something went wrong" for a failure it can describe.
 */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "إعادة المحاولة",
  hint,
  className,
}: ErrorStateProps) {
  return (
    <View
      className={cn(
        "items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/70 dark:bg-red-950/40",
        className,
      )}
    >
      <Text className="text-center text-sm text-red-600 dark:text-red-400">{message}</Text>
      {hint ? (
        <Text className="text-center text-xs text-slate-500 dark:text-slate-400">{hint}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          className={cn(
            "mt-1 rounded-full border border-red-200 px-4 py-2 active:opacity-70",
            "dark:border-red-900/70",
          )}
        >
          <Text className="text-sm font-semibold text-red-600 dark:text-red-400">{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type EmptyStateProps = {
  /** A short Arabic title — what is missing. */
  title: string;
  /** A sentence explaining what to do next. */
  description?: string;
  /** Optional illustration. */
  icon?: LucideIcon;
  /** Optional call to action. */
  action?: ReactNode;
  className?: string;
};

/**
 * The "there is nothing here yet" state.
 *
 * Every screen that can be empty renders this instead of an improvised
 * layout, so the "nothing here" moment always looks the same.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: EmptyStateProps) {
  const colors = useThemeColors();

  return (
    <View className={cn("items-center justify-center gap-3 px-4 py-12", className)}>
      {Icon ? (
        <View
          className={cn(
            "h-16 w-16 items-center justify-center rounded-full",
            accentClasses.soft,
          )}
        >
          <Icon color={colors.accent} size={30} />
        </View>
      ) : null}
      <Text className="text-center text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </Text>
      {description ? (
        <Text className="text-center text-sm leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </Text>
      ) : null}
      {action ? <View className="w-full max-w-xs pt-1">{action}</View> : null}
    </View>
  );
}
