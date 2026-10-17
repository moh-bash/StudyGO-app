import { useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";
import { cn } from "@/lib/cn";
import { palette } from "@/constants/theme";

type Props = TextInputProps & {
  label?: string;
  icon?: LucideIcon;
  error?: string;
  showToggle?: boolean;
};

export function TextField({ label, icon: Icon, error, secureTextEntry, showToggle = true, className, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(!secureTextEntry);

  const isSecure = !!secureTextEntry;
  const shouldToggle = isSecure && showToggle;

  return (
    <View className={cn("w-full gap-2", className)}>
      {label ? <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</Text> : null}
      <View
        className={cn(
          "flex-row items-center gap-3 rounded-2xl border bg-white px-4 py-3 dark:bg-slate-900",
          focused ? "border-brand-500" : "border-slate-200 dark:border-slate-700",
          error ? "border-red-500" : ""
        )}
      >
        {Icon ? <Icon color={focused ? palette.brand600 : palette.slate400} size={20} /> : null}
        <TextInput
          className="flex-1 text-base text-slate-900 dark:text-white"
          secureTextEntry={isSecure && !visible}
          placeholderTextColor={palette.slate400}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {shouldToggle ? (
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8}>
            {visible ? <EyeOff color={palette.slate400} size={20} /> : <Eye color={palette.slate400} size={20} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
