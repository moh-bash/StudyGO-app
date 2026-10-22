/**
 * Credit-hour-weighted averages.
 *
 * Averages are computed over *completed* subject grades only. A subject is
 * eligible when its final mark can be calculated from stored (snapshot) weights
 * and its credit-hour snapshot is a usable positive number. Incomplete subjects
 * are excluded from **both** the numerator and the denominator, and subjects
 * with invalid/unavailable credit hours are excluded entirely.
 *
 * Percentage averages and GPA averages are kept distinct: the GPA average weights
 * each subject's own GPA (from the grade scale), never a conversion of the
 * overall percentage average.
 */
import { computeFinalMark } from './calc';
import { percentageToGrade } from './grade-scale';

/** Raw grading data of one planned subject (marks are `null` when missing). */
export interface GradeInput {
  projectMark: number | null;
  examMark: number | null;
  projectWeight: number;
  examWeight: number;
  creditHours: number;
}

export interface CompletedGrade {
  finalMark: number;
  creditHours: number;
  gpa: number;
}

export interface AverageResult {
  /** Credit-weighted percentage average (unrounded). */
  percentage: number;
  /** Credit-weighted GPA average (unrounded). */
  gpa: number;
  /** Number of completed subjects that contributed. */
  completedCount: number;
  /** Sum of the contributing credit hours. */
  totalCredits: number;
}

export interface AverageSummary {
  average: AverageResult | null;
  completedCount: number;
  incompleteCount: number;
  totalCount: number;
}

/**
 * Converts raw entry grading data into an eligible completed grade, or `null`
 * when the subject is incomplete, has invalid weights, an out-of-range mark or an
 * unusable credit-hour snapshot.
 */
export function toCompletedGrade(input: GradeInput): CompletedGrade | null {
  if (!Number.isFinite(input.creditHours) || input.creditHours <= 0) {
    return null;
  }
  const result = computeFinalMark({
    projectMark: input.projectMark,
    examMark: input.examMark,
    projectWeight: input.projectWeight,
    examWeight: input.examWeight,
  });
  if (result.status !== 'complete') {
    return null;
  }
  const grade = percentageToGrade(result.finalMark);
  if (!grade) {
    return null;
  }
  return { finalMark: result.finalMark, creditHours: input.creditHours, gpa: grade.gpa };
}

/**
 * Credit-weighted percentage + GPA average over the supplied completed grades.
 * Returns `null` when nothing is eligible (empty state, never a fabricated 0).
 */
export function computeWeightedAverage(grades: readonly CompletedGrade[]): AverageResult | null {
  let weightedPercentage = 0;
  let weightedGpa = 0;
  let credits = 0;
  let count = 0;
  for (const grade of grades) {
    if (
      !Number.isFinite(grade.finalMark) ||
      grade.finalMark < 0 ||
      grade.finalMark > 100 ||
      !Number.isFinite(grade.creditHours) ||
      grade.creditHours <= 0 ||
      !Number.isFinite(grade.gpa)
    ) {
      continue;
    }
    weightedPercentage += grade.finalMark * grade.creditHours;
    weightedGpa += grade.gpa * grade.creditHours;
    credits += grade.creditHours;
    count += 1;
  }
  if (credits === 0) {
    return null;
  }
  return {
    percentage: weightedPercentage / credits,
    gpa: weightedGpa / credits,
    completedCount: count,
    totalCredits: credits,
  };
}

/** Averages plus completeness counters, for the semester/cumulative summaries. */
export function summarizeAverage(inputs: readonly GradeInput[]): AverageSummary {
  const completed = inputs
    .map(toCompletedGrade)
    .filter((grade): grade is CompletedGrade => grade !== null);
  return {
    average: computeWeightedAverage(completed),
    completedCount: completed.length,
    incompleteCount: inputs.length - completed.length,
    totalCount: inputs.length,
  };
}

/**
 * Semester average: the credit-weighted average over the completed subjects of
 * one semester plan. Callers pass only that semester's entries; repeated
 * subjects in different semesters are therefore counted as distinct entries.
 */
export function summarizeSemesterAverage(inputs: readonly GradeInput[]): AverageSummary {
  return summarizeAverage(inputs);
}

/**
 * Cumulative average: the credit-weighted average over all completed local plan
 * entries (every semester plan). Each entry is counted once; callers must pass
 * the flat list of entries exactly once.
 */
export function summarizeCumulativeAverage(inputs: readonly GradeInput[]): AverageSummary {
  return summarizeAverage(inputs);
}
