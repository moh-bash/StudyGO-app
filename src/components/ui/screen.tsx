import { tabBarClearance } from "@/constants/theme";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  /**
   * Adds the top safe-area inset as padding.
   *
   * The three tab screens live inside `(app)/_layout.tsx`, which already pads
   * the whole tab navigator below the status bar — they pass `topInset={false}`.
   * Standalone screens (`course/[id]`, `add-course`) keep the default so they
   * do not slide under the notch.
   */
  topInset?: boolean;
  className?: string;
};

/**
 * The page shell every screen uses: a full-bleed canvas that respects the
 * safe area and the current appearance.
 */
export function Screen({ children, topInset = true, className }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn("flex-1 bg-white dark:bg-slate-950", className)}
      style={topInset ? { paddingTop: insets.top } : undefined}
    >
      {children}
    </View>
  );
}

type ScreenScrollProps = ScrollViewProps & {
  /**
   * Reserve room so the floating tab bar never covers the last row.
   *
   * Only the three tab screens need it — a standalone screen has no tab bar.
   */
  tabBar?: boolean;
  /** Keep the content clear of the home indicator. */
  bottomInset?: boolean;
  /** Class names for the content container (spacing between rows). */
  contentClassName?: string;
};

/**
 * The scrollable body of a screen.
 *
 * It owns the bottom padding rules so no screen has to re-derive them:
 * the home-indicator inset, and — on the tab screens — the clearance the
 * floating tab bar needs.
 */
export function ScreenScroll({
  tabBar = false,
  bottomInset = true,
  contentClassName,
  className,
  style,
  contentContainerStyle,
  children,
  ...rest
}: ScreenScrollProps) {
  const insets = useSafeAreaInsets();

  // With the floating tab bar the clearance already includes the home
  // indicator, because the bar floats above it.
  const paddingBottom = tabBar
    ? tabBarClearance(insets.bottom)
    : bottomInset
      ? Math.max(insets.bottom, 16)
      : 0;

  return (
    <ScrollView
      className={cn("flex-1", className)}
      style={style}
      contentContainerClassName={contentClassName}
      contentContainerStyle={{ ...contentContainerStyle, paddingBottom }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
