import { describe, expect, it } from 'vitest';
import type { CatalogSection } from '../api/catalog';
import {
  findSelectedSection,
  resolveSelectedSectionId,
  sectionHasProfessor,
} from './section-scope';

function section(over: Partial<CatalogSection> = {}): CatalogSection {
  return {
    id: 'sec-a',
    semesterId: 'term-1',
    subjectId: 'subj-1',
    professorId: 'prof-a',
    code: 'A1',
    location: null,
    deliveryMode: null,
    capacity: 40,
    ...over,
  };
}

describe('resolveSelectedSectionId', () => {
  it('keeps the selected section when it exists in the catalog', () => {
    const sections = [section(), section({ id: 'sec-b', code: 'A2' })];
    expect(resolveSelectedSectionId('sec-b', sections)).toBe('sec-b');
  });

  it('drops a stale selection that is not in the catalog', () => {
    // A section id left over from an older catalog must never be sent to the
    // server: it would be rejected and look like "no section was selected".
    expect(resolveSelectedSectionId('sec-gone', [section()])).toBeNull();
  });

  it('drops a selection that belongs to another subject or term', () => {
    const other = [section({ id: 'sec-other', subjectId: 'subj-2' })];
    expect(resolveSelectedSectionId('sec-other', other)).not.toBeNull();
    expect(resolveSelectedSectionId('sec-other', [])).toBeNull();
  });

  it('treats a missing selection as no selection', () => {
    expect(resolveSelectedSectionId(null, [section()])).toBeNull();
    expect(resolveSelectedSectionId(undefined, [section()])).toBeNull();
    expect(resolveSelectedSectionId('', [section()])).toBeNull();
  });
});

describe('findSelectedSection', () => {
  it('returns the section the student picked', () => {
    const sections = [section(), section({ id: 'sec-b', code: 'A2' })];
    expect(findSelectedSection('sec-b', sections)?.code).toBe('A2');
  });

  it('returns null for an unknown selection', () => {
    expect(findSelectedSection('sec-gone', [section()])).toBeNull();
    expect(findSelectedSection(null, [section()])).toBeNull();
  });
});

describe('sectionHasProfessor', () => {
  it('is true only when a professor is assigned to the section', () => {
    expect(sectionHasProfessor(section())).toBe(true);
    expect(sectionHasProfessor(section({ professorId: null }))).toBe(false);
    expect(sectionHasProfessor(null)).toBe(false);
  });
});
