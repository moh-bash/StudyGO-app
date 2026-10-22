import { accentClasses } from "@/constants/theme";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { Pressable, View, type PressableProps, type ViewProps } from "react-native";

type CardTone = "default" | "muted" | "accent";

type CardProps = ViewProps & {
  children: ReactNode;
  /** Drop the default inner padding (the card then hosts its own rows). */
  flush?: boolean;
  /**
   * `default` is a raised white surface, `muted` is a recessed panel and
   * `accent` is the tinted surface used for the one highlighted block on a
   * screen.
   */
  tone?: CardTone;
};

/**
 * The base surface of the app: a rounded, hairline-bordered panel.
 *
 * The border is one step lighter than the surface it sits on (`slate-800` on
 * the dark `slate-900` card) so a card reads as a card without a heavy
 * outline.
 */
export function Card({ children, flush = false, tone = "default", className, ...rest }: CardProps) {
  return (
    <View
      className={cn(
        "rounded-2xl border",
        tone === "default" &&
          "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        tone === "muted" &&
          "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60",
        tone === "accent" &&
          `${accentClasses.softBorder} ${accentClasses.soft}`,
        flush ? "" : "p-4",
        className,
      )}
      {...rest}
    >
      {children}
    </View>
  );
}

type PressableCardProps = PressableProps & {
  children: ReactNode;
  tone?: CardTone;
};

/**
 * A {@link Card} the student can press.
 *
 * The press feedback is pure CSS: NativeWind compiles `active:` variants into
 * the press handlers React Native's `Pressable` already exposes, so the dip
 * costs no JavaScript and no extra animation work.
 */
export function PressableCard({ children, tone = "default", className, ...rest }: PressableCardProps) {
  return (
    <Pressable
      className={cn(
        "rounded-2xl border",
        accentClasses.pressable,
        tone === "default" &&
          "border-slate-200 bg-white active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800",
        tone === "muted" &&
          "border-slate-200 bg-slate-50 active:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:active:bg-slate-800/60",
        tone === "accent" &&
          `${accentClasses.softBorder} ${accentClasses.soft} active:opacity-90`,
        className,
      )}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
