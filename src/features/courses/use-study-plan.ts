/**
 * React binding around the local study-plan store.
 *
 * - loads the plan of the signed-in account only (entries are scoped by
 *   `user_id`), adopting any pre-upgrade `course_selections` rows exactly once;
 * - every mutation writes through the store and then re-reads the plan, so the
 *   screens never show stale marks/averages;
 * - no network call is made here: plans, marks and sections stay on the device.
 *
 * The state is a single snapshot tagged with the account it belongs to, so an
 * account switch never exposes the previous account's plan (not even for a
 * frame) and the effect body never writes state synchronously.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { ImportPlan } from '@/lib/backup/backup';
import { useAuth } from '@/lib/auth/AuthContext';
import { getDatabase } from '@/lib/db/database';
import {
  addPlanEntry,
  adoptLegacySelections,
  applyImport,
  listPlanEntries,
  removePlanEntry,
  setPlanEntryMarks,
  setPlanEntrySection,
  setPlanEntryWeights,
  type ApplyImportResult,
} from '@/lib/db/plan-store';
import type { AddPlanEntryInput, PlanEntry, PlanMarks } from '@/lib/db/plan-types';

export type NewPlanEntryInput = Omit<AddPlanEntryInput, 'userId'>;

interface PlanSnapshot {
  userId: string;
  entries: PlanEntry[];
  error: string | null;
}

export interface UseStudyPlanResult {
  entries: PlanEntry[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  addEntry: (input: NewPlanEntryInput) => Promise<{ created: boolean; entry: PlanEntry }>;
  removeEntry: (entryId: string) => Promise<boolean>;
  setSection: (entryId: string, sectionId: string | null) => Promise<boolean>;
  setMarks: (entryId: string, marks: PlanMarks) => Promise<boolean>;
  /** Deliberately replaces the weight snapshot (recalculation is explicit). */
  updateWeights: (
    entryId: string,
    weights: { projectWeight: number; examWeight: number },
  ) => Promise<boolean>;
  importPlan: (plan: ImportPlan) => Promise<ApplyImportResult>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'تعذّر تحميل خطة الدراسة المحلية.';
}

export function useStudyPlan(): UseStudyPlanResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [snapshot, setSnapshot] = useState<PlanSnapshot | null>(null);
  const active = useRef(true);

  const load = useCallback(async (): Promise<void> => {
    if (!userId) {
      return;
    }
    try {
      const db = await getDatabase();
      // One-time, transactional adoption of pre-v3 selections. It claims rows
      // only once; afterwards the legacy table is empty and this is a no-op.
      await adoptLegacySelections(db, userId);
      const entries = await listPlanEntries(db, userId);
      if (active.current) {
        setSnapshot({ userId, entries, error: null });
      }
    } catch (error) {
      if (active.current) {
        setSnapshot({ userId, entries: [], error: messageOf(error) });
      }
    }
  }, [userId]);

  // Reload whenever a screen using the plan gains focus: edits made on another
  // screen (marks, weights, import) are therefore never shown stale when the
  // student navigates back.
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void (async () => {
        await load();
      })();
      return () => {
        active.current = false;
      };
    }, [load]),
  );

  const current = userId && snapshot?.userId === userId ? snapshot : null;

  const requireOwner = useCallback(async () => {
    if (!userId) {
      throw new Error('يجب تسجيل الدخول أولًا لإدارة الخطة.');
    }
    return { db: await getDatabase(), userId };
  }, [userId]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const addEntry = useCallback<UseStudyPlanResult['addEntry']>(
    async (input) => {
      const owner = await requireOwner();
      const result = await addPlanEntry(owner.db, { ...input, userId: owner.userId });
      await load();
      return result;
    },
    [load, requireOwner],
  );

  const removeEntry = useCallback<UseStudyPlanResult['removeEntry']>(
    async (entryId) => {
      const owner = await requireOwner();
      const removed = await removePlanEntry(owner.db, owner.userId, entryId);
      await load();
      return removed;
    },
    [load, requireOwner],
  );

  const setSection = useCallback<UseStudyPlanResult['setSection']>(
    async (entryId, sectionId) => {
      const owner = await requireOwner();
      const updated = await setPlanEntrySection(owner.db, owner.userId, entryId, sectionId);
      await load();
      return updated;
    },
    [load, requireOwner],
  );

  const setMarks = useCallback<UseStudyPlanResult['setMarks']>(
    async (entryId, marks) => {
      const owner = await requireOwner();
      const updated = await setPlanEntryMarks(owner.db, owner.userId, entryId, marks);
      await load();
      return updated;
    },
    [load, requireOwner],
  );

  const updateWeights = useCallback<UseStudyPlanResult['updateWeights']>(
    async (entryId, weights) => {
      const owner = await requireOwner();
      const updated = await setPlanEntryWeights(owner.db, owner.userId, entryId, weights);
      await load();
      return updated;
    },
    [load, requireOwner],
  );

  const importPlan = useCallback<UseStudyPlanResult['importPlan']>(
    async (plan) => {
      const owner = await requireOwner();
      const result = await applyImport(owner.db, owner.userId, plan);
      await load();
      return result;
    },
    [load, requireOwner],
  );

  return useMemo(
    () => ({
      entries: current?.entries ?? [],
      // A new account (or a failed first read) is a resolved state, never a
      // permanent spinner: `loading` means "this account's snapshot not loaded".
      loading: userId !== null && current === null,
      error: current?.error ?? null,
      reload,
      addEntry,
      removeEntry,
      setSection,
      setMarks,
      updateWeights,
      importPlan,
    }),
    [
      userId,
      current,
      reload,
      addEntry,
      removeEntry,
      setSection,
      setMarks,
      updateWeights,
      importPlan,
    ],
  );
}
