import type { Catalog } from '../api/catalog';
import { isCatalogCacheForScope, type CatalogCacheScope } from './catalog-scope';
import { getDatabase } from './database';

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Replaces the cache with `catalog` and tags it with `ownerUserId`, the
 * account whose fetch produced it (full reconciliation inside a transaction,
 * so the cache never holds partial rows between fetches).
 */
export async function saveCatalog(catalog: Catalog, ownerUserId: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM catalog_meta');
    await db.execAsync('DELETE FROM semesters');
    await db.execAsync('DELETE FROM subjects');
    await db.execAsync('DELETE FROM professors');
    await db.execAsync('DELETE FROM sections');
    await db.execAsync('DELETE FROM schedules');

    const program = catalog.program;
    if (program) {
      await db.runAsync(
        'INSERT INTO catalog_meta (id, user_id, program_id, program_name, program_code, cached_at) VALUES (1, ?, ?, ?, ?, ?)',
        ownerUserId,
        program.id,
        program.name,
        program.code,
        isoNow(),
      );
    } else {
      await db.runAsync(
        'INSERT INTO catalog_meta (id, user_id, program_id, program_name, program_code, cached_at) VALUES (1, ?, NULL, NULL, NULL, ?)',
        ownerUserId,
        isoNow(),
      );
    }

    for (const semester of catalog.semesters) {
      await db.runAsync(
        'INSERT INTO semesters (id, program_id, name, code, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        semester.id,
        semester.programId,
        semester.name,
        semester.code,
        semester.startDate,
        semester.endDate,
        semester.status,
      );
    }

    for (const subject of catalog.subjects) {
      await db.runAsync(
        'INSERT INTO subjects (id, program_id, code, name_en, name_ar, credit_hours, project_weight, exam_weight, prerequisite_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        subject.id,
        subject.programId,
        subject.code,
        subject.nameEn,
        subject.nameAr,
        subject.creditHours,
        subject.projectWeight,
        subject.examWeight,
        JSON.stringify(subject.prerequisiteIds),
      );
    }

    for (const professor of catalog.professors) {
      await db.runAsync(
        'INSERT INTO professors (id, name, email, profile_image_url, description) VALUES (?, ?, ?, ?, ?)',
        professor.id,
        professor.name,
        professor.email,
        professor.profileImageUrl,
        professor.description,
      );
    }

    for (const section of catalog.sections) {
      await db.runAsync(
        'INSERT INTO sections (id, semester_id, subject_id, professor_id, code, location, delivery_mode, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        section.id,
        section.semesterId,
        section.subjectId,
        section.professorId,
        section.code,
        section.location,
        section.deliveryMode,
        section.capacity,
      );
    }

    for (const schedule of catalog.schedules) {
      await db.runAsync(
        'INSERT INTO schedules (id, section_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?)',
        schedule.id,
        schedule.sectionId,
        schedule.dayOfWeek,
        schedule.startTime,
        schedule.endTime,
        schedule.room,
      );
    }
  });
}

export async function getCatalog(scope: CatalogCacheScope): Promise<Catalog | null> {
  const db = await getDatabase();
  const meta = await db.getFirstAsync<{
    program_id: string | null;
    program_name: string | null;
    program_code: string | null;
    user_id: string | null;
  }>('SELECT program_id, program_name, program_code, user_id FROM catalog_meta WHERE id = 1');

  if (!meta) {
    return null;
  }

  // Never expose a cached catalog belonging to another account or another
  // specialization (cross-account cache isolation).
  if (!isCatalogCacheForScope({ programId: meta.program_id, userId: meta.user_id }, scope)) {
    return null;
  }

  const semesters = await db.getAllAsync<any>(
    'SELECT id, program_id as programId, name, code, start_date as startDate, end_date as endDate, status FROM semesters ORDER BY start_date DESC NULLS LAST, name ASC',
  );

  const subjects = await db.getAllAsync<any>(
    'SELECT id, program_id as programId, code, name_en as nameEn, name_ar as nameAr, credit_hours as creditHours, project_weight as projectWeight, exam_weight as examWeight, prerequisite_ids as prerequisiteIds FROM subjects ORDER BY code ASC',
  );

  const professors = await db.getAllAsync<any>(
    'SELECT id, name, email, profile_image_url as profileImageUrl, description FROM professors ORDER BY name ASC',
  );

  const sections = await db.getAllAsync<any>(
    'SELECT id, semester_id as semesterId, subject_id as subjectId, professor_id as professorId, code, location, delivery_mode as deliveryMode, capacity FROM sections ORDER BY code ASC',
  );

  const schedules = await db.getAllAsync<any>(
    'SELECT id, section_id as sectionId, day_of_week as dayOfWeek, start_time as startTime, end_time as endTime, room FROM schedules ORDER BY day_of_week ASC, start_time ASC',
  );

  const program =
    meta.program_id
      ? {
          id: meta.program_id,
          name: meta.program_name ?? '',
          code: meta.program_code,
        }
      : null;

  return {
    program,
    semesters: semesters.map((s) => ({
      ...s,
      startDate: s.startDate ?? null,
      endDate: s.endDate ?? null,
    })),
    subjects: subjects.map((subj) => ({
      ...subj,
      prerequisiteIds: (() => {
        try {
          const parsed = JSON.parse(subj.prerequisiteIds ?? '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
    })),
    professors: professors.map((p) => ({
      ...p,
      email: p.email ?? null,
      profileImageUrl: p.profileImageUrl ?? null,
      description: p.description ?? null,
    })),
    sections: sections.map((sec) => ({
      ...sec,
      professorId: sec.professorId ?? null,
      location: sec.location ?? null,
      deliveryMode: sec.deliveryMode ?? null,
      capacity: sec.capacity ?? null,
    })),
    schedules: schedules.map((sched) => ({
      ...sched,
      room: sched.room ?? null,
    })),
  };
}
