import { describe, expect, it } from 'vitest';
import {
  collectPassedSubjectIds,
  describePrerequisiteWarnings,
  evaluatePrerequisites,
  type PassedCheckInput,
} from './prerequisites';

function entry(overrides: Partial<PassedCheckInput> = {}): PassedCheckInput {
  return {
    subjectId: 'cs101',
    projectMark: 80,
    examMark: 80,
    projectWeight: 25,
    examWeight: 75,
    creditHours: 3,
    ...overrides,
  };
}

describe('collectPassedSubjectIds', () => {
  it('marks completed subjects at or above the pass threshold', () => {
    const passed = collectPassedSubjectIds([
      entry({ subjectId: 'exact', projectMark: 60, examMark: 60 }),
      entry({ subjectId: 'below', projectMark: 59, examMark: 59 }),
    ]);
    expect(passed.has('exact')).toBe(true);
    expect(passed.has('below')).toBe(false);
  });

  it('never treats an incomplete subject as passed', () => {
    const passed = collectPassedSubjectIds([entry({ projectMark: null })]);
    expect(passed.size).toBe(0);
  });

  it('passes a subject planned twice when either completed entry passes', () => {
    const passed = collectPassedSubjectIds([
      entry({ subjectId: 'math', projectMark: 40, examMark: 40 }),
      entry({ subjectId: 'math', projectMark: 90, examMark: 90 }),
    ]);
    expect(passed.has('math')).toBe(true);
  });
});

describe('evaluatePrerequisites', () => {
  const labels: Record<string, { code: string; nameAr: string }> = {
    cs101: { code: 'CS101', nameAr: 'مقدمة في البرمجة' },
  };
  const resolve = (id: string) => {
    const info = labels[id];
    return info ? { id, ...info } : undefined;
  };

  it('returns no warning for a passed prerequisite', () => {
    expect(
      evaluatePrerequisites(['cs101'], {
        passedSubjectIds: new Set(['cs101']),
        plannedSubjectIds: new Set(),
        resolve,
      }),
    ).toEqual([]);
  });

  it('distinguishes unplanned from planned-but-not-passed prerequisites', () => {
    expect(
      evaluatePrerequisites(['cs101', 'math2'], {
        passedSubjectIds: new Set(),
        plannedSubjectIds: new Set(['math2']),
        resolve,
      }),
    ).toEqual([
      {
        prerequisiteId: 'cs101',
        label: 'CS101 — مقدمة في البرمجة',
        reason: 'not-planned',
      },
      {
        prerequisiteId: 'math2',
        label: 'المقرر math2',
        reason: 'not-passed',
      },
    ]);
  });

  it('shows one warning per unmet prerequisite and never blocks', () => {
    const warnings = evaluatePrerequisites(['a', 'b'], {
      passedSubjectIds: new Set(['b']),
      resolve,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe('not-planned');
  });

  it('describes the warnings in Arabic', () => {
    expect(
      describePrerequisiteWarnings([
        { prerequisiteId: 'cs101', label: 'CS101', reason: 'not-planned' },
        { prerequisiteId: 'math2', label: 'MATH2', reason: 'not-passed' },
      ]),
    ).toBe('تحذير: لم تُستوفَ المتطلبات السابقة — CS101 (غير مُخطَّط)، MATH2 (مُخطَّط لكن لم يُجتَز).');
    expect(describePrerequisiteWarnings([])).toBe('');
  });
});
