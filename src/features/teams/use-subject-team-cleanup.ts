/**
 * The "remove this course from my plan" workflow.
 *
 * Removing a course is a *local* action (the study plan lives in SQLite), but
 * a subject team lives on the server — and the backend enforces "one team per
 * subject and term". Leaving a stale team behind would therefore block the
 * student from joining another team for the same subject, so the team has to
 * be resolved *before* the course leaves the plan.
 *
 * The order is deliberate and is what keeps the app free of partial states:
 *
 * 1. **Inspect** — read the caller's own state for the subject+term and, when
 *    a team is involved, the team detail that carries the caller's role.
 * 2. **Decide** — the pure planner (`lib/teams/subject-cleanup.ts`) turns that
 *    into a plan: delete my team / leave their team / cancel my request /
 *    nothing / blocked.
 * 3. **Confirm** — the student is shown what exactly is going to happen.
 * 4. **Clean up** — the server-side change is made first.
 * 5. *Then* the caller removes the course from the local plan.
 *
 * If any step before the cleanup fails, the course stays in the plan: the
 * operation aborts as a whole rather than leaving a course without a team (or
 * a team without a course).
 */
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '@/lib/api/errors';
import {
  subjectTeamsApi,
  type MySubjectTeamState,
  type SubjectTeamDetail,
} from '@/lib/api/subject-teams';
import { planSubjectCleanup, type SubjectCleanupKind } from '@/lib/teams/subject-cleanup';
import { describeTeamFailure, type TeamLifecycleAction } from '@/lib/teams/team-failure';
import { confirmDestructive } from './confirm';

/**
 * What happened to the removal.
 *
 * - `removed` — every team-related change succeeded; the caller may now drop
 *   the course from the local plan.
 * - `cancelled` — the student dismissed the confirmation dialog; nothing was
 *   changed.
 * - `failed` — something went wrong; the course is still in the plan.
 */
export type SubjectCleanupOutcome = 'removed' | 'cancelled' | 'failed';

export interface SubjectCleanupRequest {
  subjectId: string;
  semesterId: string;
  /** The student's local section pick for this subject+term, when any. */
  sectionId: string | null;
}

export interface UseSubjectTeamCleanupResult {
  /** True while the workflow is running; used to block a second submission. */
  running: boolean;
  /**
   * Resolves the team for this subject+term and performs the cleanup it
   * requires. The caller removes the course from the plan only when the
   * outcome is `removed`.
   */
  cleanup: (request: SubjectCleanupRequest) => Promise<SubjectCleanupOutcome>;
}

/** Which failure wording applies to a given plan. */
const ACTION_BY_KIND: Record<SubjectCleanupKind, TeamLifecycleAction> = {
  none: 'verify',
  blocked: 'verify',
  'delete-team': 'delete-team',
  'leave-team': 'leave-team',
  'cancel-request': 'cancel-request',
};

export function useSubjectTeamCleanup(): UseSubjectTeamCleanupResult {
  const [running, setRunning] = useState(false);

  const cleanup = useCallback(
    async (request: SubjectCleanupRequest): Promise<SubjectCleanupOutcome> => {
      setRunning(true);
      try {
        // 1. Inspect: the caller's own state for this subject+term.
        let mine: MySubjectTeamState;
        try {
          mine = await subjectTeamsApi.mine({
            subjectId: request.subjectId,
            semesterId: request.semesterId,
            sectionId: request.sectionId ?? undefined,
          });
        } catch (error) {
          const wording = describeTeamFailure(error, 'verify');
          Alert.alert(wording.title, wording.message);
          return 'failed';
        }

        // The role of the caller (creator / member / pending requester) only
        // lives in the team detail, so it is read as well — but only when a
        // team is actually involved.
        let viewer: SubjectTeamDetail['viewer'] | null = null;
        if (mine.team) {
          try {
            const detail = await subjectTeamsApi.detail(mine.team.id);
            viewer = detail.viewer;
          } catch (error) {
            if (error instanceof ApiError && error.statusCode === 404) {
              // The team was deleted between the two reads: there is nothing
              // left to clean up, so the course can simply be removed.
              mine = {
                ...mine,
                team: null,
                membershipSlotId: null,
                pendingRequest: null,
              };
            } else {
              const wording = describeTeamFailure(error, 'verify');
              Alert.alert(wording.title, wording.message);
              return 'failed';
            }
          }
        }

        // 2. Decide.
        const plan = planSubjectCleanup({ mine, viewer });
        if (plan.kind === 'blocked') {
          Alert.alert('تعذّرت إزالة المقرر', plan.message);
          return 'failed';
        }

        // 3. Confirm.
        const confirmed = await confirmDestructive({
          title: plan.title,
          message: plan.message,
          confirmLabel: plan.confirmLabel,
          cancelLabel: plan.cancelLabel,
        });
        if (!confirmed) {
          return 'cancelled';
        }

        // 4. Clean up (server-side first).
        try {
          if (plan.kind === 'delete-team') {
            await subjectTeamsApi.remove(plan.teamId);
          } else if (plan.kind === 'leave-team') {
            await subjectTeamsApi.leave(plan.teamId);
          } else if (plan.kind === 'cancel-request') {
            await subjectTeamsApi.cancelRequest(plan.teamId, plan.requestId);
          }
        } catch (error) {
          const wording = describeTeamFailure(error, ACTION_BY_KIND[plan.kind]);
          Alert.alert(wording.title, wording.message);
          return 'failed';
        }

        // 5. The caller may now drop the course from the local plan.
        return 'removed';
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  return { running, cleanup };
}
