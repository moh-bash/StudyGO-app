import { TABS } from "@/constants/tabs";
import { palette } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function FloatingTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const glass = isLiquidGlassAvailable();

  const borderColor = isDark ? "border-blue-400" : "border-slate-200/70";
  // With native liquid glass (iOS 26+) the GlassView provides the surface, so we
  // skip the solid backdrop to keep the blur visible; elsewhere use a frosted bar.
  const bgColor = glass ? "bg-transparent" : isDark ? "bg-slate-900/95" : "bg-white/95";
  const shadow = {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  };

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View
        className={cn(
          "mx-5 flex-row items-center rounded-[26px] border overflow-hidden",
          borderColor,
          bgColor,
          "px-2"
        )}
        style={{
          marginBottom: Math.max(insets.bottom, 10),
          height: 60,
          ...shadow,
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
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const isFocused = state.index === index;
          const Icon = tab.icon;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel || tab.label}
              onPress={onPress}
              onLongPress={onLongPress}
              className="flex-1 items-center justify-center"
              hitSlop={8}
            >
              <View
                className={cn(
                  "flex-row items-center rounded-full px-4 py-4 gap-2 animation-all  duration-10",
                  isFocused ? "bg-brand-600" : "bg-transparent"
                )}
              >
                <Icon color={isFocused ? "#fff" : isDark ? "#cbd5e1" : palette.slate500} size={22} />
                {isFocused ? (
                  <Text className="text-sm font-semibold text-white">{tab.label}</Text>
                ) : null}
              </View>
            </Pressable>
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
});
