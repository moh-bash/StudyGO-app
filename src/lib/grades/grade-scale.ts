/**
 * The StudyGO percentage → letter-grade → GPA scale.
 *
 * Boundaries (from the project's supplied grading table):
 *
 * | Percentage      | Letter | GPA  |
 * |-----------------|--------|------|
 * | 98 ≤ m ≤ 100    | A+     | 4.00 |
 * | 95 ≤ m < 98     | A      | 3.75 |
 * | 90 ≤ m < 95     | A−     | 3.50 |
 * | 85 ≤ m < 90     | B+     | 3.25 |
 * | 80 ≤ m < 85     | B      | 3.00 |
 * | 75 ≤ m < 80     | B−     | 2.75 |
 * | 70 ≤ m < 75     | C+     | 2.50 |
 * | 65 ≤ m < 70     | C      | 2.25 |
 * | 60 ≤ m < 65     | C−     | 2.00 |
 * | 55 ≤ m < 60     | D+     | 1.75 |
 * | 50 ≤ m < 55     | D      | 1.50 |
 * | m < 50          | E/F    | 0.00 |
 *
 * The whole mapping lives here so it can be updated in one place if the
 * university's official rules are later verified or changed.
 */

export interface GradeBand {
  /** Minimum percentage (inclusive) for the band. */
  min: number;
  letter: string;
  gpa: number;
}

/**
 * Ordered from the highest band down. A lookup takes the first band whose
 * inclusive minimum the mark reaches, which reproduces the half-open intervals
 * above exactly (`98` → A+, `97.99` → A, `50` → D, `49.99` → E/F, …).
 */
export const GRADE_SCALE: readonly GradeBand[] = [
  { min: 98, letter: 'A+', gpa: 4.0 },
  { min: 95, letter: 'A', gpa: 3.75 },
  { min: 90, letter: 'A-', gpa: 3.5 },
  { min: 85, letter: 'B+', gpa: 3.25 },
  { min: 80, letter: 'B', gpa: 3.0 },
  { min: 75, letter: 'B-', gpa: 2.75 },
  { min: 70, letter: 'C+', gpa: 2.5 },
  { min: 65, letter: 'C', gpa: 2.25 },
  { min: 60, letter: 'C-', gpa: 2.0 },
  { min: 55, letter: 'D+', gpa: 1.75 },
  { min: 50, letter: 'D', gpa: 1.5 },
  { min: 0, letter: 'E/F', gpa: 0.0 },
] as const;

/**
 * Percentage at (or above) which a subject counts as *passed* — used only for
 * the prerequisite warnings.
 *
 * Source: the backend's existing isolated constant `DEFAULT_PASS_MARK = 60`
 * (`study-go-api/src/common/utils/grading.util.ts`). The university's official
 * passing threshold could not be verified against `StudyGO-Project-Reference.md`
 * (the file is absent from the workspace), so this mirrors the backend's
 * current, explicitly-labelled placeholder rather than inventing a rule.
 */
export const PASS_THRESHOLD = 60;

export interface Grade {
  letter: string;
  gpa: number;
}

/**
 * Maps a final percentage to its letter grade and GPA.
 *
 * Returns `null` for a missing (`null`), non-finite or out-of-range value — a
 * missing mark has no grade yet.
 */
export function percentageToGrade(percentage: number | null | undefined): Grade | null {
  if (percentage === null || percentage === undefined || !Number.isFinite(percentage)) {
    return null;
  }
  if (percentage < 0 || percentage > 100) {
    return null;
  }
  const band = GRADE_SCALE.find((candidate) => percentage >= candidate.min);
  return band ? { letter: band.letter, gpa: band.gpa } : null;
}

/** True when a completed percentage meets {@link PASS_THRESHOLD}. */
export function isPassing(percentage: number | null | undefined): boolean {
  return (
    percentage !== null &&
    percentage !== undefined &&
    Number.isFinite(percentage) &&
    percentage >= PASS_THRESHOLD
  );
}

/** Formats a percentage for display without re-rounding the stored value. */
export function formatPercentage(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined || !Number.isFinite(percentage)) {
    return '—';
  }
  return `${percentage.toFixed(2)}%`;
}

/** Formats a GPA for display. */
export function formatGpa(gpa: number | null | undefined): string {
  if (gpa === null || gpa === undefined || !Number.isFinite(gpa)) {
    return '—';
  }
  return gpa.toFixed(2);
}
