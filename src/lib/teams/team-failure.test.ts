/**
 * Unit tests for the Arabic team-failure wording.
 *
 * Two rules are pinned here:
 *
 * 1. The user never sees the backend's English exception text.
 * 2. Only a genuine transport failure is worded as a connectivity problem — a
 *    timeout is a slow server, and an HTTP status is the backend answering.
 */
import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '../api/errors';
import {
  describeTeamFailure,
  teamFailureNotice,
  type TeamLifecycleAction,
} from './team-failure';

const ACTIONS: TeamLifecycleAction[] = [
  'delete-team',
  'leave-team',
  'cancel-request',
  'verify',
  'create-team',
  'open-team',
  'join-team',
  'update-team',
  'decide-request',
];

describe('describeTeamFailure', () => {
  it('words an unauthorized delete as a creator-only rule', () => {
    const wording = describeTeamFailure(new ApiError('Only the team creator can perform this action', 403, null), 'delete-team');

    expect(wording.title).toBe('تعذّر حذف الفريق');
    expect(wording.message).toContain('منشئه فقط');
    expect(wording.message).not.toContain('Only the team creator');
    expect(wording.offline).toBe(false);
  });

  it('words an expired session as a sign-in problem, not an offline one', () => {
    const wording = describeTeamFailure(new ApiError('Unauthorized', 401, null), 'delete-team');

    expect(wording.message).toContain('سجّل الدخول');
    expect(wording.offline).toBe(false);
  });

  it('words a missing team as "already gone"', () => {
    const wording = describeTeamFailure(new ApiError('Team not found', 404, null), 'delete-team');

    expect(wording.message).toContain('غير موجود');
  });

  it('words a creator who tried to leave as "delete it instead"', () => {
    const wording = describeTeamFailure(
      new ApiError('The team creator cannot leave the team; delete the team instead', 400, null),
      'leave-team',
    );

    expect(wording.message).toContain('حذف الفريق بدل مغادرته');
    expect(wording.message).not.toContain('creator cannot leave');
  });

  it('treats a transport failure as the only connectivity problem', () => {
    const wording = describeTeamFailure(new NetworkError('offline', undefined, 'transport'), 'delete-team');

    expect(wording.offline).toBe(true);
    expect(wording.message).toContain('اتصالك بالإنترنت');
  });

  it('never calls a timeout a connectivity problem', () => {
    const wording = describeTeamFailure(new NetworkError('timeout', undefined, 'timeout'), 'delete-team');

    expect(wording.offline).toBe(false);
    expect(wording.message).toContain('وقتًا طويلًا');
    expect(wording.message).not.toContain('اتصالك بالإنترنت');
  });

  it('stays neutral for a cancelled request', () => {
    const wording = describeTeamFailure(new NetworkError('aborted', undefined, 'aborted'), 'delete-team');

    expect(wording.offline).toBe(false);
    expect(wording.message).toContain('تم إلغاء العملية');
  });

  it('words a server error as a server problem', () => {
    const wording = describeTeamFailure(new ApiError('boom', 500, null), 'leave-team');

    expect(wording.message).toContain('خطأ في الخادم');
    expect(wording.offline).toBe(false);
  });

  it('falls back to neutral wording for an unknown failure', () => {
    const wording = describeTeamFailure(new Error('what'), 'cancel-request');

    expect(wording.message).toBe('تعذّر إكمال العملية. حاول مرة أخرى.');
    expect(wording.offline).toBe(false);
  });

  it('gives every action its own Arabic title and never an English one', () => {
    for (const action of ACTIONS) {
      const wording = describeTeamFailure(new Error('x'), action);
      expect(wording.title.length).toBeGreaterThan(0);
      expect(wording.title).toMatch(/[؀-ۿ]/);
      expect(wording.message).toMatch(/[؀-ۿ]/);
    }
  });

  it('names the real reason when a section has no assigned professor', () => {
    const wording = describeTeamFailure(
      new ApiError('The selected section has no assigned professor', 400, null),
      'create-team',
    );

    // The student *did* select a section: the wording must not claim that no
    // section was selected.
    expect(wording.message).toContain('أستاذ مسؤول');
    expect(wording.message).not.toContain('تحتاج إلى شعبة');
    expect(wording.message).not.toContain('The selected section');
  });

  it('explains that a team outside the selected section is not available', () => {
    const wording = describeTeamFailure(new ApiError('Team not found', 404, null), 'open-team');

    expect(wording.message).toContain('شعبتك المختارة');
    expect(wording.message).not.toContain('Team not found');
  });
});

describe('teamFailureNotice', () => {
  it('never shows the backend English message in the panel banner', () => {
    const notice = teamFailureNotice(new ApiError('Team not found', 404, null), false, 'open-team');

    expect(notice.message).not.toContain('Team not found');
    expect(notice.message).toContain('شعبتك المختارة');
    expect(notice.offline).toBe(false);
  });

  it('keeps the connection wording for a transport failure', () => {
    const notice = teamFailureNotice(
      new NetworkError('offline', undefined, 'transport'),
      false,
      'open-team',
    );

    expect(notice.offline).toBe(true);
    expect(notice.message).toContain('اتصالك بالإنترنت');
  });

  it('stays silent when a transport failure happens with data already on screen', () => {
    const notice = teamFailureNotice(
      new NetworkError('offline', undefined, 'transport'),
      true,
      'open-team',
    );

    expect(notice.message).toBeNull();
    expect(notice.offline).toBe(true);
  });
});
