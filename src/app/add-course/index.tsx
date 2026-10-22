import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useThemeColors } from '@/constants/theme';
import { useCourses } from '@/features/courses/use-courses';
import { useStudyPlan } from '@/features/courses/use-study-plan';
import { cn } from '@/lib/cn';
import {
  collectPassedSubjectIds,
  evaluatePrerequisites,
  type PassedCheckInput,
  type PrerequisiteSubjectInfo,
} from '@/lib/grades/prerequisites';
import type { CatalogSubject } from '@/lib/api/catalog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Check, ChevronLeft, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddCourseScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  // Optional `semesterId` param: when the Courses screen opens the add flow from
  // a specific semester chip, that semester is preselected.
  const { semesterId } = useLocalSearchParams<{ semesterId?: string }>();
  const { offerings, catalog, loading, refreshing, error, refresh } = useCourses();
  const {
    entries,
    loading: planLoading,
    error: planError,
    addEntry,
    reload,
  } = useStudyPlan();
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Derived (not stored in an effect) so the first semester is selected as soon
  // as the catalog arrives without a render-time state write. A requested
  // `semesterId` (from the Courses screen) wins over the default first catalog
  // semester, but only when it is actually offered — otherwise it is ignored.
  const requestedSemesterId =
    semesterId && offerings.some((offering) => offering.semester.id === semesterId)
      ? semesterId
      : null;
  const activeSemesterId =
    selectedSemesterId ?? requestedSemesterId ?? offerings[0]?.semester.id ?? null;
  const activeOffering = offerings.find((o) => o.semester.id === activeSemesterId) ?? null;
  const subjects = activeOffering ? activeOffering.subjects : [];
  const showLoading = loading || planLoading || (!catalog && !error);

  const passedSubjectIds = useMemo(
    () =>
      collectPassedSubjectIds(
        entries.map<PassedCheckInput>((entry) => ({
          subjectId: entry.subjectId,
          projectMark: entry.projectMark,
          examMark: entry.examMark,
          projectWeight: entry.projectWeight,
          examWeight: entry.examWeight,
          creditHours: entry.creditHours,
        })),
      ),
    [entries],
  );
  const plannedSubjectIds = useMemo(
    () => new Set(entries.map((entry) => entry.subjectId)),
    [entries],
  );
  const plannedInSemester = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => entry.semesterId === activeSemesterId)
          .map((entry) => entry.subjectId),
      ),
    [entries, activeSemesterId],
  );

  const resolveSubject = (subjectId: string): PrerequisiteSubjectInfo | undefined => {
    const subject = catalog?.subjects.find((candidate) => candidate.id === subjectId);
    return subject
      ? { id: subject.id, code: subject.code, nameAr: subject.nameAr, nameEn: subject.nameEn }
      : undefined;
  };

  const warningsFor = (subject: CatalogSubject) =>
    evaluatePrerequisites(subject.prerequisiteIds, {
      passedSubjectIds,
      plannedSubjectIds,
      resolve: resolveSubject,
    });

  const toggleSubject = (id: string) => {
    if (plannedInSemester.has(id)) {
      return;
    }
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

  const handleRefresh = () => {
    void Promise.all([refresh(), reload()]);
  };

  const handleSave = async () => {
    if (!activeSemesterId || selectedSubjectIds.size === 0) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      for (const subjectId of selectedSubjectIds) {
        const subject = subjects.find((candidate) => candidate.id === subjectId);
        if (!subject) {
          continue;
        }
        await addEntry({
          semesterId: activeSemesterId,
          subjectId,
          creditHours: subject.creditHours,
          projectWeight: subject.projectWeight,
          examWeight: subject.examWeight,
        });
      }
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'تعذّر إضافة المقررات إلى الخطة.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedSubjectIds.size;

  return (
    // A standalone screen (pushed on top of the tabs), so it owns its top inset.
    <Screen>
      <ScreenHeader
        title="إضافة مقررات"
        subtitle={
          activeOffering
            ? `${activeOffering.semester.name} • ${subjects.length} مقررًا متاحًا`
            : 'اختر الفصل ثم حدّد المقررات.'
        }
        action={
          <IconButton
            icon={X}
            label="إغلاق"
            variant="surface"
            onPress={() => router.back()}
          />
        }
      />

      <View className="pb-3">
        <ChipRow>
          {offerings.map((off) => (
            <Chip
              key={off.semester.id}
              label={off.semester.name}
              hint={`${off.subjects.length} مقرر`}
              active={off.semester.id === activeSemesterId}
              onPress={() => {
                setSelectedSemesterId(off.semester.id);
                setSelectedSubjectIds(new Set());
                setSaveError(null);
              }}
            />
          ))}
        </ChipRow>
      </View>

      {showLoading ? (
        <LoadingState className="flex-1" label="جارٍ تحميل المقررات…" />
      ) : error && !catalog ? (
        <View className="flex-1 justify-center px-6">
          <ErrorState message={error} onRetry={handleRefresh} />
        </View>
      ) : subjects.length === 0 ? (
        <View className="flex-1 justify-center">
          <EmptyState
            icon={AlertTriangle}
            title="لا توجد مقررات متاحة"
            description="لا يعرض دليل هذا الفصل مقررات. جرّب فصلًا دراسيًا آخر من الشريط أعلاه."
          />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={subjects}
          keyExtractor={(subject) => subject.id}
          contentContainerClassName="gap-2 px-6 pb-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => {
            const isPlanned = plannedInSemester.has(item.id);
            const isSelected = selectedSubjectIds.has(item.id);
            const warnings = warningsFor(item);
            return (
              <View className="gap-1">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.nameAr}
                  accessibilityState={{ checked: isPlanned || isSelected, disabled: isPlanned }}
                  onPress={() => toggleSubject(item.id)}
                  className={cn(
                    'flex-row items-center gap-3 rounded-2xl border px-3 py-3',
                    isPlanned
                      ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60'
                      : 'border-slate-200 bg-white active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:active:bg-slate-800',
                  )}
                >
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`عرض تفاصيل ${item.nameAr}`}
                    onPress={() =>
                      router.push({
                        pathname: '/course/[id]',
                        params: {
                          id: item.id,
                          ...(activeSemesterId ? { semesterId: activeSemesterId } : {}),
                        },
                      })
                    }
                    className="h-9 w-9 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-slate-800"
                  >
                    <ChevronLeft color={colors.slate400} size={20} />
                  </Pressable>

                  <View
                    className={cn(
                      'h-6 w-6 items-center justify-center rounded-full',
                      isPlanned || isSelected ? 'bg-brand-700 dark:bg-brand-400' : 'border border-slate-300 dark:border-slate-600',
                    )}
                  >
                    {isPlanned || isSelected ? (
                      <Check color={colors.onAccent} size={16} />
                    ) : null}
                  </View>

                  <View className="flex-1 items-end gap-1">
                    <View className="flex-row flex-wrap items-center justify-end gap-2">
                      <Text className="text-right text-base font-semibold leading-6 text-slate-900 dark:text-white">
                        {item.nameAr}
                      </Text>
                      {isPlanned ? <Badge label="مضاف" tone="success" /> : null}
                    </View>
                    <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {item.code} • {item.creditHours} ساعة • وزن {item.projectWeight}/{item.examWeight}
                    </Text>
                  </View>
                </Pressable>

                {warnings.length > 0 && !isPlanned ? (
                  <View className="flex-row items-center justify-end gap-1 px-2">
                    <Text className="text-right text-[11px] leading-4 text-amber-700 dark:text-amber-400">
                      تحذير: متطلبات سابقة غير مستوفاة —{' '}
                      {warnings
                        .map((warning) =>
                          warning.reason === 'not-passed'
                            ? `${warning.label} (مُخطَّط لكن لم يُجتَز)`
                            : `${warning.label} (غير مُخطَّط)`,
                        )
                        .join('، ')}
                    </Text>
                    <AlertTriangle color={colors.warning} size={13} />
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <View className="gap-2 px-6" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {saveError ?? planError ? (
          <Text className="text-center text-xs leading-4 text-red-600 dark:text-red-400">
            {saveError ?? planError}
          </Text>
        ) : null}
        {selectedCount > 0 ? (
          <Text className="text-center text-xs leading-4 text-slate-500 dark:text-slate-400">
            {`تم تحديد ${selectedCount} مقرر — سيُضاف إلى خطتك في ${activeOffering?.semester.name ?? 'الفصل المحدد'}.`}
          </Text>
        ) : null}
        <Button
          label={selectedCount > 0 ? `إضافة ${selectedCount} مقرر` : 'إضافة المقررات'}
          onPress={handleSave}
          loading={saving}
          disabled={!activeSemesterId || selectedCount === 0}
        />
      </View>
    </Screen>
  );
}
