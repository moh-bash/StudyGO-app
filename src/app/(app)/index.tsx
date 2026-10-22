import { AverageCard } from '@/components/courses/average-card';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { IconButton } from '@/components/ui/icon-button';
import { Screen, ScreenScroll } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatTile } from '@/components/ui/stat-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useCourses } from '@/features/courses/use-courses';
import { useStudyPlan } from '@/features/courses/use-study-plan';
import { buildHomeSummary, type HomeSummary } from '@/lib/courses/home-summary';
import { buildPlanView } from '@/lib/courses/plan-view';
import { useRouter } from 'expo-router';
import { AlertTriangle, BookOpen, RefreshCw } from 'lucide-react-native';
import { useMemo } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useThemeColors } from '@/constants/theme';

/** The dashboard shown once the plan has at least one subject. */
function HomeContent({ summary }: { summary: HomeSummary }) {
  const { cumulative, latestSemester } = summary;
  return (
    <>
      <AverageCard
        title="المعدل التراكمي"
        caption="محسوب من المقررات المكتملة فقط، مرجّحًا بالساعات المعتمدة."
        summary={cumulative}
      />

      {latestSemester ? (
        <AverageCard
          title="أحدث فصل في خطتك"
          caption={`${latestSemester.semesterName} • ${latestSemester.subjectCount} مقرر`}
          summary={latestSemester.average}
        />
      ) : null}

      <View className="gap-3">
        <View className="flex-row gap-3">
          <StatTile label="المقررات المخططة" value={summary.totalSubjects} />
          <StatTile label="الفصول المخططة" value={summary.semesterCount} />
        </View>
        <View className="flex-row gap-3">
          <StatTile label="مكتملة" value={summary.completedCount} tone="good" />
          <StatTile label="غير مكتملة" value={summary.incompleteCount} tone="warn" />
        </View>
        <View className="flex-row gap-3">
          <StatTile label="مقررات ناجحة" value={summary.passedCount} tone="good" />
          <StatTile label="ساعات مجتازة" value={summary.passedCredits} tone="good" />
        </View>
        <View className="flex-row gap-3">
          <StatTile label="ساعات مخططة" value={summary.plannedCredits} />
        </View>
      </View>

      {summary.invalidCount > 0 ? (
        <Callout
          tone="warning"
          icon={AlertTriangle}
          message={`${summary.invalidCount} مقرر بأوزان غير صالحة (مجموع الأوزان لا يساوي 100) — لا تدخل في المعدل حتى تصحّح أوزانها.`}
        />
      ) : null}

      <Text className="text-center text-[11px] leading-4 text-slate-400 dark:text-slate-500">
        كل الأرقام أعلاه مبنية على خطتك المحفوظة على هذا الجهاز. اجتياز المقرر يبدأ من 60%.
      </Text>
    </>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const {
    catalog,
    loading: catalogLoading,
    refreshing,
    fromCache,
    error: catalogError,
    refresh,
  } = useCourses();
  const { entries, loading: planLoading, error: planError, reload } = useStudyPlan();

  const view = useMemo(() => buildPlanView(entries, catalog), [entries, catalog]);
  const summary = useMemo(() => buildHomeSummary(view), [view]);

  const isLoading = planLoading || catalogLoading;
  const combinedError = planError ?? catalogError;
  const hasPlan = summary.totalSubjects > 0;

  const handleRefresh = () => {
    void Promise.all([refresh(), reload()]);
  };

  return (
    // The tab navigator above already applies the top safe-area inset.
    <Screen topInset={false}>
      <ScreenHeader
        title="الرئيسية"
        subtitle="ملخص خطتك الدراسية."
        action={
          <IconButton
            icon={RefreshCw}
            label="تحديث البيانات"
            onPress={handleRefresh}
            disabled={refreshing}
          />
        }
      />

      <ScreenScroll
        tabBar
        className="px-6"
        contentClassName="gap-4 pb-4"
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
                hint={fromCache && hasPlan ? 'تُعرض بيانات محفوظة على الجهاز.' : undefined}
                onRetry={handleRefresh}
              />
            ) : null}

            {hasPlan ? (
              <HomeContent summary={summary} />
            ) : (
              <EmptyState
                icon={BookOpen}
                title="لا توجد مقررات في خطتك بعد"
                description="أضف مقررات إلى فصل دراسي لعرض معدلك التراكمي وتقدّمك هنا."
                action={
                  <Button
                    label="إضافة مقررات"
                    onPress={() => router.push('/add-course' as never)}
                  />
                }
              />
            )}
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}
