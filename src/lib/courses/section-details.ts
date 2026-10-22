import type { Catalog, CatalogSection } from '../api/catalog';

/** Display-ready facts about one section, resolved from the flat catalog. */
export interface SectionDetails {
  /** Primary professor's display name; `TBA` when unassigned or unknown. */
  professorName: string;
  /** Human-readable weekly lines, e.g. `الأحد 08:00 – 09:30 • قاعة 204`. */
  scheduleLines: string[];
  /** Label of the semester the section belongs to. */
  semesterLabel: string;
}

const UNKNOWN_PROFESSOR = 'TBA';
const UNKNOWN_SEMESTER = 'غير محدد';
/** Rank for weekdays outside the known set — they sort after Saturday. */
const UNKNOWN_DAY_RANK = 7;

/** Week starts on Sunday (Arabic locale); unknown days sort last, stably. */
const DAY_ORDER: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const DAY_LABELS_AR: Record<string, string> = {
  SUNDAY: 'الأحد',
  MONDAY: 'الاثنين',
  TUESDAY: 'الثلاثاء',
  WEDNESDAY: 'الأربعاء',
  THURSDAY: 'الخميس',
  FRIDAY: 'الجمعة',
  SATURDAY: 'السبت',
};

/** `08:00:00` → `08:00`; anything unrecognised is passed through trimmed. */
function formatTime(raw: string): string {
  const trimmed = raw.trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function dayRank(day: string): number {
  const rank = DAY_ORDER[day.trim().toUpperCase()];
  // Unknown weekdays rank after Saturday; equal ranks keep a stable order.
  return rank ?? UNKNOWN_DAY_RANK;
}

/**
 * Resolves the display data for a single section: its primary professor, its
 * weekly schedule lines (sorted by weekday then start time), and the label of
 * the semester it belongs to. Missing relations degrade to `TBA` / an empty
 * list / `غير محدد` instead of throwing.
 */
export function buildSectionDetails(catalog: Catalog, section: CatalogSection): SectionDetails {
  const professor = section.professorId
    ? catalog.professors.find((p) => p.id === section.professorId)
    : undefined;
  const professorName = professor?.name.trim() || UNKNOWN_PROFESSOR;

  const semester = catalog.semesters.find((s) => s.id === section.semesterId);
  const semesterLabel = semester?.name.trim() || semester?.code.trim() || UNKNOWN_SEMESTER;

  const scheduleLines = catalog.schedules
    .filter((schedule) => schedule.sectionId === section.id)
    .slice()
    .sort((a, b) => {
      const byDay = dayRank(a.dayOfWeek) - dayRank(b.dayOfWeek);
      if (byDay !== 0) {
        return byDay;
      }
      return a.startTime.localeCompare(b.startTime);
    })
    .map((schedule) => {
      const day = DAY_LABELS_AR[schedule.dayOfWeek.trim().toUpperCase()] ?? schedule.dayOfWeek.trim();
      const time = `${formatTime(schedule.startTime)} – ${formatTime(schedule.endTime)}`;
      const room = schedule.room?.trim();
      return room ? `${day} ${time} • ${room}` : `${day} ${time}`;
    });

  return { professorName, scheduleLines, semesterLabel };
}
