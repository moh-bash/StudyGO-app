/**
 * Pure decision logic for "what has to happen to my team when I remove this
 * course from my plan?".
 *
 * Removing a course is a *local* action (the study plan lives in SQLite), but
 * a subject team lives on the server. Leaving a stale team behind would block
 * the student from joining another team for the same subject and term — the
 * backend enforces "one team per subject and term". So the removal has to
 * resolve the team first:
 *
 * - the student **created** the team → the team is deleted with the course;
 * - the student is a **member** of someone else's team → only their own
 *   membership is dropped and their task slot is released;
 * - the student has a **pending join request** → the request is cancelled;
 * - there is **no team** → the course is simply removed.
 *
 * The module is deliberately free of React, React Native and network calls so
 * the decision (and its Arabic wording) is unit-testable. It never performs
 * the cleanup itself: the caller executes the plan it returns.
 */
import type { MySubjectTeamState, SubjectTeamDetail } from '../api/subject-teams';

/**
 * What has to be cleaned up on the server before the course can leave the
 * student's plan.
 *
 * - `none` — no team is involved; remove the course only.
 * - `delete-team` — the caller created the team; delete it with every member.
 * - `leave-team` — the caller is a member of somebody else's team; drop only
 *   their own membership.
 * - `cancel-request` — the caller has a pending join request; cancel it.
 * - `blocked` — the caller's relationship with the team could not be
 *   established; the removal must not go ahead.
 */
export type SubjectCleanupKind =
  | 'none'
  | 'delete-team'
  | 'leave-team'
  | 'cancel-request'
  | 'blocked';

/** The Arabic copy shown in the confirmation dialog. */
export interface SubjectCleanupCopy {
  /** Dialog title. */
  title: string;
  /** Dialog body: what exactly is going to happen. */
  message: string;
  /** Label of the destructive confirmation button. */
  confirmLabel: string;
  /** Label of the cancel button. */
  cancelLabel: string;
}

/**
 * A fully resolved cleanup decision.
 *
 * The union is discriminated by `kind`, so narrowing it also narrows the ids:
 * a `delete-team` plan always carries a `teamId`, and a `cancel-request` plan
 * always carries both a `teamId` and a `requestId`.
 */
export type SubjectCleanupPlan =
  | (SubjectCleanupCopy & { kind: 'none'; teamId: null; requestId: null })
  | (SubjectCleanupCopy & { kind: 'blocked'; teamId: null; requestId: null })
  | (SubjectCleanupCopy & { kind: 'delete-team'; teamId: string; requestId: null })
  | (SubjectCleanupCopy & { kind: 'leave-team'; teamId: string; requestId: null })
  | (SubjectCleanupCopy & { kind: 'cancel-request'; teamId: string; requestId: string });

/** What the planner needs to know about the caller. */
export interface SubjectCleanupInput {
  /**
   * The caller's own state for this subject+term
   * (`GET /teams/subject/mine`), or `null` when it could not be read.
   */
  mine: MySubjectTeamState | null;
  /**
   * The caller's relationship with the team, as the server reports it
   * (`GET /teams/subject/:id` → `viewer`). `null` when it was not read.
   */
  viewer: SubjectTeamDetail['viewer'] | null;
}

const CANCEL_LABEL = 'إلغاء';

/** The plain "remove the course" wording — no team is involved. */
export const REMOVE_ONLY_PLAN: SubjectCleanupPlan = {
  kind: 'none',
  teamId: null,
  requestId: null,
  title: 'إزالة المقرر',
  message: 'سيتم حذف المقرر وعلاماته من خطتك المحلية. لا يمكن التراجع.',
  confirmLabel: 'إزالة',
  cancelLabel: CANCEL_LABEL,
};

/**
 * The wording used when the team relationship is unknown. The course stays in
 * the plan: guessing would either orphan a team or delete somebody else's.
 */
export const BLOCKED_PLAN: SubjectCleanupPlan = {
  kind: 'blocked',
  teamId: null,
  requestId: null,
  title: 'تعذّرت إزالة المقرر',
  message:
    'تعذّر التحقق من حالة الفريق في هذا المقرر، لذلك لم يتم حذف المقرر. حاول مرة أخرى.',
  confirmLabel: 'إزالة',
  cancelLabel: CANCEL_LABEL,
};

/** The wording for "you created this team, it goes away with the course". */
export function deleteTeamCopy(teamName: string): SubjectCleanupCopy {
  return {
    title: 'حذف الفريق وإزالة المقرر',
    message: `أنت منشئ فريق «${teamName}» في هذا المقرر. سيؤدي حذف المقرر إلى حذف الفريق بالكامل وإلغاء عضوية جميع الأعضاء وطلبات الانضمام المعلّقة. لا يمكن التراجع عن هذه الخطوة.`,
    confirmLabel: 'حذف الفريق والمقرر',
    cancelLabel: CANCEL_LABEL,
  };
}

/** The wording for "you are a member of somebody else's team". */
export function leaveTeamCopy(teamName: string): SubjectCleanupCopy {
  return {
    title: 'مغادرة الفريق وإزالة المقرر',
    message: `أنت عضو في فريق «${teamName}» في هذا المقرر. سيؤدي حذف المقرر إلى إخراجك من الفريق وإتاحة مهمتك لعضو آخر، بينما يبقى باقي أعضاء الفريق كما هم.`,
    confirmLabel: 'مغادرة الفريق وإزالة',
    cancelLabel: CANCEL_LABEL,
  };
}

/** The wording for "you have a join request waiting for an answer". */
export function cancelRequestCopy(teamName: string): SubjectCleanupCopy {
  return {
    title: 'إلغاء طلب الانضمام وإزالة المقرر',
    message: `لديك طلب انضمام معلّق إلى فريق «${teamName}» في هذا المقرر. سيؤدي حذف المقرر إلى إلغاء هذا الطلب.`,
    confirmLabel: 'إلغاء الطلب وإزالة',
    cancelLabel: CANCEL_LABEL,
  };
}

/**
 * Decides what has to happen to the caller's team before the course can be
 * removed from the plan.
 *
 * The rules, in order:
 *
 * 1. No team for this subject+term → `none` (a plain removal).
 * 2. A team exists but the caller's relationship with it is unknown →
 *    `blocked` (never guess: an orphaned team blocks the student from joining
 *    another one, and deleting the wrong team would take away other people's
 *    team).
 * 3. The caller created the team → `delete-team`.
 * 4. The caller is a member → `leave-team`.
 * 5. The caller has a pending join request → `cancel-request`.
 */
export function planSubjectCleanup(input: SubjectCleanupInput): SubjectCleanupPlan {
  const team = input.mine?.team ?? null;
  if (!team) {
    return REMOVE_ONLY_PLAN;
  }

  const viewer = input.viewer;
  if (!viewer) {
    return BLOCKED_PLAN;
  }

  if (viewer.isCreator) {
    return { ...deleteTeamCopy(team.name), kind: 'delete-team', teamId: team.id, requestId: null };
  }
  if (viewer.isMember) {
    return { ...leaveTeamCopy(team.name), kind: 'leave-team', teamId: team.id, requestId: null };
  }
  const pending = input.mine?.pendingRequest ?? null;
  if (pending) {
    return {
      ...cancelRequestCopy(team.name),
      kind: 'cancel-request',
      teamId: team.id,
      requestId: pending.id,
    };
  }
  // A team exists, yet the caller is neither its creator, nor a member, nor a
  // pending requester. The server never produces that combination, so it means
  // the relationship could not be established: block instead of guessing.
  return BLOCKED_PLAN;
}
