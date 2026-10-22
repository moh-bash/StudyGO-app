/**
 * Unit tests for the Courses-screen semester selector.
 *
 * The selector must always include the semesters already in the plan (so
 * existing work is never hidden) and append catalog semesters with no planned
 * subjects (so an empty semester can still be chosen and filled).
 */
import { describe, expect, it } from 'vitest';
import type { Catalog, CatalogSemester, CatalogSubject } from '../api/catalog';
import type { PlanEntry } from '../db/plan-types';
import { buildPlanView } from './plan-view';
import { buildSemesterOptions } from './semester-options';

function semester(id: string, name: string, startDate: string): CatalogSemester {
  return {
    id,
    programId: 'program-1',
    name,
    code: id,
    startDate,
    endDate: null,
    status: 'ACTIVE',
  };
}

function subject(id: string): CatalogSubject {
  return {
    id,
    programId: 'program-1',
    code: id.toUpperCase(),
    nameEn: id,
    nameAr: `مقرر ${id}`,
    creditHours: 3,
    projectWeight: 25,
    examWeight: 75,
    prerequisiteIds: [],
  };
}

function entry(overrides: Partial<PlanEntry> & Pick<PlanEntry, 'id' | 'semesterId' | 'subjectId'>): PlanEntry {
  return {
    userId: 'user-a',
    sectionId: null,
    projectMark: null,
    examMark: null,
    projectWeight: 25,
    examWeight: 75,
    creditHours: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function catalog(subjects: CatalogSubject[], semesters: CatalogSemester[]): Catalog {
  return {
    program: { id: 'program-1', name: 'Program', code: 'P1' },
    semesters,
    subjects,
    professors: [],
    sections: [],
    schedules: [],
  };
}

describe('buildSemesterOptions', () => {
  const semesters = [
    semester('sem-2024', '2024', '2024-09-01T00:00:00.000Z'),
    semester('sem-2025', '2025', '2025-09-01T00:00:00.000Z'),
    semester('sem-2026', '2026', '2026-09-01T00:00:00.000Z'),
  ];

  it('returns planned semesters plus unplanned catalog semesters, newest first', () => {
    const view = buildPlanView(
      [
        entry({ id: 'e1', semesterId: 'sem-2025', subjectId: 'cs101', projectMark: 90, examMark: 90 }),
        entry({ id: 'e2', semesterId: 'sem-2025', subjectId: 'cs102' }),
      ],
      catalog([subject('cs101'), subject('cs102')], semesters),
    );

    const options = buildSemesterOptions(view, catalog([subject('cs101'), subject('cs102')], semesters));

    expect(options.map((option) => option.semesterId)).toEqual(['sem-2026', 'sem-2025', 'sem-2024']);
    const planned = options.find((option) => option.semesterId === 'sem-2025');
    expect(planned).toMatchObject({ planned: true, subjectCount: 2 });
    expect(planned?.average.completedCount).toBe(1);
    const empty = options.find((option) => option.semesterId === 'sem-2026');
    expect(empty).toMatchObject({ planned: false, subjectCount: 0 });
    expect(empty?.average.average).toBeNull();
  });

  it('still lists a planned semester that is missing from the catalog', () => {
    const view = buildPlanView(
      [entry({ id: 'e1', semesterId: 'sem-unknown', subjectId: 'cs101' })],
      null,
    );
    const options = buildSemesterOptions(view, null);
    expect(options).toHaveLength(1);
    expect(options[0].semesterId).toBe('sem-unknown');
    expect(options[0].planned).toBe(true);
    expect(options[0].name).toBe('فصل غير معروف');
  });

  it('falls back to the code and then a placeholder for an unnamed catalog semester', () => {
    const view = buildPlanView([], null);
    const options = buildSemesterOptions(
      view,
      catalog(
        [],
        [
          { ...semester('s-code', '   ', '2026-01-01'), code: 'S99' },
          { ...semester('s-blank', '   ', '2025-01-01'), code: '   ' },
        ],
      ),
    );
    expect(options.find((option) => option.semesterId === 's-code')?.name).toBe('S99');
    expect(options.find((option) => option.semesterId === 's-blank')?.name).toBe('فصل غير معروف');
  });
});
