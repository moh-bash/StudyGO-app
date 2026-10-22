/**
 * Subject final-mark calculation.
 *
 *   finalMark = projectMark × projectWeight / 100 + examMark × examWeight / 100
 *
 * Missing marks are never treated as zero: a subject with a missing component is
 * *incomplete* and is excluded from every average. Internal precision is kept at
 * full floating point; rounding happens only for display (`formatPercentage`).
 */
import { formatPercentage } from './grade-scale';

/** Supported mark range (inclusive). */
export const MIN_MARK = 0;
export const MAX_MARK = 100;

export type MissingComponent = 'project' | 'exam';

export interface FinalMarkInput {
  projectMark: number | null;
  examMark: number | null;
  projectWeight: number;
  examWeight: number;
}

export type FinalMarkResult =
  | { status: 'complete'; finalMark: number; missing: [] }
  | { status: 'incomplete'; finalMark: null; missing: MissingComponent[] }
  | { status: 'invalid-weights'; finalMark: null; missing: []; error: string };

/** True when `value` is a real number inside the supported mark range. */
export function isValidMarkValue(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= MIN_MARK && value <= MAX_MARK
  );
}

/**
 * True when the two component weights are valid grading weights: both finite,
 * inside 0–100 and adding up to exactly 100 (with a small tolerance so decimal
 * splits such as 33.33 / 66.67 are accepted).
 */
export function isValidWeights(projectWeight: unknown, examWeight: unknown): boolean {
  if (
    typeof projectWeight !== 'number' ||
    typeof examWeight !== 'number' ||
    !Number.isFinite(projectWeight) ||
    !Number.isFinite(examWeight)
  ) {
    return false;
  }
  if (projectWeight < 0 || projectWeight > 100 || examWeight < 0 || examWeight > 100) {
    return false;
  }
  return Math.abs(projectWeight + examWeight - 100) <= 0.001;
}

/** Error message used when a submitted weight pair is invalid. */
export const INVALID_WEIGHTS_MESSAGE = 'أوزان المقرر غير صالحة: يجب أن يكون مجموع وزن المشروع ووزن الامتحان 100.';

export type MarkParseResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/**
 * Parses a mark typed by the student.
 *
 * - an empty/whitespace-only string means *missing* (`null`) — a valid state;
 * - anything non-numeric, non-finite or outside 0–100 is rejected;
 * - `0` is kept as the valid value zero.
 */
export function parseMarkInput(raw: string): MarkParseResult {
  const text = raw.trim();
  if (text === '') {
    return { ok: true, value: null };
  }
  // Arabic-Indic digits (٠-٩) and the Arabic decimal separator are accepted so a
  // student can type in either script.
  const normalised = text
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[٫،]/g, '.');
  if (!/^[0-9]+(\.[0-9]+)?$/.test(normalised)) {
    return { ok: false, error: 'أدخل رقمًا صحيحًا للعلامة.' };
  }
  const value = Number(normalised);
  if (!Number.isFinite(value) || value < MIN_MARK || value > MAX_MARK) {
    return { ok: false, error: `يجب أن تكون العلامة بين ${MIN_MARK} و ${MAX_MARK}.` };
  }
  return { ok: true, value };
}

/**
 * Computes the subject final mark, distinguishing the three states that matter
 * to the UI: `complete`, `incomplete` (with the missing component(s)) and
 * `invalid-weights`.
 */
export function computeFinalMark(input: FinalMarkInput): FinalMarkResult {
  if (!isValidWeights(input.projectWeight, input.examWeight)) {
    return {
      status: 'invalid-weights',
      finalMark: null,
      missing: [],
      error: INVALID_WEIGHTS_MESSAGE,
    };
  }

  const missing: MissingComponent[] = [];
  if (input.projectMark === null) {
    missing.push('project');
  }
  if (input.examMark === null) {
    missing.push('exam');
  }
  if (missing.length > 0 || input.projectMark === null || input.examMark === null) {
    return { status: 'incomplete', finalMark: null, missing };
  }

  const finalMark =
    (input.projectMark * input.projectWeight) / 100 + (input.examMark * input.examWeight) / 100;
  return { status: 'complete', finalMark, missing: [] };
}

/** Arabic label of a missing component (used by the UI). */
export function missingComponentLabel(component: MissingComponent): string {
  return component === 'project' ? 'علامة المشروع' : 'علامة الامتحان';
}

/** Human-readable description of an incomplete subject. */
export function incompleteDescription(missing: MissingComponent[]): string {
  if (missing.length === 0) {
    return '';
  }
  return `ناقص: ${missing.map(missingComponentLabel).join(' و ')}`;
}

/** Display helper for an optional final mark. */
export function describeFinalMark(result: FinalMarkResult): string {
  if (result.status === 'complete') {
    return formatPercentage(result.finalMark);
  }
  if (result.status === 'invalid-weights') {
    return 'أوزان غير صالحة';
  }
  return 'غير مكتمل';
}
