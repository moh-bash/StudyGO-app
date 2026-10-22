import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Rendered on the trailing (left) edge — e.g. a refresh or an add action. */
  action?: ReactNode;
  /** Rendered next to the action, still on the trailing edge. */
  secondary?: ReactNode;
  /**
   * Rendered on the leading (right) edge.
   *
   * Arabic reads from the right, so a back button belongs here and points
   * right — the same place the platform puts it in a right-to-left layout.
   */
  leading?: ReactNode;
  /**
   * Centre the title instead of anchoring it to the right.
   *
   * Screens whose title is the only thing on the bar (a modal sheet, for
   * instance) read better centred; every other screen anchors the Arabic
   * title to the right.
   */
  centered?: boolean;
  className?: string;
};

/**
 * The title bar of a screen.
 *
 * The app renders left-to-right but is written right-anchored, so the primary
 * Arabic label is the **last** flex child and lands on the right edge.
 */
export function ScreenHeader({
  title,
  subtitle,
  action,
  secondary,
  leading,
  centered = false,
  className,
}: ScreenHeaderProps) {
  const titleBlock = (
    <View className={cn("min-w-0 gap-0.5", centered ? "flex-1 items-center" : "flex-1 items-end")}>
      <Text
        className="text-2xl font-bold text-slate-900 dark:text-white"
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          className="text-xs text-slate-500 dark:text-slate-400"
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (centered) {
    return (
      <View className={cn("flex-row items-center gap-3 px-6 pb-3 pt-4", className)}>
        {action ? <View className="flex-row items-center gap-2">{action}</View> : null}
        {titleBlock}
        {leading ? <View className="flex-row items-center gap-2">{leading}</View> : null}
      </View>
    );
  }

  return (
    <View className={cn("flex-row items-center gap-3 px-6 pb-3 pt-4", className)}>
      {action ? <View className="flex-row items-center gap-2">{action}</View> : null}
      {secondary ? <View className="flex-row items-center gap-2">{secondary}</View> : null}
      {titleBlock}
      {leading ? <View className="flex-row items-center gap-2">{leading}</View> : null}
    </View>
  );
}
