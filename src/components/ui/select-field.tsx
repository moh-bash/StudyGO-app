import { useThemeColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, X, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SelectOption = {
  value: string;
  label: string;
  /** Optional secondary line, e.g. a program code. */
  hint?: string | null;
};

type Props = {
  label?: string;
  placeholder?: string;
  icon?: LucideIcon;
  value: string | null;
  options: SelectOption[];
  onSelect: (value: string) => void;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
  emptyText?: string;
};

/**
 * A form field that opens a modal list of options.
 *
 * A modal list (rather than the platform `Picker`) keeps the field visually
 * consistent with {@link TextField} and behaves identically on iOS, Android and
 * web, including a loading state while options are fetched.
 */
export function SelectField({
  label,
  placeholder = "اختر…",
  icon: Icon,
  value,
  options,
  onSelect,
  loading = false,
  error,
  disabled = false,
  emptyText = "لا توجد خيارات متاحة.",
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;
  const isDisabled = disabled || loading;

  return (
    <View className="w-full gap-2">
      {label ? (
        <Text className="text-right text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="combobox"
        accessibilityState={{ expanded: open, disabled: isDisabled }}
        accessibilityLabel={label ?? placeholder}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        onPress={() => setOpen(true)}
        disabled={isDisabled}
        className={cn(
          "min-h-[52px] flex-row items-center gap-3 rounded-2xl border bg-white px-4 py-2.5 dark:bg-slate-900",
          error ? "border-red-500" : "border-slate-200 dark:border-slate-700",
          isDisabled ? "opacity-60" : "active:border-brand-500",
        )}
      >
        {/* The chevron trails on the left and the adornment leads on the
            right, matching the Arabic reading order. */}
        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <ChevronDown color={colors.slate400} size={20} />
        )}
        <Text
          className={cn(
            "flex-1 text-right text-base leading-6",
            selected ? "text-slate-900 dark:text-white" : "text-slate-400",
          )}
          numberOfLines={1}
        >
          {selected ? selected.label : loading ? "جارٍ التحميل…" : placeholder}
        </Text>
        {Icon ? <Icon color={colors.slate400} size={20} /> : null}
      </Pressable>
      {error ? (
        <Text className="text-right text-xs leading-4 text-red-500">{error}</Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          accessibilityRole="button"
          accessibilityLabel="إغلاق القائمة"
          onPress={() => setOpen(false)}
        >
          <Pressable
            className="rounded-t-3xl bg-white dark:bg-slate-900"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
                onPress={() => setOpen(false)}
                hitSlop={8}
                className="h-11 w-11 items-center justify-center"
              >
                <X color={colors.slate400} size={20} />
              </Pressable>
              <Text className="flex-1 text-right text-base font-semibold text-slate-900 dark:text-white">
                {label ?? placeholder}
              </Text>
            </View>
            {options.length === 0 ? (
              <Text className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {emptyText}
              </Text>
            ) : (
              <FlatList
                data={options}
                keyExtractor={(option) => option.value}
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => {
                  const isSelected = item.value === value;
                  return (
                    <Pressable
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onSelect(item.value);
                        setOpen(false);
                      }}
                      className="flex-row items-center gap-3 px-6 py-4 active:bg-slate-50 dark:active:bg-slate-800"
                    >
                      <View className="flex-1 items-end gap-0.5">
                        <Text className="text-base text-slate-900 dark:text-white">{item.label}</Text>
                        {item.hint ? (
                          <Text className="text-xs text-slate-500 dark:text-slate-400">
                            {item.hint}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected ? <Check color={colors.accent} size={20} /> : null}
                    </Pressable>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
