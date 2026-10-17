import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'studygo.db';
const DATABASE_VERSION = 1;

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

export async function clearCoursesData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM catalog_meta');
  await db.execAsync('DELETE FROM semesters');
  await db.execAsync('DELETE FROM subjects');
  await db.execAsync('DELETE FROM professors');
  await db.execAsync('DELETE FROM sections');
  await db.execAsync('DELETE FROM schedules');
  await db.execAsync('DELETE FROM course_selections');
}
