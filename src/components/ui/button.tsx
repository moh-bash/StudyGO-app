import { accentClasses, useThemeColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  /** An icon rendered before the label (to its left in the right-anchored layout). */
  icon?: LucideIcon;
  /**
   * Fire a light haptic when the button is pressed.
   *
   * On by default for the primary and danger variants — the two the student
   * is meant to notice — and off for the quiet ones.
   */
  haptic?: boolean;
};

/**
 * The app's button.
 *
 * The filled variants use the accent pair from {@link accentClasses}, which
 * keeps white-on-accent above the 4.5:1 contrast minimum in light mode and
 * dark-on-accent above it in dark mode.
 */
export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = true,
  icon: Icon,
  haptic,
  className,
  disabled,
  onPress,
  ...rest
}: Props) {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;

  const base = "flex-row items-center justify-center gap-2 active:scale-[0.98]";
  const sizes = {
    sm: "min-h-11 rounded-full px-4 py-2.5",
    md: "rounded-full px-5 py-3.5",
    lg: "rounded-2xl px-6 py-4",
  } as const;

  const variants = {
    primary: `${accentClasses.surface} ${accentClasses.surfacePressed} ${accentClasses.onSurface}`,
    secondary:
      "bg-slate-100 text-slate-900 active:bg-slate-200 dark:bg-slate-800 dark:text-white dark:active:bg-slate-700",
    outline:
      "border border-slate-200 bg-white text-slate-900 active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:active:bg-slate-800",
    ghost: "bg-transparent text-brand-700 active:bg-slate-100 dark:text-brand-400 dark:active:bg-slate-800",
    danger: "bg-red-600 text-white active:bg-red-700 dark:bg-red-400 dark:text-slate-950 dark:active:bg-red-300",
  } as const;

  const textVariants = {
    primary: "font-semibold",
    secondary: "font-semibold",
    outline: "font-semibold",
    ghost: "font-semibold",
    danger: "font-semibold",
  } as const;

  const textSizes = {
    sm: "text-sm leading-5",
    md: "text-base leading-6",
    lg: "text-base leading-6",
  } as const;

  const spinnerColor = {
    primary: colors.onAccent,
    secondary: colors.slate900,
    outline: colors.slate900,
    ghost: colors.accent,
    danger: colors.onDanger,
  }[variant];

  const handlePress: PressableProps["onPress"] = (event) => {
    if (haptic ?? (variant === "primary" || variant === "danger")) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(event);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
      className={cn(
        base,
        sizes[size],
        variants[variant],
        isDisabled ? "opacity-60" : "",
        fullWidth ? "w-full" : "",
        className,
      )}
      disabled={isDisabled}
      onPress={handlePress}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : Icon ? (
        <Icon color={spinnerColor} size={18} />
      ) : null}
      <Text className={cn(textVariants[variant], textSizes[size])}>{label}</Text>
    </Pressable>
  );
}
