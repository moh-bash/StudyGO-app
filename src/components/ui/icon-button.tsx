import { useThemeColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, type PressableProps } from "react-native";

type IconButtonProps = Omit<PressableProps, "children"> & {
  icon: LucideIcon;
  /**
   * The accessible name.
   *
   * An icon-only button has no visible text, so the label is the only thing
   * assistive technology can announce — it is required, not optional.
   */
  label: string;
  /** The icon's edge length. */
  size?: number;
  /** The colour of the glyph. */
  tone?: "neutral" | "brand" | "danger";
  /** `ghost` has no surface, `surface` sits on a filled circle. */
  variant?: "ghost" | "surface";
  className?: string;
};

/**
 * A 44pt icon-only button.
 *
 * 44×44 is the smallest reliably tappable target on both platforms; the icon
 * itself is smaller, so the button keeps a transparent padding ring around it.
 */
export function IconButton({
  icon: Icon,
  label,
  size = 20,
  tone = "neutral",
  variant = "ghost",
  className,
  ...rest
}: IconButtonProps) {
  const colors = useThemeColors();

  const toneColor = {
    neutral: colors.slate500,
    brand: colors.accent,
    danger: colors.danger,
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        "h-11 w-11 items-center justify-center rounded-full active:opacity-70",
        variant === "surface" &&
          "bg-slate-100 active:bg-slate-200 dark:bg-slate-800 dark:active:bg-slate-700",
        className,
      )}
      {...rest}
    >
      <Icon color={toneColor} size={size} />
    </Pressable>
  );
}
