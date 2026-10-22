import * as SQLite from 'expo-sqlite';
import {
  CATALOG_TABLES,
  STUDY_PLAN_ENTRIES_DDL,
  STUDY_PLAN_ENTRIES_INDEX_DDL,
} from './schema';

const DATABASE_NAME = 'studygo.db';
const DATABASE_VERSION = 3;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) {
    return;
  }
  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS catalog_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        program_id TEXT,
        program_name TEXT,
        program_code TEXT,
        cached_at TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS semesters (
        id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        status TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name_en TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        credit_hours INTEGER NOT NULL,
        project_weight INTEGER NOT NULL,
        exam_weight INTEGER NOT NULL,
        prerequisite_ids TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS professors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        profile_image_url TEXT,
        description TEXT
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        semester_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        professor_id TEXT,
        code TEXT NOT NULL,
        location TEXT,
        delivery_mode TEXT,
        capacity INTEGER
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room TEXT
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS course_selections (
        semester_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        selected_at TEXT NOT NULL,
        PRIMARY KEY (semester_id, subject_id)
      );
    `);

    version = 1;
  }

  if (version < 2) {
    // v2 (Phase 1 — account isolation): the cached catalog is tagged with the
    // account that fetched it; reads from any other account are ignored.
    // Additive column — no existing rows are deleted or rewritten.
    await db.execAsync('ALTER TABLE catalog_meta ADD COLUMN user_id TEXT');
    version = 2;
  }

  if (version < 3) {
    // v3 (Phase 3 — local study plan): a private per-account plan table holding
    // the selected subjects, the optional section, the project/exam marks and
    // snapshots of the weights/credits in force when each subject was planned.
    // Purely additive: no existing row or table is modified or deleted. The
    // legacy `course_selections` rows are preserved and adopted into this table
    // at runtime by the first signed-in account (see `plan-store`).
    await db.execAsync(STUDY_PLAN_ENTRIES_DDL);
    await db.execAsync(STUDY_PLAN_ENTRIES_INDEX_DDL);
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndMigrate().catch((e) => {
      databasePromise = null;
      throw e;
    });
  }
  return databasePromise;
}

/**
 * Clears the shared *catalog cache* only (on logout or a rejected session).
 *
 * The student's private study plan is deliberately NOT cleared: plans, marks and
 * section choices must survive logout and authentication recovery. They are
 * isolated per account by `study_plan_entries.user_id`, so the next account on
 * the device can never read them.
 */
export async function clearCoursesData(): Promise<void> {
  const db = await getDatabase();
  for (const table of CATALOG_TABLES) {
    await db.execAsync(`DELETE FROM ${table}`);
  }
}
