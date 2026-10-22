import { accentClasses } from '@/constants/theme';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { AverageSummary } from '@/lib/grades/averages';
import { formatGpa, formatPercentage } from '@/lib/grades/grade-scale';
import { Text, View } from 'react-native';

type Props = {
  title: string;
  summary: AverageSummary;
  /** Optional caption under the title (e.g. semester name). */
  caption?: string;
};

/**
 * Credit-weighted average card. Shows an explicit empty state instead of a
 * fabricated `0` when no subject is complete yet.
 *
 * The bar under the figures is a second encoding of the same percentage: it
 * makes "how far along is this average" readable at a glance without adding
 * any information the screen does not already have.
 */
export function AverageCard({ title, summary, caption }: Props) {
  const average = summary.average;
  const percentage = average ? Math.max(0, Math.min(100, average.percentage)) : 0;

  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-3">
        <View className="items-end gap-0.5">
          <Text className={cn("text-2xl font-bold leading-8", accentClasses.text)}>
            {average ? formatPercentage(average.percentage) : '—'}
          </Text>
          <Text className="text-xs leading-4 text-slate-500 dark:text-slate-400">
            {average ? `GPA ${formatGpa(average.gpa)}` : 'لا توجد نتائج مكتملة'}
          </Text>
        </View>
        <View className="flex-1 items-end gap-0.5">
          <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </Text>
          {caption ? (
            <Text className="text-right text-xs leading-4 text-slate-500 dark:text-slate-400">
              {caption}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Average progress: an empty track when there is nothing to show. */}
      <View
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        accessibilityRole="progressbar"
        accessibilityLabel={title}
        accessibilityValue={average ? { min: 0, max: 100, now: Math.round(percentage) } : undefined}
      >
        <View
          className={cn('h-full rounded-full', accentClasses.surface)}
          style={{ width: `${percentage}%` }}
        />
      </View>

      <View className="flex-row justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <View className="items-center gap-0.5">
          <Text className="text-sm font-semibold leading-5 text-slate-900 dark:text-white">
            {summary.completedCount}
          </Text>
          <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">مكتمل</Text>
        </View>
        <View className="items-center gap-0.5">
          <Text className="text-sm font-semibold leading-5 text-amber-600 dark:text-amber-400">
            {summary.incompleteCount}
          </Text>
          <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">غير مكتمل</Text>
        </View>
        <View className="items-center gap-0.5">
          <Text className="text-sm font-semibold leading-5 text-slate-900 dark:text-white">
            {average ? average.totalCredits : 0}
          </Text>
          <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            ساعة محتسبة
          </Text>
        </View>
        <View className="items-center gap-0.5">
          <Text className="text-sm font-semibold leading-5 text-slate-900 dark:text-white">
            {summary.totalCount}
          </Text>
          <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">إجمالي</Text>
        </View>
      </View>
    </Card>
  );
}
