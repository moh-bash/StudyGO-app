import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Chip, ChipRow } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { Screen, ScreenScroll } from '@/components/ui/screen';
import { SelectField, type SelectOption } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useThemeColors } from '@/constants/theme';
import { useCatalog } from '@/features/courses/use-catalog';
import { useStudyPlan } from '@/features/courses/use-study-plan';
import { TeamsPanel } from '@/features/teams/teams-panel';
import { useSubjectTeamCleanup } from '@/features/teams/use-subject-team-cleanup';
import type { Catalog, CatalogSection } from '@/lib/api/catalog';
import { buildSectionDetails } from '@/lib/courses/section-details';
import { findSelectedSection } from '@/lib/courses/section-scope';
import type { PlanEntry, PlanMarks } from '@/lib/db/plan-types';
import { computeFinalMark, incompleteDescription, parseMarkInput } from '@/lib/grades/calc';
import { formatGpa, formatPercentage, percentageToGrade } from '@/lib/grades/grade-scale';
import {
  collectPassedSubjectIds,
  evaluatePrerequisites,
  type PassedCheckInput,
} from '@/lib/grades/prerequisites';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight, RefreshCw, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** The five detail tabs. Only Overview and Grades have real content in Phase 4. */
const DETAIL_TABS = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'grades', label: 'العلامات' },
  { key: 'summaries', label: 'المقررات والملخصات' },
  { key: 'lectures', label: 'المحاضرات' },
  { key: 'teams', label: 'الفرق' },
] as const;

type DetailTabKey = (typeof DETAIL_TABS)[number]['key'];

const styles = StyleSheet.create({
  /** Keeps the Grades panel mounted (so draft input survives tab switches). */
  hidden: { display: 'none' },
  /** Vertical rhythm between the tab panels. */
  tabContent: { gap: 16 },
});

/** A localized placeholder for a tab whose feature ships in a later phase. */
function ComingSoon({ title }: { title: string }) {
  return (
    <View className="items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/60">
      <Text className="text-sm font-semibold text-slate-900 dark:text-white">{title}</Text>
      <Text className="text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
        سيتم عرض هذا القسم في تحديث قادم.
      </Text>
    </View>
  );
}

function SectionDetails({ catalog, section }: { catalog: Catalog; section: CatalogSection }) {
  const details = buildSectionDetails(catalog, section);
  return (
    <View className="gap-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <Text className="text-right text-xs font-medium text-slate-700 dark:text-slate-300">
        {details.professorName}
      </Text>
      {details.scheduleLines.length > 0 ? (
        details.scheduleLines.map((line, index) => (
          <Text
            key={`${section.id}-line-${index}`}
            className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400"
          >
            {line}
          </Text>
        ))
      ) : (
        <Text className="text-right text-xs leading-5 text-slate-400 dark:text-slate-600">
          لا يوجد جدول أسبوعي
        </Text>
      )}
      {section.location ? (
        <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
          الموقع: {section.location}
        </Text>
      ) : null}
    </View>
  );
}

/** One labelled figure in the "course information" list. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800">
      <Text className="text-sm text-slate-500 dark:text-slate-400">{value}</Text>
      <Text className="text-right text-sm font-medium text-slate-900 dark:text-white">{label}</Text>
    </View>
  );
}

function MarksEditor({
  entry,
  onSave,
}: {
  entry: PlanEntry;
  onSave: (marks: PlanMarks) => Promise<void>;
}) {
  const [project, setProject] = useState(
    entry.projectMark === null ? '' : String(entry.projectMark),
  );
  const [exam, setExam] = useState(entry.examMark === null ? '' : String(entry.examMark));
  const [projectError, setProjectError] = useState<string | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    const projectResult = parseMarkInput(project);
    const examResult = parseMarkInput(exam);
    setProjectError(projectResult.ok ? null : projectResult.error);
    setExamError(examResult.ok ? null : examResult.error);
    setSaved(false);
    setSaveError(null);
    if (!projectResult.ok || !examResult.ok) {
      return;
    }
    setSaving(true);
    try {
      await onSave({
        projectMark: projectResult.value,
        examMark: examResult.value,
      });
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'تعذّر حفظ العلامات.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-3">
      <View className="items-end gap-0.5">
        <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">العلامات</Text>
        <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
          اترك الحقل فارغًا إذا كانت العلامة غير متوفرة بعد. العلامة الفارغة لا تُحسب صفرًا.
        </Text>
      </View>

      <TextField
        label={`علامة المشروع (${entry.projectWeight}%)`}
        value={project}
        onChangeText={(text) => {
          setProject(text);
          setSaved(false);
        }}
        placeholder="0 – 100"
        keyboardType="decimal-pad"
        textAlign="left"
        error={projectError ?? undefined}
      />
      <TextField
        label={`علامة الامتحان (${entry.examWeight}%)`}
        value={exam}
        onChangeText={(text) => {
          setExam(text);
          setSaved(false);
        }}
        placeholder="0 – 100"
        keyboardType="decimal-pad"
        textAlign="left"
        error={examError ?? undefined}
      />

      {saveError ? (
        <Callout tone="danger" message={saveError} />
      ) : null}
      {saved ? (
        <Text className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
          تم حفظ العلامات.
        </Text>
      ) : null}

      <Button label="حفظ العلامات" onPress={handleSave} loading={saving} />
    </Card>
  );
}

export default function CourseDetailScreen() {
  const router = useRouter();
  const { id, semesterId } = useLocalSearchParams<{ id: string; semesterId?: string }>();
  const colors = useThemeColors();
  const { catalog, loading } = useCatalog();
  const {
    entries,
    loading: planLoading,
    error: planError,
    addEntry,
    removeEntry,
    setSection,
    setMarks,
    updateWeights,
    reload,
  } = useStudyPlan();
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTabKey>('overview');
  const { running: cleanupRunning, cleanup } = useSubjectTeamCleanup();

  /**
   * Cross-fades the tab content.
   *
   * The animation lives on the container, not on the individual panels, so the
   * grades panel keeps its unsaved draft: it stays mounted (hidden with
   * `display: none`) and simply becomes visible again while the container
   * fades in.
   */
  const tabProgress = useSharedValue(1);

  useEffect(() => {
    tabProgress.value = 0;
    tabProgress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [activeTab, tabProgress]);

  const tabContentStyle = useAnimatedStyle(() => ({
    opacity: tabProgress.value,
    transform: [{ translateY: (1 - tabProgress.value) * 10 }],
  }));

  const subject = catalog?.subjects.find((candidate) => candidate.id === id) ?? null;
  const entry =
    entries.find(
      (candidate) =>
        candidate.subjectId === id &&
        (semesterId ? candidate.semesterId === semesterId : true),
    ) ?? null;
  const effectiveSemesterId = entry?.semesterId ?? semesterId ?? null;
  const semester = catalog?.semesters.find((candidate) => candidate.id === effectiveSemesterId) ?? null;

  const finalMark = entry
    ? computeFinalMark({
        projectMark: entry.projectMark,
        examMark: entry.examMark,
        projectWeight: entry.projectWeight,
        examWeight: entry.examWeight,
      })
    : null;
  const grade =
    finalMark?.status === 'complete' ? percentageToGrade(finalMark.finalMark) : null;

  const passedSubjectIds = collectPassedSubjectIds(
    entries.map<PassedCheckInput>((candidate) => ({
      subjectId: candidate.subjectId,
      projectMark: candidate.projectMark,
      examMark: candidate.examMark,
      projectWeight: candidate.projectWeight,
      examWeight: candidate.examWeight,
      creditHours: candidate.creditHours,
    })),
  );
  const plannedSubjectIds = new Set(entries.map((candidate) => candidate.subjectId));
  const prerequisites = subject
    ? evaluatePrerequisites(subject.prerequisiteIds, {
        passedSubjectIds,
        plannedSubjectIds,
        resolve: (prerequisiteId) => {
          const prerequisite = catalog?.subjects.find((candidate) => candidate.id === prerequisiteId);
          return prerequisite
            ? {
                id: prerequisite.id,
                code: prerequisite.code,
                nameAr: prerequisite.nameAr,
                nameEn: prerequisite.nameEn,
              }
            : undefined;
        },
      })
    : [];

  const sections = catalog
    ? catalog.sections.filter(
        (section) => section.subjectId === id && section.semesterId === effectiveSemesterId,
      )
    : [];
  // The stored pick is only a section when the catalog still knows it: a stale
  // id (an older catalog, or another subject/term) is not a section the student
  // has and must not be sent to the server. This is the single source of truth
  // for the section — the overview and the teams tab always agree on it.
  const selectedSection = findSelectedSection(entry?.sectionId, sections);
  const selectedSectionId = selectedSection?.id ?? null;
  const selectedSectionDetails =
    selectedSection && catalog ? buildSectionDetails(catalog, selectedSection) : null;
  const sectionOptions: SelectOption[] = [
    { value: '', label: 'بدون شعبة' },
    ...sections.map((section) => {
      const details = catalog ? buildSectionDetails(catalog, section) : null;
      return {
        value: section.id,
        label: `شعبة ${section.code}`,
        hint: details ? `${details.professorName} • ${details.semesterLabel}` : null,
      };
    }),
  ];

  const weightsChanged =
    entry && subject
      ? Math.abs(subject.projectWeight - entry.projectWeight) > 0.001 ||
        Math.abs(subject.examWeight - entry.examWeight) > 0.001
      : false;
  const creditsChanged =
    entry && subject ? subject.creditHours !== entry.creditHours : false;

  const handleAdd = async () => {
    if (!subject || !effectiveSemesterId) {
      return;
    }
    setBusy(true);
    try {
      await addEntry({
        semesterId: effectiveSemesterId,
        subjectId: subject.id,
        creditHours: subject.creditHours,
        projectWeight: subject.projectWeight,
        examWeight: subject.examWeight,
      });
    } catch (e) {
      Alert.alert('تعذّر الإضافة', e instanceof Error ? e.message : 'حدث خطأ غير متوقع.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Removes the course from the plan, resolving its team first.
   *
   * The team is settled on the server *before* the local entry is dropped: a
   * team left behind would keep the student from joining another team for the
   * same subject and term. If the team cleanup fails, the course stays in the
   * plan — the operation aborts as a whole instead of leaving a half-removed
   * state behind.
   */
  const handleRemove = async () => {
    if (!entry || !subject || !effectiveSemesterId) {
      return;
    }
    setBusy(true);
    try {
      const outcome = await cleanup({
        subjectId: subject.id,
        semesterId: effectiveSemesterId,
        sectionId: entry.sectionId,
      });
      if (outcome !== 'removed') {
        // 'cancelled': the student dismissed the confirmation. 'failed': the
        // reason was already reported by the workflow.
        return;
      }
      try {
        await removeEntry(entry.id);
      } catch (e) {
        Alert.alert('تعذّرت الإزالة', e instanceof Error ? e.message : 'حدث خطأ غير متوقع.');
        return;
      }
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateWeights = () => {
    if (!entry || !subject) {
      return;
    }
    Alert.alert(
      'تحديث أوزان المقرر',
      `سيتم اعتماد أوزان الدليل الحالية (${subject.projectWeight}/${subject.examWeight}) في حساب النتيجة. لن تتغير العلامات، لكن المعدل سيعاد حسابه بهذه الأوزان.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تحديث',
          onPress: () => {
            setBusy(true);
            void updateWeights(entry.id, {
              projectWeight: subject.projectWeight,
              examWeight: subject.examWeight,
            })
              .catch((e) =>
                Alert.alert('تعذّر التحديث', e instanceof Error ? e.message : 'حدث خطأ غير متوقع.'),
              )
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  const handleSectionChange = (value: string) => {
    if (!entry) {
      return;
    }
    void setSection(entry.id, value === '' ? null : value).catch((e) =>
      Alert.alert('تعذّر اختيار الشعبة', e instanceof Error ? e.message : 'حدث خطأ غير متوقع.'),
    );
  };

  const resultBlock = entry ? (
    <Card tone="muted" className="gap-2">
      <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">النتيجة</Text>
      {finalMark?.status === 'complete' ? (
        <>
          <View className="flex-row items-center gap-3">
            {grade ? (
              <Badge label={grade.letter} tone={finalMark.finalMark >= 60 ? 'success' : 'danger'} />
            ) : null}
            <View className="flex-1 items-end gap-0.5">
              <Text className="text-2xl font-bold leading-8 text-slate-900 dark:text-white">
                {formatPercentage(finalMark.finalMark)}
              </Text>
              <Text className="text-xs leading-4 text-slate-500 dark:text-slate-400">
                {grade ? `GPA ${formatGpa(grade.gpa)}` : ''}
              </Text>
            </View>
          </View>
          <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
            محسوبة بأوزان محفوظة: مشروع {entry.projectWeight}% • امتحان {entry.examWeight}%
          </Text>
        </>
      ) : finalMark?.status === 'incomplete' ? (
        <Text className="text-right text-sm leading-5 text-amber-600 dark:text-amber-400">
          {incompleteDescription(finalMark.missing)} — لا تدخل في المعدل حتى تكتمل.
        </Text>
      ) : (
        <Text className="text-right text-sm leading-5 text-red-500">
          {finalMark?.status === 'invalid-weights'
            ? finalMark.error
            : 'لا يمكن حساب النتيجة.'}
        </Text>
      )}
    </Card>
  ) : null;

  return (
    // A standalone screen (pushed on top of the tabs), so it owns its top inset.
    <Screen>
      <View className="flex-row items-center gap-2 px-6 pb-2 pt-2">
        <View className="flex-1 items-end gap-0.5">
          <Text className="text-right text-xl font-bold leading-7 text-slate-900 dark:text-white">
            {subject?.nameAr ?? 'المقرر'}
          </Text>
          <Text className="text-right text-xs leading-4 text-slate-500 dark:text-slate-400">
            {subject?.code ?? ''}
          </Text>
        </View>
        <IconButton
          icon={ChevronRight}
          label="رجوع"
          variant="surface"
          onPress={() => router.back()}
        />
      </View>

      <ScreenScroll className="px-6" contentClassName="gap-4 pb-4">
        {loading || planLoading ? (
          <View className="items-center justify-center gap-2 py-20">
            <ActivityIndicator size="large" color={colors.accent} />
            <Text className="text-center text-sm text-slate-500 dark:text-slate-400">جارٍ التحميل...</Text>
          </View>
        ) : subject ? (
          <>
            {/* Identity and placement. */}
            <View className="items-end gap-1">
              <Text className="text-right text-sm text-slate-500 dark:text-slate-400">
                {subject.nameEn}
              </Text>
              <View className="flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1">
                <Text className="text-xs text-slate-500 dark:text-slate-400">
                  {subject.creditHours} ساعة معتمدة
                </Text>
                {semester ? (
                  <Text className="text-xs text-slate-500 dark:text-slate-400">{semester.name}</Text>
                ) : null}
                {entry ? (
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedSection ? `شعبة ${selectedSection.code}` : 'بدون شعبة'}
                  </Text>
                ) : null}
                {selectedSectionDetails ? (
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedSectionDetails.professorName}
                  </Text>
                ) : null}
              </View>
            </View>

            {resultBlock}

            {/* Tab bar: horizontally scrollable so it never breaks on narrow screens. */}
            <ChipRow className="-mx-6">
              {DETAIL_TABS.map((tab) => (
                <Chip
                  key={tab.key}
                  label={tab.label}
                  active={tab.key === activeTab}
                  onPress={() => setActiveTab(tab.key)}
                />
              ))}
            </ChipRow>

            {/* The tab panels. The cross-fade lives on this container so the
                grades panel keeps its unsaved draft while it is hidden. */}
            <Animated.View style={[styles.tabContent, tabContentStyle]}>
                {/* Overview */}
                {activeTab === 'overview' ? (
                <View className="gap-4">
                  {entry ? (
                    <>
                      {weightsChanged && subject ? (
                        <Callout
                          tone="info"
                          icon={RefreshCw}
                          title="تغيّرت أوزان المقرر في الدليل"
                          message={`الأوزان الحالية: مشروع ${subject.projectWeight}% • امتحان ${subject.examWeight}%. نتيجتك الحالية محسوبة بالأوزان المحفوظة ولن تتغير تلقائيًا.`}
                          action={
                            <Button
                              label="اعتماد الأوزان الجديدة"
                              variant="secondary"
                              onPress={handleUpdateWeights}
                              loading={busy}
                            />
                          }
                        />
                      ) : null}

                      {creditsChanged && subject ? (
                        <Callout
                          tone="neutral"
                          message={`الساعات المعتمدة في الدليل (${subject.creditHours}) تختلف عن المحفوظة (${entry.creditHours}) — يحتفظ المعدل بالقيمة المحفوظة.`}
                        />
                      ) : null}

                      <Card className="gap-3">
                        <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                          الشعبة
                        </Text>
                        <SelectField
                          value={entry.sectionId ?? ''}
                          options={sectionOptions}
                          onSelect={handleSectionChange}
                          placeholder="بدون شعبة"
                          disabled={busy || sections.length === 0}
                          emptyText="لا توجد شعب متاحة لهذا المقرر في هذا الفصل."
                        />
                        {selectedSection && catalog ? (
                          <SectionDetails catalog={catalog} section={selectedSection} />
                        ) : null}
                        <Text className="text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                          اختيار الشعبة تخطيط شخصي فقط، وليس تسجيلًا رسميًا.
                        </Text>
                      </Card>
                    </>
                  ) : (
                    <Card className="gap-3">
                      <Text className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                        هذا المقرر غير مضاف إلى خطتك المحلية.
                      </Text>
                      <Text className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {effectiveSemesterId
                          ? 'أضفه إلى هذا الفصل لمتابعة العلامات والمعدل. المتطلبات السابقة تُعرض كتنبيهات فقط.'
                          : 'اختر فصلًا دراسيًا من شاشة المقررات لإضافته إلى خطتك.'}
                      </Text>
                      {effectiveSemesterId ? (
                        <Button label="إضافة إلى الخطة" onPress={handleAdd} loading={busy} />
                      ) : null}
                    </Card>
                  )}

                  {prerequisites.length > 0 ? (
                    <Callout
                      tone="warning"
                      icon={AlertTriangle}
                      title="تحذير المتطلبات السابقة"
                      message={prerequisites
                        .map(
                          (warning) =>
                            `${warning.label} ${
                              warning.reason === 'not-passed' ? '(مُخطَّط لكن لم يُجتَز)' : '(غير مُخطَّط)'
                            }`,
                        )
                        .join('\n')}
                      hint="هذا تنبيه فقط ولا يمنع إضافة المقرر أو تعديله."
                    />
                  ) : null}

                  <Card className="gap-1 py-1">
                    <Text className="text-right px-1 pb-1 text-sm font-semibold text-slate-900 dark:text-white">
                      معلومات المقرر
                    </Text>
                    <InfoRow label="الساعات المعتمدة" value={String(subject.creditHours)} />
                    <InfoRow label="وزن المشروع (الدليل)" value={`${subject.projectWeight}%`} />
                    <InfoRow label="وزن الامتحان (الدليل)" value={`${subject.examWeight}%`} />
                  </Card>

                  {entry ? (
                    <Button
                      label={cleanupRunning ? 'جارٍ إزالة المقرر...' : 'إزالة المقرر من الخطة'}
                      icon={Trash2}
                      variant="danger"
                      loading={cleanupRunning}
                      disabled={busy || cleanupRunning}
                      onPress={() => void handleRemove()}
                    />
                  ) : null}
                </View>
              ) : null}

              {/* Grades: kept mounted even while hidden so unsaved input survives. */}
              <View style={activeTab === 'grades' ? undefined : styles.hidden}>
                {entry ? (
                  <MarksEditor
                    key={entry.id}
                    entry={entry}
                    onSave={async (marks) => {
                      await setMarks(entry.id, marks);
                    }}
                  />
                ) : (
                  <Text className="text-center text-sm text-slate-500 dark:text-slate-400">
                    أضف المقرر إلى خطتك لتسجيل العلامات.
                  </Text>
                )}
              </View>

              {activeTab === 'summaries' ? <ComingSoon title="المقررات والملخصات" /> : null}
              {activeTab === 'lectures' ? <ComingSoon title="المحاضرات" /> : null}
              {activeTab === 'teams' && catalog && effectiveSemesterId ? (
                <TeamsPanel
                  catalog={catalog}
                  subjectId={subject.id}
                  semesterId={effectiveSemesterId}
                  sectionId={selectedSectionId}
                  sections={sections}
                />
              ) : null}
              {activeTab === 'teams' && (!catalog || !effectiveSemesterId) ? (
                <View className="items-center gap-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/60">
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white">الفرق</Text>
                  <Text className="text-center text-xs text-slate-500 dark:text-slate-400">
                    اختر فصلًا دراسيًا لعرض الفرق وطلب الانضمام.
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          </>
        ) : (
          <Text className="text-center text-sm text-slate-500 dark:text-slate-400">المقرر غير موجود</Text>
        )}

        {planError ? (
          <Button
            label={planError}
            variant="outline"
            onPress={() => void reload()}
          />
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}
