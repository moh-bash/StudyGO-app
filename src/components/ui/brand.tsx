import { useThemeColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { GraduationCap } from "lucide-react-native";
import { Text, View } from "react-native";

type BrandMarkProps = {
  /** The edge length of the tile. */
  size?: number;
  className?: string;
};

/**
 * The product mark: a rounded accent tile carrying the app's glyph.
 *
 * The glyph is drawn in the *on-accent* foreground, so it keeps the same
 * contrast guarantee as every other accent-filled surface.
 */
export function BrandMark({ size = 44, className }: BrandMarkProps) {
  const colors = useThemeColors();

  return (
    <View
      className={cn("items-center justify-center rounded-2xl", className)}
      style={{ width: size, height: size, backgroundColor: colors.accent }}
    >
      <GraduationCap color={colors.onAccent} size={Math.round(size * 0.55)} />
    </View>
  );
}

type BrandLockupProps = {
  size?: number;
  className?: string;
};

/**
 * The mark next to the product name.
 *
 * The app renders left-to-right but is written right-anchored, so the mark —
 * which leads the lockup in Arabic — is the last flex child and lands on the
 * right edge.
 */
export function BrandLockup({ size = 44, className }: BrandLockupProps) {
  return (
    <View className={cn("flex-row items-center gap-3", className)}>
      <Text className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        StudyGo
      </Text>
      <BrandMark size={size} />
    </View>
  );
}
