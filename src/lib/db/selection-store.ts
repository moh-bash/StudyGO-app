import { getDatabase } from './database';

function isoNow(): string {
  return new Date().toISOString();
}

export async function getAllSelections(): Promise<{ semesterId: string; subjectId: string }[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ semester_id: string; subject_id: string }>(
    'SELECT semester_id, subject_id FROM course_selections ORDER BY semester_id ASC',
  );
  return rows.map((r) => ({ semesterId: r.semester_id, subjectId: r.subject_id }));
}

export async function saveSemesterSelection(semesterId: string, subjectIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM course_selections WHERE semester_id = ?', semesterId);
    for (const subjectId of subjectIds) {
      await db.runAsync(
        'INSERT INTO course_selections (semester_id, subject_id, selected_at) VALUES (?, ?, ?)',
        semesterId,
        subjectId,
        isoNow(),
      );
    }
  });
}

export async function clearSelections(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM course_selections');
}
