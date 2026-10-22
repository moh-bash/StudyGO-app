import { AverageCard } from '@/components/courses/average-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { PressableCard } from '@/components/ui/card';
import { Screen, ScreenScroll } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useThemeColors } from '@/constants/theme';
import { useCourses } from '@/features/courses/use-courses';
import { useStudyPlan } from '@/features/courses/use-study-plan';
import { cn } from '@/lib/cn';
import type { Catalog } from '@/lib/api/catalog';
import { buildPlanView, type PlanSubjectView } from '@/lib/courses/plan-view';
import { buildSemesterOptions } from '@/lib/courses/semester-options';
import { describeFinalMark } from '@/lib/grades/calc';
import { formatPercentage } from '@/lib/grades/grade-scale';
import { useRouter } from 'expo-router';
import { AlertTriangle, BookOpen, Plus, RefreshCw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';

function sectionLabel(catalog: Catalog | null, sectionId: string | null): string {
  if (!sectionId) {
    return 'بدون شعبة';
  }
  const section = catalog?.sections.find((candidate) => candidate.id === sectionId);
  return section ? `شعبة ${section.code}` : 'شعبة محفوظة';
}

function SubjectCard({ subject, catalog, onPress }: {
  subject: PlanSubjectView;
  catalog: Catalog | null;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const complete = subject.finalMark.status === 'complete';
  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel={`تفاصيل ${subject.nameAr}`}
      onPress={onPress}
      className="gap-2 p-4"
    >
      <View className="flex-row items-start gap-3">
        {/* The mark sits at the leading (left) end; the name is right-anchored. */}
        <View className="items-end gap-1">
          <Text
            className={cn(
              'text-sm font-semibold leading-5',
              complete
                ? 'text-slate-900 dark:text-white'
                : 'text-xs font-medium leading-5 text-amber-600 dark:text-amber-400',
            )}
          >
            {complete
              ? formatPercentage(subject.finalMark.finalMark)
              : describeFinalMark(subject.finalMark)}
          </Text>
          {subject.grade ? (
            <Badge
              label={subject.grade.letter}
              tone={subject.passing ? 'success' : 'danger'}
            />
          ) : null}
        </View>
        <View className="flex-1 items-end gap-0.5">
          <Text className="text-right text-base font-semibold leading-6 text-slate-900 dark:text-white">
            {subject.nameAr}
          </Text>
          <Text className="text-right text-xs leading-4 text-slate-500 dark:text-slate-400">
            {subject.code} • {subject.creditHours} ساعة • {sectionLabel(catalog, subject.entry.sectionId)}
          </Text>
        </View>
      </View>

      {subject.prerequisites.length > 0 ? (
        <View className="flex-row items-center justify-end gap-1">
          <Text className="text-right text-[11px] leading-4 text-amber-600 dark:text-amber-400">
            تنبيه: متطلبات سابقة غير مستوفاة ({subject.prerequisites.length})
          </Text>
          <AlertTriangle color={colors.warning} size={12} />
        </View>
      ) : null}

      {subject.weightsChanged || subject.creditsChanged ? (
        <View className="flex-row items-center justify-end gap-1">
          <Text className="text-right text-[11px] leading-4 text-sky-600 dark:text-sky-400">
            {subject.weightsChanged
              ? 'أوزان المقرر في الدليل تغيّرت — النتيجة محسوبة بالأوزان المحفوظة'
              : 'الساعات المعتمدة في الدليل تغيّرت — المعدل يحتفظ بالقيمة المحفوظة'}
          </Text>
          <RefreshCw color={colors.info} size={12} />
        </View>
      ) : null}
    </PressableCard>
  );
}

export default function CoursesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { catalog, loading, refreshing, fromCache, error, refresh } = useCourses();
  const { entries, loading: planLoading, error: planError, reload } = useStudyPlan();
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);

  const plan = useMemo(() => buildPlanView(entries, catalog), [entries, catalog]);
  const options = useMemo(() => buildSemesterOptions(plan, catalog), [plan, catalog]);

  const activeSemesterId = selectedSemesterId ?? options[0]?.semesterId ?? null;
  const activeOption = options.find((option) => option.semesterId === activeSemesterId) ?? null;
  const activeSemester = plan.semesters.find((semester) => semester.semesterId === activeSemesterId) ?? null;
  const subjects = activeSemester?.subjects ?? [];

  const isLoading = loading || planLoading;
  const combinedError = planError ?? error;

  const handleRefresh = () => {
    void Promise.all([refresh(), reload()]);
  };

  const goToAdd = () => {
    router.push(
      activeSemesterId
        ? ({ pathname: '/add-course', params: { semesterId: activeSemesterId } } as never)
        : ('/add-course' as never),
    );
  };

  return (
    // The tab navigator above already applies the top safe-area inset.
    <Screen topInset={false}>
      <ScreenHeader
        title="المقررات"
        action={
          <Button
            label="إضافة"
            icon={Plus}
            size="sm"
            fullWidth={false}
            onPress={goToAdd}
            accessibilityLabel="إضافة مقررات إلى الخطة"
          />
        }
      />

      {options.length > 0 ? (
        <ChipRow className="pb-3">
          {options.map((option) => (
            <Chip
              key={option.semesterId}
              label={option.name}
              hint={option.subjectCount > 0 ? `${option.subjectCount} مقرر` : undefined}
              active={option.semesterId === activeSemesterId}
              onPress={() => setSelectedSemesterId(option.semesterId)}
            />
          ))}
        </ChipRow>
      ) : null}

      <ScreenScroll
        tabBar
        className="px-6"
        contentClassName="gap-3 pb-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >
        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            {combinedError ? (
              <ErrorState
                message={combinedError}
                hint={fromCache ? 'تُعرض بيانات محفوظة على الجهاز.' : undefined}
                onRetry={handleRefresh}
              />
            ) : null}

            {plan.totalEntries === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="لا توجد مقررات في خطتك بعد"
                description="اختر فصلًا دراسيًا وأضف مقرراتك لمتابعة العلامات والمعدل."
                action={
                  <Button label="إضافة مقررات" onPress={goToAdd} />
                }
              />
            ) : (
              <>
                {activeOption && activeOption.subjectCount > 0 ? (
                  <AverageCard
                    title={activeOption.name}
                    caption={`${activeOption.subjectCount} مقرر في هذا الفصل`}
                    summary={activeOption.average}
                  />
                ) : (
                  <View className="gap-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                    <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                      {activeOption ? activeOption.name : 'الفصل المحدد'}
                    </Text>
                    <Text className="text-right text-xs leading-4 text-slate-500 dark:text-slate-400">
                      لا توجد مقررات مخططة في هذا الفصل بعد.
                    </Text>
                  </View>
                )}

                {subjects.map((subject) => (
                  <SubjectCard
                    key={subject.entry.id}
                    subject={subject}
                    catalog={catalog}
                    onPress={() =>
                      router.push({
                        pathname: '/course/[id]',
                        params: {
                          id: subject.entry.subjectId,
                          semesterId: subject.entry.semesterId,
                        },
                      })
                    }
                  />
                ))}

                {subjects.length === 0 && activeSemesterId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="إضافة مقررات إلى هذا الفصل"
                    onPress={goToAdd}
                    className="flex-row items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4 active:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/40"
                  >
                    <Plus color={colors.accent} size={18} />
                    <Text className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                      إضافة مقررات إلى هذا الفصل
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}
