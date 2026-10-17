import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { useCatalog } from '@/features/courses/use-catalog';

export default function CourseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { catalog, loading } = useCatalog();

  const subject = catalog?.subjects.find((s) => s.id === id) ?? null;
  const sections = catalog?.sections.filter((sec) => sec.subjectId === id) ?? [];

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      <ScrollView className="flex-1 px-6" contentContainerClassName="gap-4 pt-10 pb-6">
        {loading ? (
          <Text className="text-center text-sm text-slate-500 dark:text-slate-400">جارٍ التحميل...</Text>
        ) : subject ? (
          <>
            <View className="gap-1">
              <Text className="text-xs text-slate-500 dark:text-slate-400">{subject.code}</Text>
              <Text className="text-2xl font-bold text-slate-900 dark:text-white">{subject.nameAr}</Text>
              <Text className="text-sm text-slate-500 dark:text-slate-400">{subject.nameEn}</Text>
            </View>

            <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <Text className="text-sm font-semibold text-slate-900 dark:text-white">معلومات المقرر</Text>
              <View className="flex-row justify-between">
                <Text className="text-sm text-slate-500 dark:text-slate-400">الساعات المعتمدة</Text>
                <Text className="text-sm font-medium text-slate-900 dark:text-white">{subject.creditHours}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-slate-500 dark:text-slate-400">وزن المشروع</Text>
                <Text className="text-sm font-medium text-slate-900 dark:text-white">{subject.projectWeight}%</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-slate-500 dark:text-slate-400">وزن الامتحان</Text>
                <Text className="text-sm font-medium text-slate-900 dark:text-white">{subject.examWeight}%</Text>
              </View>
            </View>

            {sections.length > 0 ? (
              <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <Text className="text-sm font-semibold text-slate-900 dark:text-white">الشعب ({sections.length})</Text>
                {sections.map((sec) => (
                  <View key={sec.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                    <Text className="text-sm font-medium text-slate-900 dark:text-white">شعبة {sec.code}</Text>
                    {sec.location ? (
                      <Text className="text-xs text-slate-500 dark:text-slate-400">الموقع: {sec.location}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            <View className="items-center pt-4">
              <Text className="text-xs text-slate-400 dark:text-slate-600">تفاصيل إضافية قريبًا</Text>
            </View>
          </>
        ) : (
          <Text className="text-center text-sm text-slate-500 dark:text-slate-400">المقرر غير موجود</Text>
        )}
      </ScrollView>

      <View className="px-6" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <Button label="عودة" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}
