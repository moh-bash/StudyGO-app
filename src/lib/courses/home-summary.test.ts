/**
 * Unit tests for the Home dashboard view-model.
 *
 * The Home summary must count each planned subject exactly once, exclude
 * incomplete subjects from every average (via `buildPlanView`), never fabricate
 * a number, and label the newest semester as a *planned* one — the app has no
 * notion of an official "current" semester.
 */
import { describe, expect, it } from 'vitest';
import type { Catalog, CatalogSemester, CatalogSubject } from '../api/catalog';
import type { PlanEntry } from '../db/plan-types';
import { buildPlanView } from './plan-view';
import { buildHomeSummary } from './home-summary';

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

function entry(
  overrides: Partial<PlanEntry> & Pick<PlanEntry, 'id' | 'semesterId' | 'subjectId'>,
): PlanEntry {
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

const semesters = [
  semester('sem-2024', '2024', '2024-09-01T00:00:00.000Z'),
  semester('sem-2025', '2025', '2025-09-01T00:00:00.000Z'),
];

describe('buildHomeSummary', () => {
  it('returns an all-empty summary for an empty plan', () => {
    const summary = buildHomeSummary(buildPlanView([], null));
    expect(summary.latestSemester).toBeNull();
    expect(summary.semesterCount).toBe(0);
    expect(summary.totalSubjects).toBe(0);
    expect(summary.completedCount).toBe(0);
    expect(summary.incompleteCount).toBe(0);
    expect(summary.invalidCount).toBe(0);
    expect(summary.passedCount).toBe(0);
    expect(summary.passedCredits).toBe(0);
    expect(summary.plannedCredits).toBe(0);
    expect(summary.cumulative.average).toBeNull();
  });

  it('counts completed / incomplete / passed subjects and their credits once each', () => {
    const view = buildPlanView(
      [
        // Newest semester: one passed and one incomplete.
        entry({
          id: 'e1',
          semesterId: 'sem-2025',
          subjectId: 'cs102',
          projectMark: 80,
          examMark: 90,
          creditHours: 3,
        }),
        entry({ id: 'e2', semesterId: 'sem-2025', subjectId: 'cs101', creditHours: 3 }),
        // Older semester: one failing (complete) and one passing.
        entry({
          id: 'e3',
          semesterId: 'sem-2024',
          subjectId: 'cs101',
          projectMark: 40,
          examMark: 40,
          creditHours: 3,
        }),
        entry({
          id: 'e4',
          semesterId: 'sem-2024',
          subjectId: 'cs200',
          projectMark: 70,
          examMark: 70,
          creditHours: 4,
        }),
      ],
      catalog(
        [subject({ id: 'cs101' }), subject({ id: 'cs102' }), subject({ id: 'cs200' })],
        semesters,
      ),
    );

    const summary = buildHomeSummary(view);
    expect(summary.totalSubjects).toBe(4);
    expect(summary.semesterCount).toBe(2);
    expect(summary.completedCount).toBe(3);
    expect(summary.incompleteCount).toBe(1);
    expect(summary.invalidCount).toBe(0);
    // cs102 (87.5) and cs200 (70) pass; the 40 is complete but failing.
    expect(summary.passedCount).toBe(2);
    expect(summary.passedCredits).toBe(7);
    expect(summary.plannedCredits).toBe(13);

    // The newest planned semester is sem-2025, and is exposed as such.
    expect(summary.latestSemester).toMatchObject({
      semesterId: 'sem-2025',
      semesterName: '2025',
      subjectCount: 2,
    });
    expect(summary.latestSemester?.average.completedCount).toBe(1);
  });

  it('counts a subject with invalid stored weights as invalid, not completed/incomplete', () => {
    const view = buildPlanView(
      [
        entry({
          id: 'bad',
          semesterId: 'sem-2025',
          subjectId: 'cs101',
          projectMark: 80,
          examMark: 90,
          projectWeight: 30,
          examWeight: 60,
        }),
      ],
      catalog([subject({ id: 'cs101' })], semesters),
    );
    const summary = buildHomeSummary(view);
    expect(summary.invalidCount).toBe(1);
    expect(summary.completedCount).toBe(0);
    expect(summary.incompleteCount).toBe(0);
    expect(summary.passedCount).toBe(0);
    expect(summary.cumulative.average).toBeNull();
  });

  it('never emits NaN or Infinity for degenerate credit snapshots', () => {
    const view = buildPlanView(
      [
        entry({
          id: 'nan',
          semesterId: 'sem-2025',
          subjectId: 'cs101',
          projectMark: 80,
          examMark: 90,
          creditHours: Number.NaN,
        }),
        entry({
          id: 'negative',
          semesterId: 'sem-2025',
          subjectId: 'cs102',
          projectMark: 80,
          examMark: 90,
          creditHours: -3,
        }),
      ],
      catalog([subject({ id: 'cs101' }), subject({ id: 'cs102' })], semesters),
    );
    const summary = buildHomeSummary(view);
    for (const value of [
      summary.plannedCredits,
      summary.passedCredits,
      summary.completedCount,
      summary.totalSubjects,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(summary.plannedCredits).toBe(0);
    expect(summary.passedCredits).toBe(0);
  });
});
