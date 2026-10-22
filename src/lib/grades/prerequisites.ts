/**
 * Prerequisite warnings (on-device, warning-only).
 *
 * The backend already models prerequisites (`Subject.prerequisites` →
 * `prerequisiteIds` in `GET /catalog`). Phase 3 adds no server data: a planned
 * subject whose prerequisites are not shown as *passed* in the local plan gets a
 * warning the student may ignore — adding/keeping the subject is never blocked.
 * Warnings are re-derived from the local plan whenever marks or the plan change,
 * and nothing is transmitted to the backend.
 */
import type { GradeInput } from './averages';
import { computeFinalMark } from './calc';
import { isPassing } from './grade-scale';

export type PrerequisiteWarningReason = 'not-planned' | 'not-passed';

export interface PrerequisiteWarning {
  prerequisiteId: string;
  /** Display label, e.g. `CS101 — مقدمة في البرمجة`. */
  label: string;
  reason: PrerequisiteWarningReason;
}

export interface PrerequisiteSubjectInfo {
  id: string;
  code?: string;
  nameAr?: string;
  nameEn?: string;
}

/** Local plan entry with its subject id, used to decide what has been passed. */
export type PassedCheckInput = GradeInput & { subjectId: string };

/**
 * Subject ids the local plan shows as *passed*: a completed final mark at or
 * above the pass threshold. A subject planned in two semesters counts as passed
 * if either completed entry passes.
 */
export function collectPassedSubjectIds(entries: readonly PassedCheckInput[]): Set<string> {
  const passed = new Set<string>();
  for (const entry of entries) {
    const result = computeFinalMark({
      projectMark: entry.projectMark,
      examMark: entry.examMark,
      projectWeight: entry.projectWeight,
      examWeight: entry.examWeight,
    });
    if (result.status === 'complete' && isPassing(result.finalMark)) {
      passed.add(entry.subjectId);
    }
  }
  return passed;
}

function defaultLabel(id: string): string {
  return `المقرر ${id.slice(0, 8)}`;
}

function labelFor(info: PrerequisiteSubjectInfo | undefined, id: string): string {
  if (!info) {
    return defaultLabel(id);
  }
  const name = info.nameAr?.trim() || info.nameEn?.trim() || '';
  if (info.code?.trim() && name) {
    return `${info.code.trim()} — ${name}`;
  }
  return info.code?.trim() || name || defaultLabel(id);
}

/**
 * Evaluates the prerequisites of one planned subject.
 *
 * Returns one warning per prerequisite that is not shown as passed locally — the
 * caller decides how to display them. An empty array means no warning.
 *
 * When `plannedSubjectIds` is supplied, a prerequisite that *is* in the plan but
 * has no passing completed mark is reported as `not-passed`; otherwise as
 * `not-planned`.
 */
export function evaluatePrerequisites(
  prerequisiteIds: readonly string[],
  options: {
    passedSubjectIds: ReadonlySet<string>;
    plannedSubjectIds?: ReadonlySet<string>;
    resolve?: (subjectId: string) => PrerequisiteSubjectInfo | undefined;
  },
): PrerequisiteWarning[] {
  const warnings: PrerequisiteWarning[] = [];
  for (const id of prerequisiteIds) {
    if (options.passedSubjectIds.has(id)) {
      continue;
    }
    warnings.push({
      prerequisiteId: id,
      label: labelFor(options.resolve?.(id), id),
      reason: options.plannedSubjectIds?.has(id) ? 'not-passed' : 'not-planned',
    });
  }
  return warnings;
}

/** Arabic summary line for a warning list (used by the UI). */
export function describePrerequisiteWarnings(warnings: readonly PrerequisiteWarning[]): string {
  if (warnings.length === 0) {
    return '';
  }
  const parts = warnings.map((warning) =>
    warning.reason === 'not-passed'
      ? `${warning.label} (مُخطَّط لكن لم يُجتَز)`
      : `${warning.label} (غير مُخطَّط)`,
  );
  return `تحذير: لم تُستوفَ المتطلبات السابقة — ${parts.join('، ')}.`;
}
