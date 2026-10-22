import { describe, expect, it } from 'vitest';
import {
  formatGpa,
  formatPercentage,
  GRADE_SCALE,
  isPassing,
  PASS_THRESHOLD,
  percentageToGrade,
} from './grade-scale';

describe('grade scale', () => {
  it('contains exactly the supplied bands and GPAs', () => {
    expect(GRADE_SCALE.map((band) => [band.min, band.letter, band.gpa])).toEqual([
      [98, 'A+', 4],
      [95, 'A', 3.75],
      [90, 'A-', 3.5],
      [85, 'B+', 3.25],
      [80, 'B', 3],
      [75, 'B-', 2.75],
      [70, 'C+', 2.5],
      [65, 'C', 2.25],
      [60, 'C-', 2],
      [55, 'D+', 1.75],
      [50, 'D', 1.5],
      [0, 'E/F', 0],
    ]);
  });

  it.each([
    [100, 'A+', 4],
    [98, 'A+', 4],
    [97.99, 'A', 3.75],
    [95, 'A', 3.75],
    [94.99, 'A-', 3.5],
    [90, 'A-', 3.5],
    [89.99, 'B+', 3.25],
    [85, 'B+', 3.25],
    [84.99, 'B', 3],
    [80, 'B', 3],
    [79.99, 'B-', 2.75],
    [75, 'B-', 2.75],
    [74.99, 'C+', 2.5],
    [70, 'C+', 2.5],
    [69.99, 'C', 2.25],
    [65, 'C', 2.25],
    [64.99, 'C-', 2],
    [60, 'C-', 2],
    [59.99, 'D+', 1.75],
    [55, 'D+', 1.75],
    [54.99, 'D', 1.5],
    [50, 'D', 1.5],
    [49.99, 'E/F', 0],
    [0, 'E/F', 0],
  ])('maps %s to %s (%s)', (percentage, letter, gpa) => {
    expect(percentageToGrade(percentage)).toEqual({ letter, gpa });
  });

  it('returns null for missing or out-of-range marks', () => {
    expect(percentageToGrade(null)).toBeNull();
    expect(percentageToGrade(undefined)).toBeNull();
    expect(percentageToGrade(Number.NaN)).toBeNull();
    expect(percentageToGrade(Number.POSITIVE_INFINITY)).toBeNull();
    expect(percentageToGrade(-0.01)).toBeNull();
    expect(percentageToGrade(100.01)).toBeNull();
  });

  it('uses the documented pass threshold', () => {
    expect(PASS_THRESHOLD).toBe(60);
    expect(isPassing(60)).toBe(true);
    expect(isPassing(59.99)).toBe(false);
    expect(isPassing(null)).toBe(false);
    expect(isPassing(undefined)).toBe(false);
    expect(isPassing(Number.NaN)).toBe(false);
  });

  it('formats values for display without inventing data', () => {
    expect(formatPercentage(87.5)).toBe('87.50%');
    expect(formatPercentage(null)).toBe('—');
    expect(formatPercentage(Number.NaN)).toBe('—');
    expect(formatGpa(3.3333)).toBe('3.33');
    expect(formatGpa(null)).toBe('—');
  });
});
