import { CourseCard } from '@/components/courses/course-card';
import { palette } from '@/constants/theme';
import { useCourses } from '@/features/courses/use-courses';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CoursesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selections, loading, fromCache, error } = useCourses();

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      <View className="flex flex-row justify-between items-center gap-2 px-6 pt-6">
        <Pressable onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/add-course' as any)
          }}>
          <View className="p-2 rounded-full bg-brand-500">
            <Plus color="#fff" size={32} />
          </View>
        </Pressable>
        <Text className="text-2xl text-slate-500 dark:text-slate-200">المقررات</Text>
      </View>

      <View className="flex-1 px-6" style={{ paddingBottom: Math.max(insets.bottom, 90) }}>
        {loading ? (
          <View className="flex-1 items-center justify-center gap-2">
            <ActivityIndicator size="large" color={palette.brand600} />
            <Text className="text-sm text-slate-500 dark:text-slate-400">جارٍ التحميل...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center gap-2">
            <Text className="text-center text-sm text-red-500">{error}</Text>
            {fromCache ? (
              <Text className="text-center text-xs text-slate-500 dark:text-slate-400">يتم عرض بيانات محفوظة.</Text>
            ) : null}
          </View>
        ) : selections.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-2">
            <Text className="text-center text-sm text-slate-500 dark:text-slate-400">لا توجد مقررات محفوظة.</Text>
            <Text className="text-center text-xs text-slate-400 dark:text-slate-600">اضغط على + لإضافة مقررات.</Text>
          </View>
        ) : (
          <FlatList
            data={selections}
            keyExtractor={(s) => `${s.semester.id}-${s.subject.id}`}
            contentContainerClassName="gap-3 py-4"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CourseCard
                code={item.subject.code}
                nameAr={item.subject.nameAr}
                creditHours={item.subject.creditHours}
                semesterName={item.semester.name}
                onPress={() => router.push({ pathname: '/course/[id]', params: { id: item.subject.id } })}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}
