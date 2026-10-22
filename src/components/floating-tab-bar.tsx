import { TABS } from "@/constants/tabs";
import { shadows, tabBar, useThemeColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import type { LucideIcon } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, View, useColorScheme } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabItemProps = {
  label: string;
  icon: LucideIcon;
  focused: boolean;
  /** The accent used for the selected indicator and the selected label. */
  accent: string;
  /** The foreground drawn on top of the accent indicator. */
  onAccent: string;
  /** The colour of an unselected icon and label. */
  inactive: string;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress: () => void;
};

/**
 * One tab of the floating bar.
 *
 * The selected tab gets a filled chip behind its icon; the chip and the label
 * colour are animated on the UI thread, so the transition stays smooth even
 * while the JS thread is busy rebuilding a screen.
 *
 * The icon is drawn twice — once in the selected colour, once in the idle one
 * — and the two are cross-faded, because a vector icon's `color` prop cannot
 * be animated on the UI thread.
 */
function TabItem({
  label,
  icon: Icon,
  focused,
  accent,
  onAccent,
  inactive,
  accessibilityLabel,
  onPress,
  onLongPress,
}: TabItemProps) {
  const focus = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [focused, focus]);

  const chipStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scale: 0.82 + 0.18 * focus.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(focus.value, [0, 1], [inactive, accent]),
  }));

  const selectedIconStyle = useAnimatedStyle(() => ({ opacity: focus.value }));
  const idleIconStyle = useAnimatedStyle(() => ({ opacity: 1 - focus.value }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-1 items-center justify-center"
      hitSlop={6}
    >
      <View pointerEvents="none" style={styles.stack}>
        <View style={styles.iconSlot}>
          {/* The chip lives inside the icon slot so the two can never drift
              apart: the slot is the single source of truth for both. */}
          <Animated.View
            style={[styles.chip, { backgroundColor: accent }, chipStyle]}
          />
          <Animated.View style={[styles.iconLayer, selectedIconStyle]}>
            <Icon color={onAccent} size={22} />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, idleIconStyle]}>
            <Icon color={inactive} size={22} />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

/**
 * The app's floating tab bar.
 *
 * It floats above the content (the screens reserve the clearance themselves
 * through `tabBarClearance`), so on iOS 26+ it can use the real liquid glass
 * and elsewhere it falls back to a frosted surface.
 */
export function FloatingTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useColorScheme() === "dark";
  const glass = isLiquidGlassAvailable();

  const borderColor = isDark ? "border-slate-700/60" : "border-slate-200/70";
  // With native liquid glass (iOS 26+) the GlassView provides the surface, so we
  // skip the solid backdrop to keep the blur visible; elsewhere use a frosted bar.
  const bgColor = glass ? "bg-transparent" : isDark ? "bg-slate-900/95" : "bg-white/95";

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View
        className={cn(
          "mx-5 flex-row items-center justify-between rounded-[28px] border px-2",
          borderColor,
          bgColor,
        )}
        style={{
          marginBottom: Math.max(insets.bottom, tabBar.minBottomMargin),
          height: tabBar.height,
          boxShadow: shadows.floating,
        }}
      >
        {glass ? (
          <GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            tintColor={isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(255, 255, 255, 0.6)"}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const tab = TABS.find((entry) => entry.name === route.name);
          if (!tab) return null;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(route.name as never);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              label={tab.label}
              icon={tab.icon}
              focused={isFocused}
              accent={colors.accent}
              onAccent={colors.onAccent}
              inactive={colors.slate500}
              accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel || tab.label}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  /** The accent chip drawn behind the selected icon (fills the icon slot). */
  chip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  stack: {
    alignItems: "center",
    gap: 2,
  },
  iconSlot: {
    width: 48,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
