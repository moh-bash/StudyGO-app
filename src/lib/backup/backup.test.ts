import { describe, expect, it } from 'vitest';
import type { PlanEntry } from '../db/plan-types';
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  buildBackup,
  parseBackup,
  planImport,
  serializeBackup,
} from './backup';

function entry(overrides: Partial<PlanEntry> = {}): PlanEntry {
  return {
    id: 'local-1',
    userId: 'user-secret',
    semesterId: 'sem-1',
    subjectId: 'sub-1',
    sectionId: null,
    projectMark: 80,
    examMark: 90,
    projectWeight: 25,
    examWeight: 75,
    creditHours: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function validDocument(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    exportedAt: '2026-10-19T00:00:00.000Z',
    entries: [
      {
        semesterId: 'sem-1',
        subjectId: 'sub-1',
        sectionId: null,
        projectMark: 80,
        examMark: 90,
        projectWeight: 25,
        examWeight: 75,
        creditHours: 3,
      },
    ],
    ...overrides,
  });
}

describe('backup serialization', () => {
  it('builds a versioned document without account identity or credentials', () => {
    const backup = buildBackup([entry()], '2026-10-19T00:00:00.000Z');
    expect(backup.format).toBe('studygo-backup');
    expect(backup.version).toBe(1);
    expect(backup.app).toBe('study-go-app');
    expect(backup.exportedAt).toBe('2026-10-19T00:00:00.000Z');
    expect(backup.entries).toHaveLength(1);
    expect(backup.entries[0]).not.toHaveProperty('userId');
    expect(backup.entries[0]).not.toHaveProperty('email');
    expect(backup.entries[0]).not.toHaveProperty('password');
    expect(backup.entries[0]).not.toHaveProperty('accessToken');
    expect(backup.entries[0]).not.toHaveProperty('refreshToken');
  });

  it('serializes to JSON and round-trips through the validator', () => {
    const text = serializeBackup([entry()], '2026-10-19T00:00:00.000Z');
    expect(text).not.toContain('user-secret');
    expect(text).not.toContain('password');
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.entries).toEqual([
        {
          id: 'local-1',
          semesterId: 'sem-1',
          subjectId: 'sub-1',
          sectionId: null,
          projectMark: 80,
          examMark: 90,
          projectWeight: 25,
          examWeight: 75,
          creditHours: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ]);
    }
  });

  it('allows an empty backup', () => {
    const parsed = parseBackup(serializeBackup([]));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.entries).toEqual([]);
    }
  });
});

describe('backup validation', () => {
  it('accepts a minimal valid file and normalizes missing optional fields', () => {
    const parsed = parseBackup(validDocument());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.entries[0].id).toBeUndefined();
      expect(parsed.backup.entries[0].createdAt).toBeUndefined();
      expect(parsed.backup.entries[0].sectionId).toBeNull();
    }
  });

  it('rejects malformed JSON and wrong document shapes', () => {
    expect(parseBackup('{')).toMatchObject({ ok: false });
    expect(parseBackup('[]')).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ format: 'other' }))).toMatchObject({ ok: false });
  });

  it('rejects unsupported versions and foreign apps', () => {
    expect(parseBackup(validDocument({ version: 2 }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('غير مدعوم'),
    });
    expect(parseBackup(validDocument({ version: '1' }))).toMatchObject({ ok: false });
    expect(parseBackup(validDocument({ app: 'another-app' }))).toMatchObject({ ok: false });
  });

  it('rejects invalid records before anything is written', () => {
    const invalidEntries: Record<string, unknown>[] = [
      { subjectId: '', projectWeight: 25, examWeight: 75, creditHours: 3 },
      { semesterId: 'sem-1', projectWeight: 25, examWeight: 75, creditHours: 3 },
      { semesterId: 'sem-1', subjectId: 'sub-1', projectWeight: 25, examWeight: 75, creditHours: 3, projectMark: 101 },
      { semesterId: 'sem-1', subjectId: 'sub-1', projectWeight: 30, examWeight: 60, creditHours: 3 },
      { semesterId: 'sem-1', subjectId: 'sub-1', projectWeight: 25, examWeight: 75, creditHours: -1 },
      { semesterId: 'sem-1', subjectId: 'sub-1', projectWeight: 25, examWeight: 75, creditHours: 3, sectionId: 7 },
    ];
    for (const invalidEntry of invalidEntries) {
      const parsed = parseBackup(validDocument({ entries: [invalidEntry] }));
      expect(parsed.ok).toBe(false);
    }
  });

  it('does not accept a missing entries list', () => {
    expect(parseBackup(validDocument({ entries: null }))).toMatchObject({ ok: false });
  });
});

describe('import planning', () => {
  const backup = {
    format: BACKUP_FORMAT as typeof BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: BACKUP_APP as typeof BACKUP_APP,
    exportedAt: '2026-10-19T00:00:00.000Z',
    entries: [
      {
        semesterId: 'sem-1',
        subjectId: 'sub-1',
        sectionId: null,
        projectMark: 10,
        examMark: 10,
        projectWeight: 25,
        examWeight: 75,
        creditHours: 3,
      },
      {
        semesterId: 'sem-2',
        subjectId: 'sub-2',
        sectionId: null,
        projectMark: null,
        examMark: null,
        projectWeight: 25,
        examWeight: 75,
        creditHours: 3,
      },
      {
        semesterId: 'sem-2',
        subjectId: 'sub-2',
        sectionId: 'sec-1',
        projectMark: 50,
        examMark: 50,
        projectWeight: 25,
        examWeight: 75,
        creditHours: 3,
      },
    ],
  };

  it('merge keeps existing entries and skips duplicates in the file', () => {
    const plan = planImport([entry()], backup, 'merge');
    expect(plan.mode).toBe('merge');
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].subjectId).toBe('sub-2');
    expect(plan.skipped).toBe(2);
    expect(plan.replacedCount).toBe(0);
  });

  it('replace plans the current entries for removal and deduplicates the file', () => {
    const plan = planImport([entry(), entry({ id: 'local-2', subjectId: 'old' })], backup, 'replace');
    expect(plan.mode).toBe('replace');
    expect(plan.entries).toHaveLength(2);
    expect(plan.replacedCount).toBe(2);
    expect(plan.skipped).toBe(1);
  });

  it('merge with nothing missing plans an empty write', () => {
    const plan = planImport(
      [entry(), entry({ id: 'local-2', semesterId: 'sem-2', subjectId: 'sub-2' })],
      backup,
      'merge',
    );
    expect(plan.entries).toHaveLength(0);
    expect(plan.skipped).toBe(3);
  });
});
