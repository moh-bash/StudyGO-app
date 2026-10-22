import { useThemeColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";
import { useId, useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

type Props = TextInputProps & {
  label?: string;
  icon?: LucideIcon;
  error?: string;
  /** A short line under the field explaining what to type. */
  hint?: string;
  showToggle?: boolean;
  /**
   * The alignment of the typed text.
   *
   * Arabic fields read right-to-left, so they default to `"right"`. Latin
   * fields (an email address, a phone number) pass `"left"`.
   */
  textAlign?: "left" | "right" | "center";
};

/**
 * The app's text field.
 *
 * The field is a labelled group: a caption above, the input in the middle and
 * either a hint or an error below. The input itself is right-aligned by
 * default because the primary language is Arabic.
 */
export function TextField({
  label,
  icon: Icon,
  error,
  hint,
  secureTextEntry,
  showToggle = true,
  textAlign = "right",
  className,
  style,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(!secureTextEntry);
  const colors = useThemeColors();

  const isSecure = !!secureTextEntry;
  const shouldToggle = isSecure && showToggle;

  // A stable id so the field is identifiable on web and its visible label is
  // programmatically associated with it. Without these the web build logged
  // "A form field element should have an id or name attribute" and assistive
  // technology had no accessible name for the input. Callers may override the id.
  // (`name` is deliberately not set: React Native Web's TextInput does not
  // forward it to the DOM input, so `id` is the attribute that satisfies both.)
  const generatedId = useId();
  const id = rest.id ?? `field-${generatedId.replace(/[:»]/g, "")}`;

  return (
    <View className={cn("w-full gap-2", className)}>
      {label ? (
        <Text
          nativeID={`${id}-label`}
          className="text-right text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </Text>
      ) : null}
      <View
        className={cn(
          "min-h-[52px] flex-row items-center gap-3 rounded-2xl border bg-white px-4 py-2.5 dark:bg-slate-900",
          focused ? "border-brand-500" : "border-slate-200 dark:border-slate-700",
          error ? "border-red-500" : "",
        )}
      >
        {/* The trailing control sits on the left and the leading adornment on
            the right, because Arabic reads from the right: the icon belongs
            next to where the text starts, and the eye toggle trails it. */}
        {shouldToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center"
          >
            {visible ? (
              <EyeOff color={colors.slate400} size={20} />
            ) : (
              <Eye color={colors.slate400} size={20} />
            )}
          </Pressable>
        ) : null}
        <TextInput
          {...rest}
          id={id}
          aria-labelledby={label ? `${id}-label` : undefined}
          style={{ textAlign, ...style }}
          className="flex-1 text-base leading-6 text-slate-900 dark:text-white"
          secureTextEntry={isSecure && !visible}
          placeholderTextColor={colors.slate400}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        />
        {Icon ? (
          <Icon color={focused ? colors.accent : colors.slate400} size={20} />
        ) : null}
      </View>
      {error ? (
        <Text className="text-right text-xs leading-4 text-red-500">{error}</Text>
      ) : hint ? (
        <Text className="text-right text-xs leading-4 text-slate-500 dark:text-slate-400">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
