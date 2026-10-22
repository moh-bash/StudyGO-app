import { accentClasses } from "@/constants/theme";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text } from "react-native";

type ChipProps = {
  label: string;
  /** A second line under the label (e.g. the number of subjects). */
  hint?: string;
  /** Whether this chip is the current selection. */
  active?: boolean;
  onPress: () => void;
  /** Overrides the spoken label when the visible one is not descriptive enough. */
  accessibilityLabel?: string;
  /** Greys the chip out and ignores presses. */
  disabled?: boolean;
  className?: string;
};

/**
 * A selectable pill — a semester, a filter, a scope.
 *
 * The selected chip is filled with the accent and uses the matching
 * high-contrast foreground, so the selection is readable without relying on
 * the fill alone.
 */
export function Chip({
  label,
  hint,
  active = false,
  onPress,
  accessibilityLabel,
  disabled = false,
  className,
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "items-center gap-0.5 rounded-full border px-4 py-2",
        accentClasses.pressable,
        active
          ? `${accentClasses.surface} ${accentClasses.onSurface} border-transparent`
          : "border-slate-200 bg-white text-slate-700 active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:active:bg-slate-800",
        disabled ? "opacity-50" : "",
        className,
      )}
    >
      <Text
        className={cn(
          "text-sm leading-5",
          active ? "font-semibold" : "font-medium",
        )}
      >
        {label}
      </Text>
      {hint ? (
        <Text
          className={cn(
            "text-[11px] leading-4",
            active ? "opacity-80" : "text-slate-400 dark:text-slate-500",
          )}
        >
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

type ChipRowProps = {
  children: ReactNode;
  /** Extra classes for the row itself. */
  className?: string;
  /** Extra classes for the scroll content. */
  contentClassName?: string;
};

/**
 * A horizontally scrolling row of chips.
 *
 * It never scrolls vertically, so a chip row can live inside a vertical
 * `ScrollView` without stealing the gesture.
 */
export function ChipRow({ children, className, contentClassName }: ChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={cn("flex-grow-0", className)}
      contentContainerClassName={cn("gap-2 px-6", contentClassName)}
    >
      {children}
    </ScrollView>
  );
}
