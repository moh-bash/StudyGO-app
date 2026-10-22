/**
 * Home dashboard view-model.
 *
 * Pure function over the already-computed {@link StudyPlanView}: it derives the
 * academic summary shown on Home (cumulative average, the latest planned
 * semester, completion counters) without any network or database access, so the
 * screen stays thin and this logic is unit-tested.
 *
 * Classification rules (Phase 4):
 * - a subject is *completed* only when its final mark is computable (both marks
 *   present and weights valid); a *passed* subject is a completed one whose final
 *   mark is at least the confirmed `PASS_THRESHOLD` (60);
 * - a subject with invalid weights is counted neither as completed nor as passed;
 * - every planned entry is counted exactly once (the store enforces one entry per
 *   account + semester + subject, so the same subject in two semesters is two
 *   distinct planned entries, never a double count within a semester).
 */
import type { AverageSummary } from '../grades/averages';
import type { StudyPlanView } from './plan-view';

export interface HomeSemesterSummary {
  semesterId: string;
  /** Display name, already resolved (never empty) by `buildPlanView`. */
  semesterName: string;
  subjectCount: number;
  average: AverageSummary;
}

export interface HomeSummary {
  /** Credit-weighted average over every completed subject of the whole plan. */
  cumulative: AverageSummary;
  /**
   * The most recent semester represented in the plan (newest first), or `null`
   * when the plan is empty. The app has no explicit "current semester", so this
   * is the latest *planned* semester and must be labelled as such.
   */
  latestSemester: HomeSemesterSummary | null;
  semesterCount: number;
  totalSubjects: number;
  /** Subjects whose final mark can be computed. */
  completedCount: number;
  /** Subjects missing at least one mark. */
  incompleteCount: number;
  /** Subjects whose stored weights are not a valid 0–100 pair summing to 100. */
  invalidCount: number;
  /** Completed subjects at or above the passing threshold. */
  passedCount: number;
  /** Snapshot credit hours of passed subjects. */
  passedCredits: number;
  /** Snapshot credit hours of every planned subject. */
  plannedCredits: number;
}

function toSemesterSummary(semester: StudyPlanView['semesters'][number]): HomeSemesterSummary {
  return {
    semesterId: semester.semesterId,
    semesterName: semester.semesterName,
    subjectCount: semester.subjects.length,
    average: semester.average,
  };
}

/**
 * Builds the Home dashboard summary from the plan view. Never throws and never
 * fabricates a value for a missing average (`cumulative.average` is `null` when
 * no subject is eligible — the UI renders an explicit empty state).
 */
export function buildHomeSummary(view: StudyPlanView): HomeSummary {
  let completedCount = 0;
  let incompleteCount = 0;
  let invalidCount = 0;
  let passedCount = 0;
  let passedCredits = 0;
  let plannedCredits = 0;

  for (const semester of view.semesters) {
    for (const subject of semester.subjects) {
      const credits = Number.isFinite(subject.creditHours) ? Math.max(subject.creditHours, 0) : 0;
      plannedCredits += credits;
      switch (subject.finalMark.status) {
        case 'complete':
          completedCount += 1;
          if (subject.passing) {
            passedCount += 1;
            passedCredits += credits;
          }
          break;
        case 'incomplete':
          incompleteCount += 1;
          break;
        case 'invalid-weights':
          invalidCount += 1;
          break;
      }
    }
  }

  return {
    cumulative: view.cumulative,
    latestSemester: view.semesters.length > 0 ? toSemesterSummary(view.semesters[0]) : null,
    semesterCount: view.semesters.length,
    totalSubjects: view.totalEntries,
    completedCount,
    incompleteCount,
    invalidCount,
    passedCount,
    passedCredits,
    plannedCredits,
  };
}
