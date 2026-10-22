/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { ImportPlan } from '../backup/backup';
import { STUDY_PLAN_ENTRIES_DDL, STUDY_PLAN_ENTRIES_INDEX_DDL } from './schema';
import {
  addPlanEntry,
  adoptLegacySelections,
  applyImport,
  createLocalId,
  findPlanEntry,
  getPlanEntry,
  listPlanEntries,
  PlanValidationError,
  removePlanEntry,
  setPlanEntryMarks,
  setPlanEntrySection,
  setPlanEntryWeights,
  toGradeInput,
  type PlanDb,
} from './plan-store';

const CREATE_SUBJECTS = `
  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    program_id TEXT,
    code TEXT,
    name_en TEXT,
    name_ar TEXT,
    credit_hours INTEGER NOT NULL,
    project_weight INTEGER NOT NULL,
    exam_weight INTEGER NOT NULL,
    prerequisite_ids TEXT
  );
`;

const CREATE_LEGACY = `
  CREATE TABLE IF NOT EXISTS course_selections (
    semester_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    selected_at TEXT NOT NULL,
    PRIMARY KEY (semester_id, subject_id)
  );
`;

function createAdapter(raw: DatabaseSync): PlanDb {
  return {
    async runAsync(sql, ...params) {
      const result = raw.prepare(sql).run(...params);
      return { changes: Number(result.changes) };
    },
    async getAllAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return raw.prepare(sql).all(...params) as unknown as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]) {
      const row = raw.prepare(sql).get(...params);
      return (row ?? null) as unknown as T | null;
    },
    async execAsync(sql) {
      raw.exec(sql);
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        try {
          raw.exec('ROLLBACK');
        } catch {
          // The transaction may already have been rolled back by SQLite.
        }
        throw error;
      }
    },
  };
}

function setup(raw: DatabaseSync): PlanDb {
  raw.exec(STUDY_PLAN_ENTRIES_DDL);
  raw.exec(STUDY_PLAN_ENTRIES_INDEX_DDL);
  raw.exec(CREATE_SUBJECTS);
  raw.exec(CREATE_LEGACY);
  return createAdapter(raw);
}

function addCatalogSubject(
  raw: DatabaseSync,
  subject: {
    id: string;
    creditHours: number;
    projectWeight: number;
    examWeight: number;
  },
): void {
  raw
    .prepare(
      `INSERT OR REPLACE INTO subjects
         (id, program_id, code, name_en, name_ar, credit_hours, project_weight, exam_weight, prerequisite_ids)
       VALUES (?, 'p1', ?, ?, ?, ?, ?, ?, '[]')`,
    )
    .run(
      subject.id,
      subject.id.toUpperCase(),
      subject.id,
      subject.id,
      subject.creditHours,
      subject.projectWeight,
      subject.examWeight,
    );
}

function addLegacy(
  raw: DatabaseSync,
  semesterId: string,
  subjectId: string,
  selectedAt = '2025-09-01T00:00:00.000Z',
): void {
  raw
    .prepare('INSERT INTO course_selections (semester_id, subject_id, selected_at) VALUES (?, ?, ?)')
    .run(semesterId, subjectId, selectedAt);
}

let temporaryDirectory: string | null = null;

afterEach(() => {
  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = null;
  }
});

describe('plan entries', () => {
  it('adds one entry per (account, semester, subject)', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);

    const first = await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });
    expect(first.created).toBe(true);
    expect(first.entry.projectMark).toBeNull();
    expect(first.entry.examMark).toBeNull();

    const duplicate = await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });
    expect(duplicate.created).toBe(false);
    expect(duplicate.entry.id).toBe(first.entry.id);

    const otherSemester = await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-2',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });
    expect(otherSemester.created).toBe(true);

    const otherUser = await addPlanEntry(db, {
      userId: 'user-b',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });
    expect(otherUser.created).toBe(true);
    expect(otherUser.entry.userId).toBe('user-b');

    const entries = await listPlanEntries(db, 'user-a');
    expect(entries).toHaveLength(2);
    expect(await listPlanEntries(db, 'user-b')).toHaveLength(1);
    raw.close();
  });

  it('validates weights and credits before writing', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);

    await expect(
      addPlanEntry(db, {
        userId: 'user-a',
        semesterId: 'sem-1',
        subjectId: 'sub-1',
        creditHours: 3,
        projectWeight: 30,
        examWeight: 60,
      }),
    ).rejects.toBeInstanceOf(PlanValidationError);

    await expect(
      addPlanEntry(db, {
        userId: 'user-a',
        semesterId: 'sem-1',
        subjectId: 'sub-1',
        creditHours: -1,
        projectWeight: 25,
        examWeight: 75,
      }),
    ).rejects.toBeInstanceOf(PlanValidationError);

    expect(await listPlanEntries(db, 'user-a')).toHaveLength(0);
    raw.close();
  });

  it('keeps marks and snapshots independent of section changes', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    const { entry } = await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });

    await setPlanEntryMarks(db, 'user-a', entry.id, { projectMark: 0, examMark: 90.5 });
    await setPlanEntrySection(db, 'user-a', entry.id, 'sec-1');

    const updated = await getPlanEntry(db, 'user-a', entry.id);
    expect(updated?.sectionId).toBe('sec-1');
    expect(updated?.projectMark).toBe(0);
    expect(updated?.examMark).toBe(90.5);
    expect(updated?.projectWeight).toBe(25);
    expect(updated?.examWeight).toBe(75);
    expect(await setPlanEntrySection(db, 'user-a', entry.id, null)).toBe(true);
    expect((await getPlanEntry(db, 'user-a', entry.id))?.sectionId).toBeNull();
    raw.close();
  });

  it('rejects invalid marks without overwriting the previous value', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    const { entry } = await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });
    await setPlanEntryMarks(db, 'user-a', entry.id, { projectMark: 60, examMark: 70 });

    await expect(
      setPlanEntryMarks(db, 'user-a', entry.id, { projectMark: 101, examMark: 70 }),
    ).rejects.toBeInstanceOf(PlanValidationError);
    await expect(
      setPlanEntryMarks(db, 'user-a', entry.id, { projectMark: 60, examMark: -0.5 }),
    ).rejects.toBeInstanceOf(PlanValidationError);

    const stored = await findPlanEntry(db, 'user-a', 'sem-1', 'sub-1');
    expect(stored?.projectMark).toBe(60);
    expect(stored?.examMark).toBe(70);
    raw.close();
  });

  it('updates only the weight snapshot, never the marks', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    const { entry } = await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });
    await setPlanEntryMarks(db, 'user-a', entry.id, { projectMark: 88, examMark: 92 });

    expect(
      await setPlanEntryWeights(db, 'user-a', entry.id, { projectWeight: 40, examWeight: 60 }),
    ).toBe(true);
    const updated = await getPlanEntry(db, 'user-a', entry.id);
    expect(updated?.projectWeight).toBe(40);
    expect(updated?.examWeight).toBe(60);
    expect(updated?.projectMark).toBe(88);
    expect(updated?.examMark).toBe(92);

    await expect(
      setPlanEntryWeights(db, 'user-a', entry.id, { projectWeight: 40, examWeight: 50 }),
    ).rejects.toBeInstanceOf(PlanValidationError);
    raw.close();
  });

  it('never reads or writes another account’s entry', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    const { entry } = await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });

    expect(await getPlanEntry(db, 'user-b', entry.id)).toBeNull();
    expect(await findPlanEntry(db, 'user-b', 'sem-1', 'sub-1')).toBeNull();
    expect(await setPlanEntryMarks(db, 'user-b', entry.id, { projectMark: 0, examMark: 0 })).toBe(
      false,
    );
    expect(await setPlanEntrySection(db, 'user-b', entry.id, 'sec-x')).toBe(false);
    expect(await setPlanEntryWeights(db, 'user-b', entry.id, { projectWeight: 50, examWeight: 50 })).toBe(
      false,
    );
    expect(await removePlanEntry(db, 'user-b', entry.id)).toBe(false);

    const stored = await getPlanEntry(db, 'user-a', entry.id);
    expect(stored?.sectionId).toBeNull();
    expect(stored?.projectMark).toBeNull();
    raw.close();
  });

  it('can remove an entry only once', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    const { entry } = await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });
    expect(await removePlanEntry(db, 'user-a', entry.id)).toBe(true);
    expect(await removePlanEntry(db, 'user-a', entry.id)).toBe(false);
    expect(await listPlanEntries(db, 'user-a')).toHaveLength(0);
    raw.close();
  });

  it('maps an entry to the grading input', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    const { entry } = await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 4,
      projectWeight: 30,
      examWeight: 70,
    });
    await setPlanEntryMarks(db, 'user-a', entry.id, { projectMark: 75, examMark: 85 });
    const stored = await getPlanEntry(db, 'user-a', entry.id);
    expect(stored && toGradeInput(stored)).toEqual({
      projectMark: 75,
      examMark: 85,
      projectWeight: 30,
      examWeight: 70,
      creditHours: 4,
    });
    raw.close();
  });
});

describe('legacy selection adoption', () => {
  it('adopts legacy rows once, snapshots catalog weights/credits and clears the legacy table', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    addCatalogSubject(raw, { id: 'sub-1', creditHours: 4, projectWeight: 30, examWeight: 70 });
    addLegacy(raw, 'sem-1', 'sub-1', '2025-09-01T00:00:00.000Z');
    addLegacy(raw, 'sem-2', 'sub-missing');

    expect(await adoptLegacySelections(db, 'user-a')).toBe(2);

    const entries = await listPlanEntries(db, 'user-a');
    expect(entries).toHaveLength(2);
    const known = entries.find((entry) => entry.subjectId === 'sub-1');
    expect(known).toMatchObject({
      semesterId: 'sem-1',
      projectWeight: 30,
      examWeight: 70,
      creditHours: 4,
      projectMark: null,
      examMark: null,
      createdAt: '2025-09-01T00:00:00.000Z',
    });
    const missing = entries.find((entry) => entry.subjectId === 'sub-missing');
    expect(missing).toMatchObject({
      projectWeight: 25,
      examWeight: 75,
      creditHours: 0,
    });

    expect(raw.prepare('SELECT COUNT(*) AS count FROM course_selections').get()).toEqual({
      count: 0,
    });
    expect(await adoptLegacySelections(db, 'user-a')).toBe(0);
    expect(await listPlanEntries(db, 'user-a')).toHaveLength(2);
    raw.close();
  });

  it('does not duplicate an entry that already exists in the account plan', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });
    addLegacy(raw, 'sem-1', 'sub-1');
    addLegacy(raw, 'sem-1', 'sub-2');

    expect(await adoptLegacySelections(db, 'user-a')).toBe(1);
    expect(await listPlanEntries(db, 'user-a')).toHaveLength(2);
    raw.close();
  });
});

describe('import application', () => {
  const plan: ImportPlan = {
    mode: 'replace',
    skipped: 0,
    replacedCount: 1,
    entries: [
      {
        id: 'imported-1',
        semesterId: 'sem-9',
        subjectId: 'sub-9',
        sectionId: 'sec-9',
        projectMark: 70,
        examMark: 80,
        projectWeight: 25,
        examWeight: 75,
        creditHours: 3,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
  };

  it('replaces only the current account plan', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });
    await addPlanEntry(db, {
      userId: 'user-b',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });

    const result = await applyImport(db, 'user-a', plan);
    expect(result).toEqual({ imported: 1, skipped: 0, replacedCount: 1 });

    const userA = await listPlanEntries(db, 'user-a');
    expect(userA).toHaveLength(1);
    expect(userA[0]).toMatchObject({
      id: 'imported-1',
      semesterId: 'sem-9',
      subjectId: 'sub-9',
      sectionId: 'sec-9',
      projectMark: 70,
      examMark: 80,
      creditHours: 3,
    });
    expect(await listPlanEntries(db, 'user-b')).toHaveLength(1);
    raw.close();
  });

  it('merges missing entries and keeps existing ones', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = setup(raw);
    await addPlanEntry(db, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });

    const mergePlan: ImportPlan = {
      mode: 'merge',
      skipped: 1,
      replacedCount: 0,
      entries: [
        plan.entries[0],
        {
          semesterId: 'sem-1',
          subjectId: 'sub-1',
          sectionId: null,
          projectMark: 100,
          examMark: 100,
          projectWeight: 25,
          examWeight: 75,
          creditHours: 3,
        },
      ],
    };
    const result = await applyImport(db, 'user-a', mergePlan);
    expect(result).toEqual({ imported: 1, skipped: 1, replacedCount: 0 });
    const entries = await listPlanEntries(db, 'user-a');
    expect(entries).toHaveLength(2);
    // The existing entry is untouched.
    expect(entries.find((entry) => entry.semesterId === 'sem-1')?.projectMark).toBeNull();
    raw.close();
  });

  it('rolls the whole import back when any write fails', async () => {
    const raw = new DatabaseSync(':memory:');
    const base = setup(raw);
    await addPlanEntry(base, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-old',
      creditHours: 3,
      projectWeight: 25,
      examWeight: 75,
    });

    let inserts = 0;
    const flaky: PlanDb = {
      ...base,
      async runAsync(sql, ...params) {
        if (sql.trimStart().startsWith('INSERT') && ++inserts === 2) {
          throw new Error('simulated write failure');
        }
        return base.runAsync(sql, ...params);
      },
    };

    await expect(
      applyImport(flaky, 'user-a', {
        mode: 'replace',
        skipped: 0,
        replacedCount: 1,
        entries: [
          plan.entries[0],
          plan.entries[0],
        ],
      }),
    ).rejects.toThrow('simulated write failure');

    const entries = await listPlanEntries(base, 'user-a');
    expect(entries).toHaveLength(1);
    expect(entries[0].subjectId).toBe('sub-old');
    raw.close();
  });
});

describe('local persistence', () => {
  it('keeps the plan in the SQLite file across reopens', async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'studygo-plan-'));
    const path = join(temporaryDirectory, 'studygo.db');

    const firstRaw = new DatabaseSync(path);
    const first = setup(firstRaw);
    const { entry } = await addPlanEntry(first, {
      userId: 'user-a',
      semesterId: 'sem-1',
      subjectId: 'sub-1',
      creditHours: 4,
      projectWeight: 25,
      examWeight: 75,
    });
    await setPlanEntryMarks(first, 'user-a', entry.id, { projectMark: 77, examMark: 88 });
    firstRaw.close();

    const secondRaw = new DatabaseSync(path);
    const second = setup(secondRaw);
    const entries = await listPlanEntries(second, 'user-a');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: entry.id,
      projectMark: 77,
      examMark: 88,
      creditHours: 4,
    });
    secondRaw.close();
  });

  it('creates unique local ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createLocalId()));
    expect(ids.size).toBe(200);
  });
});
