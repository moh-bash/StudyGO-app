/**
 * Local SQLite schema fragments shared between the real migration
 * (`database.ts`) and the unit tests. Kept free of `expo-sqlite` imports so the
 * tests can execute the exact same DDL against an in-memory database.
 *
 * Phase 3 introduces `study_plan_entries`: the student's *private, local* study
 * plan (semester plans, optional section, project/exam marks and snapshots of
 * the grading weights and credit hours in force when the subject was planned).
 * It is deliberately separate from the shared catalog cache tables, which are
 * replaced on every catalog refresh.
 */

/** The private plan table introduced in schema v3. */
export const STUDY_PLAN_ENTRIES_TABLE = 'study_plan_entries';

/**
 * `study_plan_entries` DDL.
 *
 * - `id` is a stable, locally generated identifier (never sent to the server).
 * - `user_id` is the local account owner: plans on a shared device are isolated
 *   per account, and the same subject may be planned by two accounts.
 * - marks are `NULL` when missing (a real zero is stored as `0`).
 * - `project_weight` / `exam_weight` / `credit_hours` are snapshots taken when
 *   the subject entered the plan, so a later catalog or weight change never
 *   silently rewrites a historical result.
 * - the derived calculation status is *not* stored: it is computed on read from
 *   the marks and weights, which cannot go stale.
 */
export const STUDY_PLAN_ENTRIES_DDL = `
      CREATE TABLE IF NOT EXISTS ${STUDY_PLAN_ENTRIES_TABLE} (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        semester_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        section_id TEXT,
        project_mark REAL,
        exam_mark REAL,
        project_weight REAL NOT NULL,
        exam_weight REAL NOT NULL,
        credit_hours INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, semester_id, subject_id)
      );
    `;

export const STUDY_PLAN_ENTRIES_INDEX_DDL = `
      CREATE INDEX IF NOT EXISTS idx_study_plan_entries_user
        ON ${STUDY_PLAN_ENTRIES_TABLE}(user_id);
    `;

/**
 * Shared, backend-owned catalog cache. Every catalog refresh (and logout)
 * clears exactly these tables; it must never touch the private plan tables.
 */
export const CATALOG_TABLES = [
  'catalog_meta',
  'semesters',
  'subjects',
  'professors',
  'sections',
  'schedules',
] as const;

/**
 * Private, student-owned tables. Their contents survive logout, catalog
 * refreshes and account switches, and are scoped by `user_id` (`course_selections`
 * is the pre-v3 legacy table, migrated into `study_plan_entries` on first use).
 */
export const PERSONAL_TABLES = [STUDY_PLAN_ENTRIES_TABLE, 'course_selections'] as const;
