/**
 * Unit tests for the subject-cleanup planner.
 *
 * The planner decides what has to happen to the caller's team before a course
 * may leave the study plan. Every branch is pinned here, because a wrong
 * decision has real consequences: deleting somebody else's team, or leaving an
 * orphaned team behind that blocks the student from joining another one.
 */
import { describe, expect, it } from 'vitest';
import type { MySubjectTeamState, SubjectTeamDetail, SubjectTeamSummary } from '../api/subject-teams';
import {
  BLOCKED_PLAN,
  planSubjectCleanup,
  REMOVE_ONLY_PLAN,
  type SubjectCleanupPlan,
} from './subject-cleanup';

function teamSummary(overrides: Partial<SubjectTeamSummary> = {}): SubjectTeamSummary {
  return {
    id: 'team-1',
    name: 'فريق التفوق',
    description: null,
    subjectId: 'subject-1',
    subjectNameAr: 'مادة',
    semesterId: 'semester-1',
    semesterName: 'الفصل',
    sectionId: 'section-1',
    sectionCode: 'A1',
    professorId: 'professor-1',
    professorName: 'د. أحمد',
    scope: 'SECTION',
    creatorId: 'user-1',
    creatorName: 'المالك',
    maxMembers: 3,
    memberCount: 2,
    openSlotCount: 1,
    contactMethod: 'TELEGRAM',
    contactValue: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function myState(overrides: Partial<MySubjectTeamState> = {}): MySubjectTeamState {
  return {
    team: null,
    membershipSlotId: null,
    pendingRequest: null,
    hasEligibleSection: true,
    ...overrides,
  };
}

function viewer(overrides: Partial<SubjectTeamDetail['viewer']> = {}): SubjectTeamDetail['viewer'] {
  return {
    isCreator: false,
    isMember: false,
    membershipSlotId: null,
    pendingRequestSlotId: null,
    pendingRequestId: null,
    ...overrides,
  };
}

describe('planSubjectCleanup', () => {
  it('plans a plain removal when the student has no team for the subject', () => {
    const plan = planSubjectCleanup({ mine: myState(), viewer: null });

    expect(plan.kind).toBe('none');
    expect(plan.teamId).toBeNull();
    expect(plan.requestId).toBeNull();
    expect(plan.title).toBe(REMOVE_ONLY_PLAN.title);
    expect(plan.message).toBe(REMOVE_ONLY_PLAN.message);
  });

  it('plans a plain removal when the caller state could not be read at all', () => {
    const plan = planSubjectCleanup({ mine: null, viewer: null });

    expect(plan.kind).toBe('none');
  });

  it('deletes the team when the student is its creator', () => {
    const plan = planSubjectCleanup({
      mine: myState({ team: teamSummary({ id: 'team-9' }), membershipSlotId: 'slot-1' }),
      viewer: viewer({ isCreator: true, isMember: true, membershipSlotId: 'slot-1' }),
    });

    expect(plan.kind).toBe('delete-team');
    expect(plan.teamId).toBe('team-9');
    expect(plan.requestId).toBeNull();
    expect(plan.message).toContain('فريق التفوق');
    expect(plan.confirmLabel).toBe('حذف الفريق والمقرر');
  });

  it('leaves the team when the student is a member of somebody else’s team', () => {
    const plan = planSubjectCleanup({
      mine: myState({ team: teamSummary({ id: 'team-9' }), membershipSlotId: 'slot-2' }),
      viewer: viewer({ isMember: true, membershipSlotId: 'slot-2' }),
    });

    expect(plan.kind).toBe('leave-team');
    expect(plan.teamId).toBe('team-9');
    expect(plan.requestId).toBeNull();
    expect(plan.message).toContain('فريق التفوق');
    expect(plan.confirmLabel).toBe('مغادرة الفريق وإزالة');
  });

  it('cancels the pending request when the student has not joined yet', () => {
    const plan = planSubjectCleanup({
      mine: myState({
        team: teamSummary({ id: 'team-9' }),
        pendingRequest: { id: 'request-7', slotId: 'slot-3', status: 'PENDING' },
      }),
      viewer: viewer({ pendingRequestSlotId: 'slot-3', pendingRequestId: 'request-7' }),
    });

    expect(plan.kind).toBe('cancel-request');
    expect(plan.teamId).toBe('team-9');
    expect(plan.requestId).toBe('request-7');
    expect(plan.confirmLabel).toBe('إلغاء الطلب وإزالة');
  });

  it('blocks the removal when a team exists but the relationship is unknown', () => {
    const plan = planSubjectCleanup({
      mine: myState({ team: teamSummary() }),
      viewer: null,
    });

    expect(plan.kind).toBe('blocked');
    expect(plan.teamId).toBeNull();
    expect(plan.requestId).toBeNull();
    expect(plan.title).toBe(BLOCKED_PLAN.title);
    expect(plan.message).toBe(BLOCKED_PLAN.message);
  });

  it('blocks the removal when the viewer is neither creator, member nor requester', () => {
    const plan = planSubjectCleanup({
      mine: myState({ team: teamSummary() }),
      viewer: viewer(),
    });

    expect(plan.kind).toBe('blocked');
  });

  it('never leaves a plan without Arabic wording for the dialog', () => {
    const plans: SubjectCleanupPlan[] = [
      planSubjectCleanup({ mine: myState(), viewer: null }),
      planSubjectCleanup({
        mine: myState({ team: teamSummary() }),
        viewer: viewer({ isCreator: true }),
      }),
      planSubjectCleanup({
        mine: myState({ team: teamSummary() }),
        viewer: viewer({ isMember: true }),
      }),
      planSubjectCleanup({
        mine: myState({
          team: teamSummary(),
          pendingRequest: { id: 'r1', slotId: null, status: 'PENDING' },
        }),
        viewer: viewer(),
      }),
      planSubjectCleanup({ mine: myState({ team: teamSummary() }), viewer: null }),
    ];

    for (const plan of plans) {
      expect(plan.title.length).toBeGreaterThan(0);
      expect(plan.message.length).toBeGreaterThan(0);
      expect(plan.confirmLabel.length).toBeGreaterThan(0);
      expect(plan.cancelLabel.length).toBeGreaterThan(0);
      // The dialog copy must be Arabic, not the backend's English wording.
      expect(plan.title).toMatch(/[؀-ۿ]/);
      expect(plan.message).toMatch(/[؀-ۿ]/);
    }
  });

  it('gives every team-scoped plan the id it needs to act on', () => {
    const deleting = planSubjectCleanup({
      mine: myState({ team: teamSummary({ id: 'team-a' }) }),
      viewer: viewer({ isCreator: true }),
    });
    const leaving = planSubjectCleanup({
      mine: myState({ team: teamSummary({ id: 'team-b' }) }),
      viewer: viewer({ isMember: true }),
    });
    const cancelling = planSubjectCleanup({
      mine: myState({
        team: teamSummary({ id: 'team-c' }),
        pendingRequest: { id: 'req-c', slotId: null, status: 'PENDING' },
      }),
      viewer: viewer(),
    });

    expect(deleting.teamId).toBe('team-a');
    expect(leaving.teamId).toBe('team-b');
    expect(cancelling.teamId).toBe('team-c');
    expect(cancelling.requestId).toBe('req-c');
  });
});
