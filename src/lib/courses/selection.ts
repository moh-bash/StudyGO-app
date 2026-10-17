import type { Catalog, CatalogSemester, CatalogSubject } from '../api/catalog';

export interface CourseSelection {
  semesterId: string;
  subjectId: string;
}

export interface SelectedCourse {
  semester: CatalogSemester;
  subject: CatalogSubject;
}

export function resolveSelectedCourses(catalog: Catalog | null, selections: CourseSelection[]): SelectedCourse[] {
  if (!catalog) {
    return [];
  }
  const subjectById = new Map(catalog.subjects.map((s) => [s.id, s]));
  const semesterById = new Map(catalog.semesters.map((s) => [s.id, s]));

  const resolved = selections
    .map((sel) => {
      const subject = subjectById.get(sel.subjectId);
      const semester = semesterById.get(sel.semesterId);
      if (!subject || !semester) {
        return null;
      }
      return { semester, subject };
    })
    .filter((s): s is SelectedCourse => !!s);

  resolved.sort((a, b) => {
    const semA = a.semester.startDate ? Date.parse(a.semester.startDate) : 0;
    const semB = b.semester.startDate ? Date.parse(b.semester.startDate) : 0;
    const diff = semB - semA;
    if (diff !== 0) return diff;
    if (a.semester.code !== b.semester.code) return a.semester.code.localeCompare(b.semester.code);
    return a.subject.code.localeCompare(b.subject.code);
  });

  return resolved;
}
