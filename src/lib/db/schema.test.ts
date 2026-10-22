import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  CATALOG_TABLES,
  PERSONAL_TABLES,
  STUDY_PLAN_ENTRIES_DDL,
  STUDY_PLAN_ENTRIES_INDEX_DDL,
  STUDY_PLAN_ENTRIES_TABLE,
} from './schema';

describe('schema fragments', () => {
  it('enforces one entry per (account, semester, subject) and scopes by user', () => {
    expect(STUDY_PLAN_ENTRIES_DDL).toContain('user_id TEXT NOT NULL');
    expect(STUDY_PLAN_ENTRIES_DDL).toContain(
      'UNIQUE (user_id, semester_id, subject_id)',
    );
    expect(STUDY_PLAN_ENTRIES_DDL).not.toMatch(/project_mark\s+REAL NOT NULL/);
    expect(STUDY_PLAN_ENTRIES_DDL).not.toMatch(/exam_mark\s+REAL NOT NULL/);
    expect(STUDY_PLAN_ENTRIES_INDEX_DDL).toContain(`${STUDY_PLAN_ENTRIES_TABLE}(user_id)`);
  });

  it('keeps the shared catalog cache disjoint from the private tables', () => {
    const catalog = new Set<string>(CATALOG_TABLES);
    const personal = new Set<string>(PERSONAL_TABLES);
    expect([...personal].filter((table) => catalog.has(table))).toEqual([]);
    expect(personal.has(STUDY_PLAN_ENTRIES_TABLE)).toBe(true);
    expect(personal.has('course_selections')).toBe(true);
    expect(catalog.has(STUDY_PLAN_ENTRIES_TABLE)).toBe(false);
  });

  it('runs against a real SQLite database', () => {
    const raw = new DatabaseSync(':memory:');
    expect(() => {
      raw.exec(STUDY_PLAN_ENTRIES_DDL);
      raw.exec(STUDY_PLAN_ENTRIES_INDEX_DDL);
      // Both statements are idempotent (the migration may re-run).
      raw.exec(STUDY_PLAN_ENTRIES_DDL);
      raw.exec(STUDY_PLAN_ENTRIES_INDEX_DDL);
    }).not.toThrow();
    raw.close();
  });
});
