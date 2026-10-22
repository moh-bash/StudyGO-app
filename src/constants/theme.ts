import { useColorScheme } from "react-native";

/**
 * StudyGO design tokens.
 *
 * This file is the single source of truth for the values that cannot be
 * expressed as Tailwind classes: icon `color` props, `ActivityIndicator`
 * tints, refresh-control colours and elevation.
 *
 * The app supports both appearances (`userInterfaceStyle: "automatic"` in
 * `app.json`), so there are two palettes. Prefer {@link useThemeColors} inside
 * a component over hard-coding a hex value — that is what keeps an icon from
 * disappearing against a dark surface.
 *
 * Neutral surfaces and text use the `slate` scale, the accent uses `brand`,
 * and the status colours (`success` / `warning` / `danger` / `info`) are the
 * only other hues the product is allowed to introduce. See
 * `src/components/ui/*` for the components that apply them.
 */

/** Light-appearance palette. */
export const palette = {
  /** The product accent (kept identical to `brand-600` in `global.css`). */
  brand: "#208aef",
  brand600: "#208aef",
  brand700: "#1a6fdb",
  /** Tinted accent background for selected/active surfaces. */
  brandSoft: "#e8f2fe",
  /**
   * The accent used for *filled* surfaces and for accent text on a neutral
   * surface. `brand-700` rather than `brand-600` because white on `#208aef`
   * only reaches 3.54:1 — below the 4.5:1 minimum for body text. On
   * `#1a6fdb` white reaches 4.84:1.
   */
  accent: "#1a6fdb",
  /** Foreground colour for text and icons drawn on an accent-filled surface. */
  onAccent: "#ffffff",
  /** Filled danger surface (destructive buttons). */
  dangerSurface: "#dc2626",
  /** Foreground colour for text and icons drawn on a danger-filled surface. */
  onDanger: "#ffffff",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  /** The app's darkest neutral — used as a foreground on light accent fills. */
  slate950: "#020617",
  /** Page background. */
  canvas: "#ffffff",
  /** Raised surface (cards, sheets, bars). */
  surface: "#ffffff",
  /** Recessed surface (inset rows, muted panels). */
  surfaceMuted: "#f8fafc",
  /** Hairline border on raised surfaces. */
  border: "#e2e8f0",
  white: "#ffffff",
  danger: "#ef4444",
  success: "#22c55e",
  warning: "#d97706",
  info: "#0284c7",
} as const;

/**
 * Dark-appearance palette.
 *
 * The neutral scale is inverted for *readable* roles (secondary text, icon
 * tints) while the structural roles keep pointing at the same surfaces the
 * Tailwind `dark:` variants use (`slate-950` canvas, `slate-900` cards).
 */
export const darkPalette = {
  brand: "#59a8ff",
  brand600: "#3388fb",
  brand700: "#208aef",
  brandSoft: "#142f56",
  /**
   * Dark mode flips the accent: `brand-400` on a near-black canvas reaches
   * 8.14:1 against the slate-950 foreground, so accent fills carry dark text
   * instead of white.
   */
  accent: "#59a8ff",
  onAccent: "#020617",
  dangerSurface: "#f87171",
  onDanger: "#020617",
  slate50: "#0f172a",
  slate100: "#1e293b",
  slate200: "#334155",
  slate300: "#475569",
  slate400: "#64748b",
  slate500: "#94a3b8",
  slate600: "#cbd5e1",
  slate700: "#e2e8f0",
  slate800: "#f1f5f9",
  slate900: "#f8fafc",
  slate950: "#020617",
  canvas: "#020617",
  surface: "#0f172a",
  surfaceMuted: "#1e293b",
  border: "#1e293b",
  white: "#f8fafc",
  danger: "#f87171",
  success: "#4ade80",
  warning: "#fbbf24",
  info: "#38bdf8",
} as const;

/**
 * The palette shape.
 *
 * Both appearances expose exactly the same roles, so the type is derived from
 * the light palette — but the values are widened to `string`, because the two
 * palettes hold different colours for the same role.
 */
export type ThemeColors = { readonly [K in keyof typeof palette]: string };

/**
 * The palette that matches the current appearance.
 *
 * React Compiler memoises components, so the colour scheme is read here (a
 * hook) rather than read once at module scope — otherwise a theme switch
 * would not repaint the icons.
 */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkPalette : palette;
}

/**
 * Corner radii, in points. Screens use Tailwind's `rounded-*` utilities for
 * layout; these exist for the few places that need the value in JavaScript
 * (e.g. a native sheet's corner radius).
 */
export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/**
 * Elevation presets.
 *
 * Uses the modern `boxShadow` style prop (React Native 0.76+); the legacy
 * `shadow*`/`elevation` props are deliberately avoided so that Android and
 * iOS render the same soft shadow instead of a hard grey rectangle.
 */
export const shadows = {
  /** Cards and list rows — barely there, just enough to lift the surface. */
  card: "0 1px 2px rgba(15, 23, 42, 0.05)",
  /** Floating bars and sheets — a soft, wide shadow. */
  floating: "0 10px 30px rgba(15, 23, 42, 0.12)",
} as const;

/**
 * The type scale.
 *
 * Arabic script needs a little more leading than Latin at the same size, so
 * every step ships an explicit line height. Screens apply these through the
 * matching Tailwind utilities (`text-2xl` + `leading-8`, …) — the object is
 * the reference for what those combinations should be.
 */
export const typography = {
  display: { size: 30, lineHeight: 38 },
  title: { size: 24, lineHeight: 32 },
  heading: { size: 18, lineHeight: 26 },
  body: { size: 16, lineHeight: 24 },
  label: { size: 15, lineHeight: 22 },
  caption: { size: 13, lineHeight: 19 },
  micro: { size: 11, lineHeight: 16 },
} as const;

/**
 * Metrics of the floating tab bar (`src/components/floating-tab-bar.tsx`).
 *
 * The bar floats above the content, so every scrollable screen has to reserve
 * room for it. The numbers live here so the bar and the screens that clear it
 * can never drift apart.
 */
export const tabBar = {
  /** Height of the bar itself, in points. */
  height: 64,
  /** Smallest gap kept between the bar and the bottom edge of the screen. */
  minBottomMargin: 10,
  /** Breathing room between the last content row and the bar. */
  contentGap: 16,
} as const;

/**
 * The vertical space a scrollable screen must leave free so the floating tab
 * bar never covers its last item.
 *
 * @param bottomInset The screen's bottom safe-area inset.
 */
export function tabBarClearance(bottomInset: number): number {
  return (
    tabBar.height + Math.max(bottomInset, tabBar.minBottomMargin) + tabBar.contentGap
  );
}

/**
 * Shared Tailwind class fragments.
 *
 * NativeWind compiles class names statically, so a fragment that is built at
 * runtime (e.g. `` `bg-${color}-600` ``) is never emitted. Keeping the
 * interesting combinations here as complete literals means every screen
 * applies exactly the same accent treatment — and the same contrast pair.
 *
 * The app renders left-to-right but is written right-anchored: the primary
 * Arabic label is the **last** flex child, so it lands on the right.
 */
export const accentClasses = {
  /** A filled accent surface with a readable foreground. */
  surface: "bg-brand-700 dark:bg-brand-400",
  /** Foreground for text and icons on {@link accentClasses.surface}. */
  onSurface: "text-white dark:text-slate-950",
  /** Pressed state of a filled accent surface. */
  surfacePressed: "active:bg-brand-800 dark:active:bg-brand-500",
  /** Accent text and icons on a neutral surface. */
  text: "text-brand-700 dark:text-brand-400",
  /** Tinted accent background for selected or highlighted surfaces. */
  soft: "bg-brand-50 dark:bg-brand-950/40",
  /** Border for tinted accent surfaces. */
  softBorder: "border-brand-200 dark:border-brand-900",
  /** Press feedback shared by every pressable surface. */
  pressable: "active:scale-[0.98] active:opacity-95",
} as const;
