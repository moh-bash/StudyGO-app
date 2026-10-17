import { cn } from "@/lib/cn";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "ghost";

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({ label, variant = "primary", loading = false, fullWidth = true, className, disabled, ...rest }: Props) {
  const isDisabled = disabled || loading;

  const base = "flex-row items-center justify-center rounded-full py-4 px-6 gap-2";
  const variants = {
    primary: isDisabled ? "bg-brand-400 opacity-70" : "bg-brand-600 active:bg-brand-700",
    secondary: isDisabled ? "bg-slate-100/70 opacity-70 dark:bg-slate-800/70" : "bg-slate-100 active:bg-slate-200 dark:bg-slate-800 dark:active:bg-slate-700",
    ghost: "bg-transparent active:opacity-80",
  } as const;

  const textVariants = {
    primary: "text-white font-semibold text-base",
    secondary: "text-slate-900 dark:text-white font-semibold text-base",
    ghost: "text-brand-600 font-semibold text-base",
  } as const;

  return (
    <Pressable
      className={cn(base, variants[variant], fullWidth ? "w-full" : "", className)}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? <ActivityIndicator size="small" color={variant === "primary" ? "#fff" : "#208aef"} /> : null}
      <Text className={textVariants[variant]}>{label}</Text>
    </Pressable>
  );
}
