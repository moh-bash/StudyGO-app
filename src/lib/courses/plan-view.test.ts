import { describe, expect, it } from 'vitest';
import type { Catalog, CatalogSemester, CatalogSubject } from '../api/catalog';
import type { PlanEntry } from '../db/plan-types';
import { buildPlanView, semesterLabel } from './plan-view';

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

function subject(overrides: Partial<CatalogSubject> & Pick<CatalogSubject, 'id'>): CatalogSubject {
  return {
    programId: 'program-1',
    code: overrides.id.toUpperCase(),
    nameEn: overrides.id,
    nameAr: `مقرر ${overrides.id}`,
    creditHours: 3,
    projectWeight: 25,
    examWeight: 75,
    prerequisiteIds: [],
    ...overrides,
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

describe('buildPlanView', () => {
  const semesters = [
    semester('sem-2024', '2024', '2024-09-01T00:00:00.000Z'),
    semester('sem-2025', '2025', '2025-09-01T00:00:00.000Z'),
  ];
  const subjects = [subject({ id: 'cs101' }), subject({ id: 'cs102' })];

  it('groups by semester (newest first), computes results and averages', () => {
    const plan = buildPlanView(
      [
        entry({
          id: 'e1',
          semesterId: 'sem-2025',
          subjectId: 'cs102',
          projectMark: 80,
          examMark: 90,
        }),
        entry({
          id: 'e2',
          semesterId: 'sem-2025',
          subjectId: 'cs101',
          projectMark: 88,
          examMark: null,
        }),
        entry({
          id: 'e3',
          semesterId: 'sem-2024',
          subjectId: 'cs101',
          projectMark: 90,
          examMark: 90,
        }),
      ],
      catalog(subjects, semesters),
    );

    expect(plan.semesters.map((view) => view.semesterId)).toEqual(['sem-2025', 'sem-2024']);
    expect(plan.totalEntries).toBe(3);

    const current = plan.semesters[0];
    expect(current.semesterName).toBe('2025');
    expect(current.subjects.map((view) => view.code)).toEqual(['CS101', 'CS102']);
    const complete = current.subjects.find((view) => view.code === 'CS102');
    expect(complete?.finalMark).toEqual({ status: 'complete', finalMark: 87.5, missing: [] });
    expect(complete?.grade).toEqual({ letter: 'B+', gpa: 3.25 });
    expect(complete?.passing).toBe(true);

    const incomplete = current.subjects.find((view) => view.code === 'CS101');
    expect(incomplete?.finalMark).toEqual({
      status: 'incomplete',
      finalMark: null,
      missing: ['exam'],
    });
    expect(incomplete?.grade).toBeNull();

    // Only the complete subject contributes: 87.5 over 3 credits.
    expect(current.average).toMatchObject({
      completedCount: 1,
      incompleteCount: 1,
      totalCount: 2,
      average: { percentage: 87.5, gpa: 3.25, totalCredits: 3 },
    });

    // Cumulative: (87.5*3 + 90*3) / 6.
    expect(plan.cumulative.average).toMatchObject({
      percentage: 88.75,
      gpa: 3.375,
      completedCount: 2,
      totalCredits: 6,
    });
    expect(plan.cumulative.incompleteCount).toBe(1);
  });

  it('flags catalog weight and credit drift without changing the stored snapshots', () => {
    const plan = buildPlanView(
      [
        entry({
          id: 'e1',
          semesterId: 'sem-2025',
          subjectId: 'cs101',
          projectMark: 80,
          examMark: 90,
          projectWeight: 25,
          examWeight: 75,
          creditHours: 3,
        }),
      ],
      catalog(
        [
          subject({
            id: 'cs101',
            projectWeight: 40,
            examWeight: 60,
            creditHours: 4,
          }),
        ],
        semesters,
      ),
    );

    const view = plan.semesters[0].subjects[0];
    expect(view.weightsChanged).toBe(true);
    expect(view.creditsChanged).toBe(true);
    expect(view.currentWeights).toEqual({ projectWeight: 40, examWeight: 60 });
    expect(view.entry.projectWeight).toBe(25);
    expect(view.entry.examWeight).toBe(75);
    expect(view.finalMark).toEqual({ status: 'complete', finalMark: 87.5, missing: [] });
    expect(plan.cumulative.average?.totalCredits).toBe(3);
  });

  it('keeps entries whose subject is no longer in the catalog', () => {
    const plan = buildPlanView(
      [entry({ id: 'gone', semesterId: 'sem-unknown', subjectId: 'abcdefgh-rest' })],
      null,
    );
    expect(plan.semesters[0].semesterName).toBe('فصل غير معروف');
    const view = plan.semesters[0].subjects[0];
    expect(view.subject).toBeNull();
    expect(view.code).toBe('abcdefgh');
    expect(view.nameAr).toBe('مقرر غير متوفر في الدليل');
    expect(view.currentWeights).toBeNull();
    expect(view.weightsChanged).toBe(false);
    expect(view.finalMark.status).toBe('incomplete');
  });

  it('warns about prerequisites not shown as passed locally', () => {
    const withPrereq = subject({
      id: 'cs200',
      code: 'CS200',
      nameAr: 'مقرر متقدم',
      prerequisiteIds: ['cs101', 'cs999'],
    });
    const plan = buildPlanView(
      [
        entry({ id: 'advanced', semesterId: 'sem-2025', subjectId: 'cs200', projectMark: 70, examMark: 70 }),
        entry({ id: 'prereq', semesterId: 'sem-2024', subjectId: 'cs101', projectMark: 90, examMark: 90 }),
      ],
      catalog([withPrereq, subject({ id: 'cs101' })], semesters),
    );
    const advanced = plan.semesters
      .find((view) => view.semesterId === 'sem-2025')
      ?.subjects.find((view) => view.code === 'CS200');
    expect(advanced?.prerequisites).toEqual([
      {
        prerequisiteId: 'cs999',
        label: 'المقرر cs999',
        reason: 'not-planned',
      },
    ]);
    expect(plan.warningCount).toBe(1);
  });

  it('reports a planned but unpassed prerequisite as such', () => {
    const plan = buildPlanView(
      [
        entry({ id: 'advanced', semesterId: 'sem-2025', subjectId: 'cs200' }),
        entry({ id: 'prereq', semesterId: 'sem-2024', subjectId: 'cs101', projectMark: 40, examMark: 40 }),
      ],
      catalog(
        [
          subject({
            id: 'cs200',
            code: 'CS200',
            prerequisiteIds: ['cs101'],
          }),
          subject({ id: 'cs101' }),
        ],
        semesters,
      ),
    );
    const advanced = plan.semesters
      .find((view) => view.semesterId === 'sem-2025')
      ?.subjects.find((view) => view.code === 'CS200');
    expect(advanced?.prerequisites[0].reason).toBe('not-passed');
  });

  it('excludes complete entries without usable credits from the averages', () => {
    const plan = buildPlanView(
      [
        entry({
          id: 'zero-credits',
          semesterId: 'sem-2025',
          subjectId: 'cs101',
          projectMark: 90,
          examMark: 90,
          creditHours: 0,
        }),
      ],
      catalog(subjects, semesters),
    );
    expect(plan.cumulative.average).toBeNull();
    expect(plan.cumulative.completedCount).toBe(0);
    expect(plan.cumulative.incompleteCount).toBe(1);
    expect(plan.semesters[0].subjects[0].grade).toEqual({ letter: 'A-', gpa: 3.5 });
  });
});

describe('semesterLabel', () => {
  it('prefers the name, then the code, then the fallback', () => {
    expect(semesterLabel(semester('s', 'الخريف', '2025-09-01'), 'بديل')).toBe('الخريف');
    expect(semesterLabel({ ...semester('s', '  ', '2025-09-01'), code: 'S1' }, 'بديل')).toBe('S1');
    expect(semesterLabel(null, 'بديل')).toBe('بديل');
  });
});
