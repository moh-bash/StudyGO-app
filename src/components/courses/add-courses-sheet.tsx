import { Button } from '@/components/ui/button';
import { palette } from '@/constants/theme';
import type { Catalog } from '@/lib/api/catalog';
import { cn } from '@/lib/cn';
import type { SemesterOfferings } from '@/lib/courses/offerings';
import { BottomSheet, Host } from '@expo/ui';
import { Check, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  catalog: Catalog | null;
  offerings: SemesterOfferings[];
  onSave: (semesterId: string, subjectIds: string[]) => Promise<void>;
};

export function AddCoursesSheet({ visible, onClose, offerings, onSave }: Props) {
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(560, height * 0.8);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && offerings.length > 0 && !selectedSemesterId) {
      const defaultId = offerings[0].semester.id;
      setTimeout(() => setSelectedSemesterId(defaultId), 0);
    }
  }, [visible, offerings, selectedSemesterId]);

  useEffect(() => {
    if (!visible) {
      const timeoutId = setTimeout(() => {
        setSelectedSubjectIds(new Set());
        setSaving(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [visible]);

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
      await onSave(selectedSemesterId, Array.from(selectedSubjectIds));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Host>
      <BottomSheet isPresented={visible} onDismiss={onClose} contentPadding={0}>
        <View style={{ height: sheetHeight }} className="flex-1 bg-white dark:bg-slate-900">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <Text className="text-base font-semibold text-slate-900 dark:text-white">إضافة مقررات</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X color={palette.slate400} size={20} />
            </Pressable>
          </View>

          <View className="px-6 py-5">
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
                style={{ flexGrow: 0 }}
                contentContainerClassName="gap-2 pb-4"
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

          <View className="px-6 pb-4 pt-2">
            <Button
              label="حفظ"
              onPress={handleSave}
              loading={saving}
              disabled={!selectedSemesterId}
            />
          </View>
        </View>
      </BottomSheet>
    </Host>
  );
}
