/**
 * Local backup format: versioned JSON containing only the student's *private*
 * study-plan data (semester plans, planned subjects, optional sections, project
 * and exam marks and the weight/credit snapshots needed to reproduce results).
 *
 * Contract:
 * - No credentials: user ids, emails, passwords and access/refresh tokens are
 *   never part of the document (asserted by the tests).
 * - Import validates the format, the schema version and every record before the
 *   store touches the database, so a malformed file can never partially corrupt
 *   local data.
 * - Import never silently overwrites: `merge` keeps existing entries and only
 *   adds missing ones; `replace` swaps the account's plan for the backup's
 *   (after an explicit confirmation in the UI). Catalog caches and other
 *   accounts' records are untouched.
 */
import type { PlanEntry } from '../db/plan-types';
import { isValidMarkValue, isValidWeights } from '../grades/calc';

export const BACKUP_FORMAT = 'studygo-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_APP = 'study-go-app';

/** One private plan entry as stored in a backup file. */
export interface BackupEntry {
  /** Local id; regenerated on import when the file omits it. */
  id?: string;
  semesterId: string;
  subjectId: string;
  sectionId: string | null;
  projectMark: number | null;
  examMark: number | null;
  projectWeight: number;
  examWeight: number;
  creditHours: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: typeof BACKUP_APP;
  exportedAt: string;
  entries: BackupEntry[];
}

export type ParseBackupResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; error: string };

export type ImportMode = 'merge' | 'replace';

export interface ImportPlan {
  mode: ImportMode;
  /** Entries to write (already deduplicated). */
  entries: BackupEntry[];
  /** Merge only: entries kept from the existing plan / duplicates in the file. */
  skipped: number;
  /** Replace only: how many existing entries are removed. */
  replacedCount: number;
}

function entryKey(entry: { semesterId: string; subjectId: string }): string {
  return `${entry.semesterId}::${entry.subjectId}`;
}

/** Builds the versioned backup document from the account's plan entries. */
export function buildBackup(
  entries: readonly PlanEntry[],
  exportedAt: string = new Date().toISOString(),
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    exportedAt,
    entries: entries.map((entry) => ({
      id: entry.id,
      semesterId: entry.semesterId,
      subjectId: entry.subjectId,
      sectionId: entry.sectionId,
      projectMark: entry.projectMark,
      examMark: entry.examMark,
      projectWeight: entry.projectWeight,
      examWeight: entry.examWeight,
      creditHours: entry.creditHours,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
  };
}

/** Serialises a backup document to pretty JSON (the file the student shares). */
export function serializeBackup(
  entries: readonly PlanEntry[],
  exportedAt: string = new Date().toISOString(),
): string {
  return JSON.stringify(buildBackup(entries, exportedAt), null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateEntry(raw: unknown, index: number): { ok: true; entry: BackupEntry } | { ok: false; error: string } {
  const position = `السجل رقم ${index + 1}`;
  if (!isRecord(raw)) {
    return { ok: false, error: `${position}: بنية غير صالحة.` };
  }
  const { semesterId, subjectId, sectionId } = raw;
  if (typeof semesterId !== 'string' || semesterId.trim() === '') {
    return { ok: false, error: `${position}: معرّف الفصل الدراسي مفقود.` };
  }
  if (typeof subjectId !== 'string' || subjectId.trim() === '') {
    return { ok: false, error: `${position}: معرّف المقرر مفقود.` };
  }
  if (sectionId !== null && sectionId !== undefined && typeof sectionId !== 'string') {
    return { ok: false, error: `${position}: معرّف الشعبة غير صالح.` };
  }

  const projectMark = raw.projectMark ?? null;
  const examMark = raw.examMark ?? null;
  if (projectMark !== null && !isValidMarkValue(projectMark)) {
    return { ok: false, error: `${position}: علامة المشروع يجب أن تكون بين 0 و 100.` };
  }
  if (examMark !== null && !isValidMarkValue(examMark)) {
    return { ok: false, error: `${position}: علامة الامتحان يجب أن تكون بين 0 و 100.` };
  }

  const { projectWeight, examWeight, creditHours } = raw;
  if (!isValidWeights(projectWeight, examWeight)) {
    return { ok: false, error: `${position}: أوزان المقرر غير صالحة (يجب أن يكون المجموع 100).` };
  }
  if (
    typeof creditHours !== 'number' ||
    !Number.isFinite(creditHours) ||
    creditHours < 0
  ) {
    return { ok: false, error: `${position}: عدد الساعات المعتمدة غير صالح.` };
  }

  const { id, createdAt, updatedAt } = raw;
  if (id !== undefined && typeof id !== 'string') {
    return { ok: false, error: `${position}: المعرّف المحلي غير صالح.` };
  }
  if (createdAt !== undefined && typeof createdAt !== 'string') {
    return { ok: false, error: `${position}: تاريخ الإنشاء غير صالح.` };
  }
  if (updatedAt !== undefined && typeof updatedAt !== 'string') {
    return { ok: false, error: `${position}: تاريخ التحديث غير صالح.` };
  }

  return {
    ok: true,
    entry: {
      id: id as string | undefined,
      semesterId,
      subjectId,
      sectionId: (sectionId as string | null | undefined) ?? null,
      projectMark: projectMark as number | null,
      examMark: examMark as number | null,
      projectWeight: projectWeight as number,
      examWeight: examWeight as number,
      creditHours,
      createdAt: createdAt as string | undefined,
      updatedAt: updatedAt as string | undefined,
    },
  };
}

/** Validates a backup file's textual content before any local write. */
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'الملف ليس ملف JSON صالحًا.' };
  }
  if (!isRecord(raw)) {
    return { ok: false, error: 'بنية ملف النسخة الاحتياطية غير صالحة.' };
  }
  if (raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'هذا الملف ليس نسخة احتياطية من StudyGO.' };
  }
  if (typeof raw.version !== 'number' || raw.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `إصدار النسخة الاحتياطية غير مدعوم (المدعوم: ${BACKUP_VERSION}).`,
    };
  }
  if (raw.app !== undefined && raw.app !== BACKUP_APP) {
    return { ok: false, error: 'النسخة الاحتياطية تخص تطبيقًا آخر.' };
  }
  if (!Array.isArray(raw.entries)) {
    return { ok: false, error: 'قائمة السجلات في النسخة الاحتياطية غير صالحة.' };
  }

  const entries: BackupEntry[] = [];
  for (let index = 0; index < raw.entries.length; index += 1) {
    const validated = validateEntry(raw.entries[index], index);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }
    entries.push(validated.entry);
  }

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      app: BACKUP_APP,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
      entries,
    },
  };
}

/**
 * Decides exactly what an import will write:
 * - `merge`: keep every existing entry, insert only keys the account does not
 *   already have (duplicates inside the file are skipped too).
 * - `replace`: remove the account's current entries and insert the file's
 *   entries, deduplicated within the file.
 */
export function planImport(
  existing: readonly PlanEntry[],
  backup: BackupFile,
  mode: ImportMode,
): ImportPlan {
  const existingKeys = new Set(existing.map(entryKey));
  const seen = new Set<string>();
  const entries: BackupEntry[] = [];
  let skipped = 0;

  for (const entry of backup.entries) {
    const key = entryKey(entry);
    if (mode === 'merge' && existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    entries.push(entry);
  }

  return {
    mode,
    entries,
    skipped,
    replacedCount: mode === 'replace' ? existing.length : 0,
  };
}
