import { apiRequest } from './client';
import { ResponseParseError } from './errors';

export interface Catalog {
  program: { id: string; name: string; code: string | null } | null;
  semesters: CatalogSemester[];
  subjects: CatalogSubject[];
  professors: CatalogProfessor[];
  sections: CatalogSection[];
  schedules: CatalogSchedule[];
}

export interface CatalogSemester {
  id: string;
  programId: string;
  name: string;
  code: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export interface CatalogSubject {
  id: string;
  programId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  creditHours: number;
  projectWeight: number;
  examWeight: number;
  prerequisiteIds: string[];
}

export interface CatalogProfessor {
  id: string;
  name: string;
  email: string | null;
  profileImageUrl: string | null;
  description: string | null;
}

export interface CatalogSection {
  id: string;
  semesterId: string;
  subjectId: string;
  professorId: string | null;
  code: string;
  location: string | null;
  deliveryMode: string | null;
  capacity: number | null;
}

export interface CatalogSchedule {
  id: string;
  sectionId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCatalog(value: unknown): Catalog {
  if (!isRecord(value)) {
    throw new ResponseParseError('Malformed catalog response.');
  }
  const arrays = ['semesters', 'subjects', 'professors', 'sections', 'schedules'];
  for (const field of arrays) {
    if (!Array.isArray(value[field])) {
      throw new ResponseParseError(`Malformed catalog: ${field} must be an array.`);
    }
    if (value.program !== null && !isRecord(value.program)) {
      throw new ResponseParseError('Malformed catalog: program must be an object or null.');
    }
  }
  return value as unknown as Catalog;
}

export const catalogApi = {
  get: (options?: { signal?: AbortSignal }): Promise<Catalog> =>
    apiRequest<unknown>('/catalog', { auth: true, signal: options?.signal }).then(parseCatalog),
};
