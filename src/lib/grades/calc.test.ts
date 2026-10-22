import { describe, expect, it } from 'vitest';
import {
  computeFinalMark,
  incompleteDescription,
  INVALID_WEIGHTS_MESSAGE,
  describeFinalMark,
  isValidMarkValue,
  isValidWeights,
  parseMarkInput,
} from './calc';

describe('mark parsing', () => {
  it('treats an empty field as missing, not zero', () => {
    expect(parseMarkInput('')).toEqual({ ok: true, value: null });
    expect(parseMarkInput('   ')).toEqual({ ok: true, value: null });
  });

  it('keeps a real zero', () => {
    expect(parseMarkInput('0')).toEqual({ ok: true, value: 0 });
  });

  it('accepts integers and decimals', () => {
    expect(parseMarkInput('59.5')).toEqual({ ok: true, value: 59.5 });
    expect(parseMarkInput(' 100 ')).toEqual({ ok: true, value: 100 });
    expect(parseMarkInput('05')).toEqual({ ok: true, value: 5 });
  });

  it('accepts Arabic-Indic digits and the Arabic decimal separator', () => {
    expect(parseMarkInput('١٢٣')).toEqual({ ok: false, error: expect.any(String) });
    expect(parseMarkInput('٩٨')).toEqual({ ok: true, value: 98 });
    expect(parseMarkInput('٨٧٫٥')).toEqual({ ok: true, value: 87.5 });
  });

  it('rejects non-numeric and out-of-range input', () => {
    expect(parseMarkInput('abc').ok).toBe(false);
    expect(parseMarkInput('-1').ok).toBe(false);
    expect(parseMarkInput('100.1').ok).toBe(false);
    expect(parseMarkInput('1.2.3').ok).toBe(false);
    expect(parseMarkInput('١٠٠').ok).toBe(true);
  });
});

describe('mark values and weights', () => {
  it('validates the supported mark range', () => {
    expect(isValidMarkValue(0)).toBe(true);
    expect(isValidMarkValue(100)).toBe(true);
    expect(isValidMarkValue(100.01)).toBe(false);
    expect(isValidMarkValue(-0.01)).toBe(false);
    expect(isValidMarkValue(Number.NaN)).toBe(false);
    expect(isValidMarkValue('50')).toBe(false);
  });

  it('requires two finite 0–100 weights that add up to 100', () => {
    expect(isValidWeights(25, 75)).toBe(true);
    expect(isValidWeights(0, 100)).toBe(true);
    expect(isValidWeights(33.33, 66.67)).toBe(true);
    expect(isValidWeights(30, 60)).toBe(false);
    expect(isValidWeights(-1, 101)).toBe(false);
    expect(isValidWeights(101, -1)).toBe(false);
    expect(isValidWeights(Number.NaN, 100)).toBe(false);
  });
});

describe('final mark', () => {
  it('computes the weighted result from snapshot weights', () => {
    const result = computeFinalMark({
      projectMark: 80,
      examMark: 90,
      projectWeight: 25,
      examWeight: 75,
    });
    expect(result).toEqual({ status: 'complete', finalMark: 87.5, missing: [] });
  });

  it('reports each missing component instead of substituting zero', () => {
    expect(
      computeFinalMark({ projectMark: null, examMark: 90, projectWeight: 25, examWeight: 75 }),
    ).toEqual({ status: 'incomplete', finalMark: null, missing: ['project'] });
    expect(
      computeFinalMark({ projectMark: 80, examMark: null, projectWeight: 25, examWeight: 75 }),
    ).toEqual({ status: 'incomplete', finalMark: null, missing: ['exam'] });
    expect(
      computeFinalMark({ projectMark: null, examMark: null, projectWeight: 25, examWeight: 75 }),
    ).toEqual({ status: 'incomplete', finalMark: null, missing: ['project', 'exam'] });
  });

  it('treats a stored zero as a real mark', () => {
    expect(
      computeFinalMark({ projectMark: 0, examMark: 100, projectWeight: 25, examWeight: 75 }),
    ).toEqual({ status: 'complete', finalMark: 75, missing: [] });
  });

  it('refuses to compute with invalid weights', () => {
    const result = computeFinalMark({
      projectMark: 80,
      examMark: 90,
      projectWeight: 30,
      examWeight: 60,
    });
    expect(result).toEqual({
      status: 'invalid-weights',
      finalMark: null,
      missing: [],
      error: INVALID_WEIGHTS_MESSAGE,
    });
  });

  it('describes each state in Arabic', () => {
    expect(describeFinalMark({ status: 'complete', finalMark: 87.5, missing: [] })).toBe('87.50%');
    expect(describeFinalMark({ status: 'incomplete', finalMark: null, missing: ['project'] })).toBe(
      'غير مكتمل',
    );
    expect(
      describeFinalMark({
        status: 'invalid-weights',
        finalMark: null,
        missing: [],
        error: INVALID_WEIGHTS_MESSAGE,
      }),
    ).toBe('أوزان غير صالحة');
    expect(incompleteDescription(['project', 'exam'])).toBe(
      'ناقص: علامة المشروع و علامة الامتحان',
    );
  });
});
