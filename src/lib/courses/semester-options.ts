/**
 * Semester selector view-model for the Courses screen.
 *
 * The Courses screen is organised around semesters. The selectable semesters are
 * the union of:
 * - the semesters already present in the student's plan (with their subject
 *   counts and averages), and
 * - the semesters offered by the catalog that have no planned subjects yet — so
 *   an "empty" semester can be selected and filled via the add-course flow.
 *
 * Pure and unit-tested; it performs no I/O.
 */
import type { Catalog, CatalogSemester } from '../api/catalog';
import type { AverageSummary } from '../grades/averages';
import type { StudyPlanView } from './plan-view';

export interface SemesterOption {
  semesterId: string;
  name: string;
  code: string | null;
  /** True when the semester already has at least one planned subject. */
  planned: boolean;
  subjectCount: number;
  average: AverageSummary;
}

const UNKNOWN_SEMESTER = 'فصل غير معروف';

function emptyAverage(): AverageSummary {
  return { average: null, completedCount: 0, incompleteCount: 0, totalCount: 0 };
}

function startDateOf(semester: CatalogSemester | null): number {
  if (!semester?.startDate) {
    return 0;
  }
  const parsed = Date.parse(semester.startDate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

interface Entry {
  option: SemesterOption;
  startDate: number;
}

/**
 * Builds the ordered semester options (newest first). Planned semesters always
 * appear; unplanned catalog semesters are appended so they can be selected.
 */
export function buildSemesterOptions(
  view: StudyPlanView,
  catalog: Catalog | null,
): SemesterOption[] {
  const byId = new Map<string, Entry>();

  for (const semester of view.semesters) {
    byId.set(semester.semesterId, {
      option: {
        semesterId: semester.semesterId,
        name: semester.semesterName,
        code: semester.semester?.code ?? null,
        planned: true,
        subjectCount: semester.subjects.length,
        average: semester.average,
      },
      startDate: startDateOf(semester.semester),
    });
  }

  for (const semester of catalog?.semesters ?? []) {
    if (byId.has(semester.id)) {
      continue;
    }
    byId.set(semester.id, {
      option: {
        semesterId: semester.id,
        name: semester.name?.trim() || semester.code?.trim() || UNKNOWN_SEMESTER,
        code: semester.code ?? null,
        planned: false,
        subjectCount: 0,
        average: emptyAverage(),
      },
      startDate: startDateOf(semester),
    });
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const byDate = b.startDate - a.startDate;
      if (byDate !== 0) {
        return byDate;
      }
      if (a.option.planned !== b.option.planned) {
        return a.option.planned ? -1 : 1;
      }
      return a.option.name.localeCompare(b.option.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    })
    .map((entry) => entry.option);
}
