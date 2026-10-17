import type { Catalog, CatalogSemester, CatalogSubject } from '../api/catalog';

export interface SemesterOfferings {
  semester: CatalogSemester;
  subjects: CatalogSubject[];
}

function startDateOf(semester: CatalogSemester): number {
  if (semester.startDate) {
    const t = Date.parse(semester.startDate);
    if (!Number.isNaN(t)) {
      return t;
    }
  }
  return 0;
}

export function buildOfferings(catalog: Catalog | null): SemesterOfferings[] {
  if (!catalog || !catalog.program) {
    return [];
  }
  const sectionBySubject = new Map<string, Set<string>>();
  for (const section of catalog.sections) {
    if (!sectionBySubject.has(section.subjectId)) {
      sectionBySubject.set(section.subjectId, new Set());
    }
    sectionBySubject.get(section.subjectId)?.add(section.semesterId);
  }

  const subjectById = new Map(catalog.subjects.map((s) => [s.id, s]));
  const offerings = catalog.semesters.map((semester) => {
    const offeredSubjectIds = Array.from(sectionBySubject.entries())
      .filter(([, semesterIds]) => semesterIds.has(semester.id))
      .map(([subjectId]) => subjectId);
    const subjects = offeredSubjectIds
      .map((id) => subjectById.get(id))
      .filter((s): s is CatalogSubject => !!s)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
    return { semester, subjects };
  });

  offerings.sort((a, b) => {
    const diff = startDateOf(b.semester) - startDateOf(a.semester);
    if (diff !== 0) return diff;
    return a.semester.name.localeCompare(b.semester.name, undefined, { numeric: true });
  });

  return offerings;
}
