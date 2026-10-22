import { describe, expect, it } from 'vitest';
import {
  computeWeightedAverage,
  summarizeAverage,
  summarizeCumulativeAverage,
  summarizeSemesterAverage,
  toCompletedGrade,
  type CompletedGrade,
  type GradeInput,
} from './averages';

function input(overrides: Partial<GradeInput> = {}): GradeInput {
  return {
    projectMark: 80,
    examMark: 90,
    projectWeight: 25,
    examWeight: 75,
    creditHours: 3,
    ...overrides,
  };
}

function completed(overrides: Partial<CompletedGrade> = {}): CompletedGrade {
  return { finalMark: 90, creditHours: 3, gpa: 3.5, ...overrides };
}

describe('completed grade eligibility', () => {
  it('converts a complete entry with usable credits', () => {
    expect(toCompletedGrade(input())).toEqual({ finalMark: 87.5, creditHours: 3, gpa: 3.25 });
  });

  it('excludes incomplete entries', () => {
    expect(toCompletedGrade(input({ projectMark: null }))).toBeNull();
    expect(toCompletedGrade(input({ examMark: null }))).toBeNull();
  });

  it('excludes invalid weights and unusable credit hours', () => {
    expect(toCompletedGrade(input({ projectWeight: 30, examWeight: 60 }))).toBeNull();
    expect(toCompletedGrade(input({ creditHours: 0 }))).toBeNull();
    expect(toCompletedGrade(input({ creditHours: -1 }))).toBeNull();
    expect(toCompletedGrade(input({ creditHours: Number.NaN }))).toBeNull();
  });
});

describe('credit-weighted averages', () => {
  it('weights each completed subject by its credit hours', () => {
    const average = computeWeightedAverage([
      completed({ finalMark: 90, creditHours: 3, gpa: 3.5 }),
      completed({ finalMark: 80, creditHours: 2, gpa: 3 }),
    ]);
    expect(average).toEqual({
      percentage: 86,
      gpa: 3.3,
      completedCount: 2,
      totalCredits: 5,
    });
  });

  it('returns null instead of a fabricated zero when nothing is eligible', () => {
    expect(computeWeightedAverage([])).toBeNull();
    expect(summarizeAverage([input({ projectMark: null })]).average).toBeNull();
  });

  it('keeps a genuine zero result (complete zero marks)', () => {
    const summary = summarizeAverage([
      input({ projectMark: 0, examMark: 0, creditHours: 3 }),
    ]);
    expect(summary.average).toEqual({
      percentage: 0,
      gpa: 0,
      completedCount: 1,
      totalCredits: 3,
    });
  });
});

describe('average summaries', () => {
  it('excludes incomplete and invalid entries from both numerator and denominator', () => {
    const summary = summarizeAverage([
      input({ projectMark: 90, examMark: 90, creditHours: 4 }), // 90, 4 credits
      input({ projectMark: null, examMark: 95, creditHours: 3 }), // incomplete
      input({ projectWeight: 40, examWeight: 50, creditHours: 2 }), // invalid weights
      input({ projectMark: 70, examMark: 70, creditHours: 1 }), // 70, 1 credit
    ]);
    expect(summary.totalCount).toBe(4);
    expect(summary.completedCount).toBe(2);
    expect(summary.incompleteCount).toBe(2);
    expect(summary.average).toEqual({
      percentage: 86,
      gpa: 3.3,
      completedCount: 2,
      totalCredits: 5,
    });
  });

  it('semester and cumulative wrappers share the same math', () => {
    const inputs = [input({ creditHours: 3 }), input({ projectMark: null })];
    expect(summarizeSemesterAverage(inputs)).toEqual(summarizeAverage(inputs));
    expect(summarizeCumulativeAverage(inputs)).toEqual(summarizeAverage(inputs));
  });

  it('counts repeated subjects in different semesters as distinct entries', () => {
    const summary = summarizeCumulativeAverage([
      input({ projectMark: 90, examMark: 90, creditHours: 2 }),
      input({ projectMark: 80, examMark: 80, creditHours: 2 }),
    ]);
    expect(summary.average?.completedCount).toBe(2);
    expect(summary.average?.totalCredits).toBe(4);
    expect(summary.average?.percentage).toBe(85);
  });
});
