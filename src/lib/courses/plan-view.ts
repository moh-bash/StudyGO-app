/**
 * Display view-models for the private study plan.
 *
 * Pure functions: they combine the stored plan entries with the cached catalog
 * (which may be missing offline) and the pure grading modules. Nothing here
 * writes data or talks to the network, so the screens stay thin and the logic is
 * unit-tested.
 *
 * Rules:
 * - an entry whose subject is no longer in the catalog is still shown, with its
 *   stored snapshots (marks/weights/credits) intact;
 * - a grade is only shown for complete entries with valid snapshot weights;
 * - credits never silently follow the catalog: a drift is surfaced separately and
 *   the student must deliberately adopt the new values;
 * - prerequisite warnings are derived from the local plan and are warning-only.
 */
import type { Catalog, CatalogSemester, CatalogSubject } from '../api/catalog';
import type { PlanEntry } from '../db/plan-types';
import { summarizeAverage, type AverageSummary, type GradeInput } from '../grades/averages';
import { computeFinalMark, type FinalMarkResult } from '../grades/calc';
import { isPassing, percentageToGrade, type Grade } from '../grades/grade-scale';
import {
  collectPassedSubjectIds,
  evaluatePrerequisites,
  type PassedCheckInput,
  type PrerequisiteWarning,
} from '../grades/prerequisites';

const WEIGHT_TOLERANCE = 0.001;
const UNKNOWN_SEMESTER = 'فصل غير معروف';

export interface PlanSubjectView {
  entry: PlanEntry;
  /** Catalog subject, or `null` when it is no longer cached/offered. */
  subject: CatalogSubject | null;
  /** Display code, falling back to a short local id. */
  code: string;
  /** Arabic display name, falling back to a neutral placeholder. */
  nameAr: string;
  /** Credit-hour snapshot used by the averages. */
  creditHours: number;
  finalMark: FinalMarkResult;
  /** Letter/GPA, only when the final mark is complete. */
  grade: Grade | null;
  passing: boolean;
  prerequisites: PrerequisiteWarning[];
  /** Weights currently advertised by the catalog, when the subject is known. */
  currentWeights: { projectWeight: number; examWeight: number } | null;
  /** The catalog weights differ from the stored snapshot. */
  weightsChanged: boolean;
  /** The catalog credit hours differ from the stored snapshot. */
  creditsChanged: boolean;
}

export interface PlanSemesterView {
  semesterId: string;
  semester: CatalogSemester | null;
  semesterName: string;
  subjects: PlanSubjectView[];
  average: AverageSummary;
}

export interface StudyPlanView {
  semesters: PlanSemesterView[];
  /** Credit-weighted average over every completed entry, across semesters. */
  cumulative: AverageSummary;
  totalEntries: number;
  /** Number of subjects with at least one unmet prerequisite warning. */
  warningCount: number;
}

function gradeInputOf(entry: PlanEntry): GradeInput {
  return {
    projectMark: entry.projectMark,
    examMark: entry.examMark,
    projectWeight: entry.projectWeight,
    examWeight: entry.examWeight,
    creditHours: entry.creditHours,
  };
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= WEIGHT_TOLERANCE;
}

function semesterStart(semester: CatalogSemester | null): number {
  if (!semester?.startDate) {
    return 0;
  }
  const parsed = Date.parse(semester.startDate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function bySubjectCode(a: PlanSubjectView, b: PlanSubjectView): number {
  const byCode = a.code.localeCompare(b.code, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  return byCode !== 0 ? byCode : a.entry.id.localeCompare(b.entry.id);
}

function compareSemesters(a: PlanSemesterView, b: PlanSemesterView): number {
  const byDate = semesterStart(b.semester) - semesterStart(a.semester);
  if (byDate !== 0) {
    return byDate;
  }
  return a.semesterName.localeCompare(b.semesterName, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Builds the complete screen view of the plan: semesters (newest first), each
 * subject with its computed result and warnings, plus the semester and cumulative
 * averages.
 */
export function buildPlanView(
  entries: readonly PlanEntry[],
  catalog: Catalog | null,
): StudyPlanView {
  const subjectById = new Map<string, CatalogSubject>(
    (catalog?.subjects ?? []).map((subject) => [subject.id, subject]),
  );
  const semesterById = new Map<string, CatalogSemester>(
    (catalog?.semesters ?? []).map((semester) => [semester.id, semester]),
  );

  const passedSubjectIds = collectPassedSubjectIds(
    entries.map<PassedCheckInput>((entry) => ({
      subjectId: entry.subjectId,
      ...gradeInputOf(entry),
    })),
  );
  const plannedSubjectIds = new Set(entries.map((entry) => entry.subjectId));

  const resolveSubject = (subjectId: string) => {
    const subject = subjectById.get(subjectId);
    return subject
      ? { id: subject.id, code: subject.code, nameAr: subject.nameAr, nameEn: subject.nameEn }
      : undefined;
  };

  const bySemester = new Map<string, PlanSubjectView[]>();
  let warningCount = 0;

  for (const entry of entries) {
    const subject = subjectById.get(entry.subjectId) ?? null;
    const finalMark = computeFinalMark(gradeInputOf(entry));
    const grade =
      finalMark.status === 'complete' ? percentageToGrade(finalMark.finalMark) : null;
    const prerequisites = evaluatePrerequisites(subject?.prerequisiteIds ?? [], {
      passedSubjectIds,
      plannedSubjectIds,
      resolve: resolveSubject,
    });
    if (prerequisites.length > 0) {
      warningCount += 1;
    }

    const view: PlanSubjectView = {
      entry,
      subject,
      code: subject?.code ?? entry.subjectId.slice(0, 8),
      nameAr: subject?.nameAr ?? 'مقرر غير متوفر في الدليل',
      creditHours: entry.creditHours,
      finalMark,
      grade,
      passing: finalMark.status === 'complete' && isPassing(finalMark.finalMark),
      prerequisites,
      currentWeights: subject
        ? { projectWeight: subject.projectWeight, examWeight: subject.examWeight }
        : null,
      weightsChanged: subject
        ? !sameNumber(subject.projectWeight, entry.projectWeight) ||
          !sameNumber(subject.examWeight, entry.examWeight)
        : false,
      creditsChanged: subject ? subject.creditHours !== entry.creditHours : false,
    };

    const bucket = bySemester.get(entry.semesterId);
    if (bucket) {
      bucket.push(view);
    } else {
      bySemester.set(entry.semesterId, [view]);
    }
  }

  const semesters: PlanSemesterView[] = Array.from(bySemester.entries()).map(
    ([semesterId, subjects]) => {
      const semester = semesterById.get(semesterId) ?? null;
      return {
        semesterId,
        semester,
        semesterName: semester?.name?.trim() || semester?.code?.trim() || UNKNOWN_SEMESTER,
        subjects: subjects.slice().sort(bySubjectCode),
        average: summarizeAverage(subjects.map((subject) => gradeInputOf(subject.entry))),
      };
    },
  );
  semesters.sort(compareSemesters);

  return {
    semesters,
    cumulative: summarizeAverage(entries.map(gradeInputOf)),
    totalEntries: entries.length,
    warningCount,
  };
}

/** A compact label for a semester, used in pickers and results lists. */
export function semesterLabel(semester: CatalogSemester | null, fallback: string): string {
  return semester?.name?.trim() || semester?.code?.trim() || fallback;
}
