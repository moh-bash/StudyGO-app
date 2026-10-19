import { Button } from '@/components/ui/button';
import { palette } from '@/constants/theme';
import { useCourses } from '@/features/courses/use-courses';
import { cn } from '@/lib/cn';
import { useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddCourseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { offerings, saveSelection } = useCourses();
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (offerings.length > 0 && !selectedSemesterId) {
      const defaultId = offerings[0].semester.id;
      setTimeout(() => setSelectedSemesterId(defaultId), 0);
    }
  }, [offerings, selectedSemesterId]);

  const activeOffering = offerings.find((o) => o.semester.id === selectedSemesterId) ?? null;
  const subjects = activeOffering ? activeOffering.subjects : [];

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedSemesterId) return;
    setSaving(true);
    try {
      await saveSelection(selectedSemesterId, Array.from(selectedSubjectIds));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <X color={palette.slate400} size={24} />
        </Pressable>
        <Text className="text-lg font-semibold text-slate-900 dark:text-white">إضافة مقررات</Text>
        <View style={{ width: 24 }} />
      </View>

      <View className="px-6 pb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {offerings.map((off) => {
            const active = off.semester.id === selectedSemesterId;
            return (
              <Pressable
                key={off.semester.id}
                onPress={() => {
                  setSelectedSemesterId(off.semester.id);
                  setSelectedSubjectIds(new Set());
                }}
                className={cn(
                  'rounded-full border px-4 py-2',
                  active
                    ? 'border-brand-600 bg-brand-600'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                )}
              >
                <Text className={cn('text-sm', active ? 'text-white' : 'text-slate-700 dark:text-slate-300')}>
                  {off.semester.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View className="flex-1 px-6">
        {subjects.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-slate-500 dark:text-slate-400">لا توجد مقررات متاحة لهذا الفصل.</Text>
          </View>
        ) : (
          <FlatList
            data={subjects}
            keyExtractor={(s) => s.id}
            contentContainerClassName="gap-2 pb-4"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = selectedSubjectIds.has(item.id);
              return (
                <Pressable
                  onPress={() => toggleSubject(item.id)}
                  className="flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <View className="flex-1 gap-1">
                    <Text className="text-base font-medium text-slate-900 dark:text-white">{item.nameAr}</Text>
                    <Text className="text-xs text-slate-500 dark:text-slate-400">
                      {item.code} • {item.creditHours} ساعة
                    </Text>
                  </View>
                  {isSelected ? <Check color={palette.brand600} size={20} /> : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <View className="px-6" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <Button
          label="حفظ"
          onPress={handleSave}
          loading={saving}
          disabled={!selectedSemesterId}
        />
      </View>
    </View>
  );
}
