import { Pressable, Text, View } from 'react-native';

type Props = {
  code: string;
  nameAr: string;
  creditHours: number;
  semesterName: string;
  onPress?: () => void;
};

export function CourseCard({ code, nameAr, creditHours, semesterName, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:active:bg-slate-800"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-slate-900 dark:text-white">{nameAr}</Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400">{semesterName}</Text>
        </View>
        <View className="items-end gap-1">
          <View className="rounded-full bg-brand-100 px-2 py-1 dark:bg-brand-900/40">
            <Text className="text-xs font-medium text-brand-700 dark:text-brand-300">{code}</Text>
          </View>
          <Text className="text-xs text-slate-500 dark:text-slate-400">{`${creditHours} ساعة`} </Text>
        </View>
      </View>
    </Pressable>
  );
}
