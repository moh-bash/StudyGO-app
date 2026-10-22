/**
 * The section a subject's screens must work with.
 *
 * The study plan stores the section the student picked for a subject+term; the
 * catalog is the source of truth about which sections exist. A stored id that
 * is not in the catalog — a stale pick left over from an older catalog, or one
 * that belongs to another subject/term — is not a section the student has, and
 * it must never be sent to the server: the server would reject it and the app
 * would wrongly claim that no section was selected.
 *
 * Every screen that needs a section resolves it through this module, so the
 * displayed section and the section used for the team requests can never drift
 * apart.
 */
import type { CatalogSection } from '../api/catalog';

/**
 * The section the student selected, but only when it is a real section of the
 * given subject+term. Returns `null` for a missing or unknown id.
 */
export function findSelectedSection(
  sectionId: string | null | undefined,
  sections: readonly CatalogSection[],
): CatalogSection | null {
  if (!sectionId) {
    return null;
  }
  return sections.find((section) => section.id === sectionId) ?? null;
}

/**
 * The id the server may be told about: the selected section's id, or `null`
 * when nothing valid is selected.
 */
export function resolveSelectedSectionId(
  sectionId: string | null | undefined,
  sections: readonly CatalogSection[],
): string | null {
  return findSelectedSection(sectionId, sections)?.id ?? null;
}

/**
 * True when the section can back a team.
 *
 * A team is scoped to a section *and* to the professor who teaches it, so a
 * section without an assigned professor cannot have one — the server rejects
 * the creation with "The selected section has no assigned professor". Knowing
 * this locally lets the UI explain the real reason instead of telling the
 * student that no section was selected.
 */
export function sectionHasProfessor(section: CatalogSection | null): boolean {
  return section !== null && section.professorId !== null;
}
