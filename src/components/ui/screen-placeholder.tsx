import { Text, View } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
};

export function ScreenPlaceholder({ title, subtitle }: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-slate-950 px-6">
      <Text className="text-2xl font-bold text-slate-900 dark:text-white text-center">{title}</Text>
      {subtitle ? <Text className="mt-2 text-slate-500 dark:text-slate-400 text-center">{subtitle}</Text> : null}
    </View>
  );
}
