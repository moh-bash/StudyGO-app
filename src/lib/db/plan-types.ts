/**
 * Shared types for the private, local study plan. Kept free of any database or
 * React Native import so both the store, the pure grade modules, the backup
 * module and the unit tests can depend on it.
 */

/** One subject planned by a local student account for one semester. */
export interface PlanEntry {
  /** Stable local identifier (generated on device, never sent to the server). */
  id: string;
  /** Local account that owns the entry. */
  userId: string;
  /** Backend semester id (academic identifier). */
  semesterId: string;
  /** Backend subject id (identity is the id, never the subject name). */
  subjectId: string;
  /** Optional chosen section (personal planning choice, not official registration). */
  sectionId: string | null;
  /** `null` means *missing*; `0` is a valid mark. */
  projectMark: number | null;
  /** `null` means *missing*; `0` is a valid mark. */
  examMark: number | null;
  /** Weight snapshot in force when the subject was planned. */
  projectWeight: number;
  /** Weight snapshot in force when the subject was planned. */
  examWeight: number;
  /** Credit-hour snapshot (used for weighted averages). */
  creditHours: number;
  createdAt: string;
  updatedAt: string;
}

/** The data needed to add a subject to a semester plan. */
export interface AddPlanEntryInput {
  userId: string;
  semesterId: string;
  subjectId: string;
  creditHours: number;
  projectWeight: number;
  examWeight: number;
}

/** Marks of one plan entry (either may be `null` = missing). */
export interface PlanMarks {
  projectMark: number | null;
  examMark: number | null;
}
