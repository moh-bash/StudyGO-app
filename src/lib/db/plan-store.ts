/**
 * Local study-plan store (private, per-account).
 *
 * Every function takes the database handle explicitly so the store is fully
 * decoupled from `expo-sqlite` and can be unit-tested against an in-memory
 * SQLite database. Callers in the app pass `await getDatabase()`.
 *
 * Rules enforced here (also tested):
 * - entries are scoped by `user_id`; another account's rows are never readable
 *   or writable through these helpers;
 * - a subject can appear at most once per (account, semester);
 * - changing the section never touches the marks;
 * - marks are validated (0–100 or missing) before they are stored;
 * - legacy `course_selections` rows are adopted into the plan exactly once.
 */
import type { AddPlanEntryInput, PlanEntry, PlanMarks, } from './plan-types';
import type { ImportPlan } from '../backup/backup';
import { isValidMarkValue, isValidWeights, INVALID_WEIGHTS_MESSAGE } from '../grades/calc';
import type { GradeInput } from '../grades/averages';

/** The subset of the `expo-sqlite` database API this store uses. */
export interface PlanDb {
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** Thrown for invalid plan data (invalid mark / weight) before any write. */
export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanValidationError';
  }
}

interface PlanRow {
  id: string;
  user_id: string;
  semester_id: string;
  subject_id: string;
  section_id: string | null;
  project_mark: number | null;
  exam_mark: number | null;
  project_weight: number;
  exam_weight: number;
  credit_hours: number;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS =
  'id, user_id, semester_id, subject_id, section_id, project_mark, exam_mark, project_weight, exam_weight, credit_hours, created_at, updated_at';

function rowToEntry(row: PlanRow): PlanEntry {
  return {
    id: row.id,
    userId: row.user_id,
    semesterId: row.semester_id,
    subjectId: row.subject_id,
    sectionId: row.section_id ?? null,
    projectMark: row.project_mark ?? null,
    examMark: row.exam_mark ?? null,
    projectWeight: row.project_weight,
    examWeight: row.exam_weight,
    creditHours: row.credit_hours,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Stable, unique local identifier for a plan entry. Kept locally: it is never
 * sent to the backend and never used as an academic identifier.
 */
export function createLocalId(): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${time}-${random}`;
}

/** All plan entries of one account, oldest first. */
export async function listPlanEntries(db: PlanDb, userId: string): Promise<PlanEntry[]> {
  const rows = await db.getAllAsync<PlanRow>(
    `SELECT ${SELECT_COLUMNS} FROM study_plan_entries WHERE user_id = ? ORDER BY created_at ASC, subject_id ASC`,
    userId,
  );
  return rows.map(rowToEntry);
}

export async function getPlanEntry(
  db: PlanDb,
  userId: string,
  entryId: string,
): Promise<PlanEntry | null> {
  const row = await db.getFirstAsync<PlanRow>(
    `SELECT ${SELECT_COLUMNS} FROM study_plan_entries WHERE user_id = ? AND id = ?`,
    userId,
    entryId,
  );
  return row ? rowToEntry(row) : null;
}

export async function findPlanEntry(
  db: PlanDb,
  userId: string,
  semesterId: string,
  subjectId: string,
): Promise<PlanEntry | null> {
  const row = await db.getFirstAsync<PlanRow>(
    `SELECT ${SELECT_COLUMNS} FROM study_plan_entries WHERE user_id = ? AND semester_id = ? AND subject_id = ?`,
    userId,
    semesterId,
    subjectId,
  );
  return row ? rowToEntry(row) : null;
}

/**
 * Adds a subject to a semester plan. Adding the same subject to the same
 * semester twice is a no-op that returns the existing entry (`created: false`);
 * the same subject may be added to a different semester.
 */
export async function addPlanEntry(
  db: PlanDb,
  input: AddPlanEntryInput,
): Promise<{ created: boolean; entry: PlanEntry }> {
  if (!isValidWeights(input.projectWeight, input.examWeight)) {
    throw new PlanValidationError(INVALID_WEIGHTS_MESSAGE);
  }
  if (!Number.isFinite(input.creditHours) || input.creditHours < 0) {
    throw new PlanValidationError('عدد الساعات المعتمدة غير صالح.');
  }
  const now = nowIso();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO study_plan_entries
       (id, user_id, semester_id, subject_id, section_id, project_mark, exam_mark, project_weight, exam_weight, credit_hours, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
    createLocalId(),
    input.userId,
    input.semesterId,
    input.subjectId,
    input.projectWeight,
    input.examWeight,
    input.creditHours,
    now,
    now,
  );
  const entry = await findPlanEntry(db, input.userId, input.semesterId, input.subjectId);
  if (!entry) {
    throw new PlanValidationError('تعذّر إضافة المقرر إلى الخطة.');
  }
  return { created: result.changes > 0, entry };
}

export async function removePlanEntry(
  db: PlanDb,
  userId: string,
  entryId: string,
): Promise<boolean> {
  const result = await db.runAsync(
    'DELETE FROM study_plan_entries WHERE user_id = ? AND id = ?',
    userId,
    entryId,
  );
  return result.changes > 0;
}

/** Sets (or clears) the optional section. Marks and weights are untouched. */
export async function setPlanEntrySection(
  db: PlanDb,
  userId: string,
  entryId: string,
  sectionId: string | null,
): Promise<boolean> {
  const result = await db.runAsync(
    'UPDATE study_plan_entries SET section_id = ?, updated_at = ? WHERE user_id = ? AND id = ?',
    sectionId,
    nowIso(),
    userId,
    entryId,
  );
  return result.changes > 0;
}

function assertMark(mark: number | null, label: string): void {
  if (mark !== null && !isValidMarkValue(mark)) {
    throw new PlanValidationError(`${label} يجب أن تكون بين 0 و 100.`);
  }
}

/** Saves the project/exam marks of a plan entry (`null` = missing). */
export async function setPlanEntryMarks(
  db: PlanDb,
  userId: string,
  entryId: string,
  marks: PlanMarks,
): Promise<boolean> {
  assertMark(marks.projectMark, 'علامة المشروع');
  assertMark(marks.examMark, 'علامة الامتحان');
  const result = await db.runAsync(
    'UPDATE study_plan_entries SET project_mark = ?, exam_mark = ?, updated_at = ? WHERE user_id = ? AND id = ?',
    marks.projectMark,
    marks.examMark,
    nowIso(),
    userId,
    entryId,
  );
  return result.changes > 0;
}

/**
 * Deliberately adopts the authoritative catalog weights into the entry's
 * snapshot (used only after the student confirms a recalculation). Marks are
 * never modified.
 */
export async function setPlanEntryWeights(
  db: PlanDb,
  userId: string,
  entryId: string,
  weights: { projectWeight: number; examWeight: number },
): Promise<boolean> {
  if (!isValidWeights(weights.projectWeight, weights.examWeight)) {
    throw new PlanValidationError(INVALID_WEIGHTS_MESSAGE);
  }
  const result = await db.runAsync(
    'UPDATE study_plan_entries SET project_weight = ?, exam_weight = ?, updated_at = ? WHERE user_id = ? AND id = ?',
    weights.projectWeight,
    weights.examWeight,
    nowIso(),
    userId,
    entryId,
  );
  return result.changes > 0;
}

/**
 * One-time adoption of the pre-v3 `course_selections` rows into the plan.
 *
 * The legacy table had no account column (Phase 1 wiped it on logout), so its
 * rows belong to the account that was last signed in on this device; the first
 * authenticated account after the upgrade claims them. Weight/credit snapshots
 * are taken from the cached catalog when the subject is still present, and fall
 * back to the project defaults (25/75, 0 credits) when it is not. The legacy rows
 * are removed in the same transaction so the adoption happens exactly once.
 */
export async function adoptLegacySelections(db: PlanDb, userId: string): Promise<number> {
  const rows = await db.getAllAsync<{
    semester_id: string;
    subject_id: string;
    selected_at: string | null;
    project_weight: number | null;
    exam_weight: number | null;
    credit_hours: number | null;
  }>(
    `SELECT c.semester_id, c.subject_id, c.selected_at,
            s.project_weight, s.exam_weight, s.credit_hours
       FROM course_selections c
       LEFT JOIN subjects s ON s.id = c.subject_id`,
  );
  if (rows.length === 0) {
    return 0;
  }
  let adopted = 0;
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const timestamp = row.selected_at ?? nowIso();
      const result = await db.runAsync(
        `INSERT OR IGNORE INTO study_plan_entries
           (id, user_id, semester_id, subject_id, section_id, project_mark, exam_mark, project_weight, exam_weight, credit_hours, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
        createLocalId(),
        userId,
        row.semester_id,
        row.subject_id,
        row.project_weight ?? 25,
        row.exam_weight ?? 75,
        row.credit_hours ?? 0,
        timestamp,
        timestamp,
      );
      adopted += result.changes;
    }
    await db.runAsync('DELETE FROM course_selections');
  });
  return adopted;
}

export interface ApplyImportResult {
  imported: number;
  skipped: number;
  replacedCount: number;
}

/**
 * Applies a validated import plan in a single transaction: either the account's
 * plan is replaced (`replace`) or only missing entries are added (`merge`). Any
 * failure rolls the whole operation back, leaving the previous plan intact.
 */
export async function applyImport(
  db: PlanDb,
  userId: string,
  plan: ImportPlan,
): Promise<ApplyImportResult> {
  let imported = 0;
  await db.withTransactionAsync(async () => {
    if (plan.mode === 'replace') {
      await db.runAsync('DELETE FROM study_plan_entries WHERE user_id = ?', userId);
    }
    for (const entry of plan.entries) {
      const timestamp = nowIso();
      const result = await db.runAsync(
        `INSERT OR IGNORE INTO study_plan_entries
           (id, user_id, semester_id, subject_id, section_id, project_mark, exam_mark, project_weight, exam_weight, credit_hours, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.id ?? createLocalId(),
        userId,
        entry.semesterId,
        entry.subjectId,
        entry.sectionId,
        entry.projectMark,
        entry.examMark,
        entry.projectWeight,
        entry.examWeight,
        entry.creditHours,
        entry.createdAt ?? timestamp,
        entry.updatedAt ?? timestamp,
      );
      imported += result.changes;
    }
  });
  return { imported, skipped: plan.skipped, replacedCount: plan.replacedCount };
}

/** Maps a plan entry to the raw grading data used by the average module. */
export function toGradeInput(entry: PlanEntry): GradeInput {
  return {
    projectMark: entry.projectMark,
    examMark: entry.examMark,
    projectWeight: entry.projectWeight,
    examWeight: entry.examWeight,
    creditHours: entry.creditHours,
  };
}
