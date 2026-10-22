/** Unit tests for the section display resolver (professor / schedule / semester). */
import { describe, expect, it } from 'vitest';
import type { Catalog, CatalogSection } from '../api/catalog';
import { buildSectionDetails } from './section-details';

function makeSection(overrides: Partial<CatalogSection> = {}): CatalogSection {
  return {
    id: 'sec-1',
    semesterId: 'sem-1',
    subjectId: 'sub-1',
    professorId: 'prof-1',
    code: '01',
    location: 'مبنى 1',
    deliveryMode: 'ON_CAMPUS',
    capacity: 30,
    ...overrides,
  };
}

function makeCatalog(overrides: Partial<Catalog> = {}): Catalog {
  return {
    program: { id: 'prog-1', name: 'Information Technology', code: 'IT' },
    semesters: [
      {
        id: 'sem-1',
        programId: 'prog-1',
        name: 'الفصل الأول 2025/2026',
        code: 'F25',
        startDate: '2025-09-01',
        endDate: '2025-12-31',
        status: 'ACTIVE',
      },
    ],
    subjects: [],
    professors: [
      {
        id: 'prof-1',
        name: 'د. سارة أحمد',
        email: null,
        profileImageUrl: null,
        description: null,
      },
    ],
    sections: [],
    schedules: [],
    ...overrides,
  };
}

describe('buildSectionDetails', () => {
  it('returns professor, formatted schedule lines and semester label for full data', () => {
    const section = makeSection();
    const catalog = makeCatalog({
      schedules: [
        {
          id: 'sch-1',
          sectionId: 'sec-1',
          dayOfWeek: 'SUNDAY',
          startTime: '08:00:00',
          endTime: '09:30:00',
          room: 'قاعة 204',
        },
        {
          id: 'sch-2',
          sectionId: 'sec-1',
          dayOfWeek: 'MONDAY',
          startTime: '10:15:00',
          endTime: '11:45:00',
          room: null,
        },
      ],
    });

    expect(buildSectionDetails(catalog, section)).toEqual({
      professorName: 'د. سارة أحمد',
      scheduleLines: ['الأحد 08:00 – 09:30 • قاعة 204', 'الاثنين 10:15 – 11:45'],
      semesterLabel: 'الفصل الأول 2025/2026',
    });
  });

  it('falls back to TBA when the section has no assigned professor', () => {
    const catalog = makeCatalog();

    expect(buildSectionDetails(catalog, makeSection({ professorId: null })).professorName).toBe('TBA');
  });

  it('falls back to TBA when the professor id does not resolve', () => {
    const catalog = makeCatalog();

    expect(buildSectionDetails(catalog, makeSection({ professorId: 'missing' })).professorName).toBe('TBA');
  });

  it('falls back to TBA when the professor name is blank', () => {
    const catalog = makeCatalog({
      professors: [
        { id: 'prof-1', name: '   ', email: null, profileImageUrl: null, description: null },
      ],
    });

    expect(buildSectionDetails(catalog, makeSection()).professorName).toBe('TBA');
  });

  it('returns an empty schedule list when the section has no meetings', () => {
    const catalog = makeCatalog({
      schedules: [
        {
          id: 'sch-2',
          sectionId: 'other-section',
          dayOfWeek: 'SUNDAY',
          startTime: '08:00:00',
          endTime: '09:30:00',
          room: null,
        },
      ],
    });

    expect(buildSectionDetails(catalog, makeSection()).scheduleLines).toEqual([]);
  });

  it('orders multiple schedule entries by weekday then start time', () => {
    const section = makeSection();
    const catalog = makeCatalog({
      schedules: [
        {
          id: 'sch-1',
          sectionId: 'sec-1',
          dayOfWeek: 'MONDAY',
          startTime: '12:00:00',
          endTime: '13:30:00',
          room: null,
        },
        {
          id: 'sch-2',
          sectionId: 'sec-1',
          dayOfWeek: 'SUNDAY',
          startTime: '14:00:00',
          endTime: '15:30:00',
          room: null,
        },
        {
          id: 'sch-3',
          sectionId: 'sec-1',
          dayOfWeek: 'MONDAY',
          startTime: '08:00:00',
          endTime: '09:30:00',
          room: null,
        },
        {
          id: 'sch-4',
          sectionId: 'sec-1',
          dayOfWeek: 'FRIDAY',
          startTime: '09:00:00',
          endTime: '10:00:00',
          room: null,
        },
      ],
    });

    expect(buildSectionDetails(catalog, section).scheduleLines).toEqual([
      'الأحد 14:00 – 15:30',
      'الاثنين 08:00 – 09:30',
      'الاثنين 12:00 – 13:30',
      'الجمعة 09:00 – 10:00',
    ]);
  });

  it('resolves the semester label from the section semester id', () => {
    const catalog = makeCatalog();

    expect(buildSectionDetails(catalog, makeSection()).semesterLabel).toBe('الفصل الأول 2025/2026');
  });

  it('falls back to the semester code when the name is blank', () => {
    const catalog = makeCatalog({
      semesters: [
        {
          id: 'sem-1',
          programId: 'prog-1',
          name: '  ',
          code: 'F25',
          startDate: null,
          endDate: null,
          status: 'ACTIVE',
        },
      ],
    });

    expect(buildSectionDetails(catalog, makeSection()).semesterLabel).toBe('F25');
  });

  it('falls back to a generic label when the semester does not resolve', () => {
    const catalog = makeCatalog();

    expect(buildSectionDetails(catalog, makeSection({ semesterId: 'missing' })).semesterLabel).toBe(
      'غير محدد',
    );
  });

  it('keeps an unknown weekday label as-is', () => {
    const catalog = makeCatalog({
      schedules: [
        {
          id: 'sch-1',
          sectionId: 'sec-1',
          dayOfWeek: 'HOLIDAY',
          startTime: '08:00:00',
          endTime: '09:00:00',
          room: null,
        },
      ],
    });

    expect(buildSectionDetails(catalog, makeSection()).scheduleLines).toEqual([
      'HOLIDAY 08:00 – 09:00',
    ]);
  });
});
