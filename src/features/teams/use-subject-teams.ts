/**
 * Data hook for the Phase 5 Teams tab.
 *
 * Owns all server interaction for one subject+term: the caller's own state, the
 * visible team list, a selected team's detail, the creator's request queue, and
 * the mutations (create, edit, request, decide, cancel).
 *
 * Design notes
 * ------------
 * - The subject+term+section are the *inputs*; nothing is refetched with stale
 *   values, and every mutation re-reads the affected slices so the UI never
 *   shows an outdated member count or slot state.
 * - `sectionId` is the student's local planning pick (`useStudyPlan`). It is a
 *   hint for eligibility, never an authorization claim: the server re-derives
 *   what the caller may see.
 * - `react-hooks/set-state-in-effect` is satisfied by writing state only after
 *   an `await`, guarded by an `active` flag.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  subjectTeamsApi,
  type CreateSubjectTeamInput,
  type CreatorJoinRequest,
  type MySubjectTeamState,
  type SubjectTeamDetail,
  type SubjectTeamSummary,
  type UpdateSubjectTeamInput,
} from '@/lib/api/subject-teams';
import { teamFailureNotice } from '@/lib/teams/team-failure';

export interface TeamsScope {
  subjectId: string;
  semesterId: string;
  /** The student's local section pick for this subject+term, when any. */
  sectionId: string | null;
}

/** Stable empty list so a scope change never re-creates the array identity. */
const NO_TEAMS: SubjectTeamSummary[] = [];

export interface UseSubjectTeamsResult {
  loading: boolean;
  error: string | null;
  /**
   * True when the last failure was a genuine transport failure (the device could
   * not reach the backend) rather than the server answering with an error. The
   * UI uses it to word the retry affordance as a connectivity problem only when
   * that is actually the case (see `lib/api/connection.ts`).
   */
  offline: boolean;
  myState: MySubjectTeamState | null;
  teams: SubjectTeamSummary[];
  detail: SubjectTeamDetail | null;
  requests: CreatorJoinRequest[];
  reload: () => Promise<void>;
  openTeam: (teamId: string) => Promise<void>;
  closeTeam: () => void;
  refreshRequests: () => Promise<void>;
  createTeam: (input: CreateSubjectTeamInput) => Promise<void>;
  updateTeam: (teamId: string, input: UpdateSubjectTeamInput) => Promise<void>;
  requestJoin: (teamId: string, slotId: string, message?: string) => Promise<void>;
  decideRequest: (teamId: string, requestId: string, approve: boolean) => Promise<void>;
  cancelRequest: (teamId: string, requestId: string) => Promise<void>;
  /**
   * Deletes a team. The server accepts this for the creator only; the UI only
   * offers it to the creator. The whole team goes with it — every membership
   * and every pending join request.
   */
  deleteTeam: (teamId: string) => Promise<void>;
  /**
   * Leaves a team: only the caller's own membership and task slot are
   * dropped. The team and its other members stay untouched.
   */
  leaveTeam: (teamId: string) => Promise<void>;
}

export function useSubjectTeams(scope: TeamsScope | null): UseSubjectTeamsResult {
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  // The caller's own state and the team list are tagged with the scope they
  // belong to. They are only handed to the UI while that scope is still the
  // current one, so switching section never shows the previous section's
  // eligibility banner or teams.
  const [myState, setMyState] = useState<{
    key: string | null;
    state: MySubjectTeamState;
  } | null>(null);
  const [teams, setTeams] = useState<{
    key: string | null;
    items: SubjectTeamSummary[];
  } | null>(null);
  const [detail, setDetail] = useState<{ key: string | null; team: SubjectTeamDetail } | null>(null);
  const [requests, setRequests] = useState<CreatorJoinRequest[]>([]);
  // A resolved snapshot tagged with the scope it belongs to: `loading` is then
  // derived ("scope known, snapshot not yet loaded") instead of being written
  // synchronously from an effect, and a scope change can never show another
  // subject's teams even for a frame.
  const [snapshotKey, setSnapshotKey] = useState<string | null>(null);
  const active = useRef(true);
  // Mirrors "are teams currently on screen?" without making `load` depend on the
  // team list (which would recreate `load` and restart the effect on every
  // refresh — a refetch loop). Updated where the list is actually written.
  const hasTeamsRef = useRef(false);

  const subjectId = scope?.subjectId ?? null;
  const semesterId = scope?.semesterId ?? null;
  const sectionId = scope?.sectionId ?? null;
  const scopeKey =
    subjectId && semesterId ? `${subjectId}|${semesterId}|${sectionId ?? ''}` : null;

  // Clears both error slices together so a stale "offline" wording never
  // outlives the error it belonged to.
  const clearError = useCallback(() => {
    setError(null);
    setOffline(false);
  }, []);

  const load = useCallback((): Promise<void> => {
    if (!subjectId || !semesterId) {
      return Promise.resolve();
    }
    const key = `${subjectId}|${semesterId}|${sectionId ?? ''}`;
    // The body is started synchronously but every `setState` happens only after
    // an `await`, so the effect below never triggers a cascading render.
    return (async () => {
      try {
        const [mine, page] = await Promise.all([
          subjectTeamsApi.mine({
            subjectId,
            semesterId,
            sectionId: sectionId ?? undefined,
          }),
          subjectTeamsApi.list({
            subjectId,
            semesterId,
            sectionId: sectionId ?? undefined,
            page: 1,
            limit: 20,
          }),
        ]);
        if (!active.current) {
          return;
        }
        setMyState({ key, state: mine });
        setTeams({ key, items: page.data });
        hasTeamsRef.current = page.data.length > 0;
        setError(null);
        setOffline(false);
        setSnapshotKey(key);
      } catch (e) {
        if (active.current) {
          // A refresh that fails while teams are already on screen is not shown
          // as a connectivity problem: the data is still there.
          const info = teamFailureNotice(e, hasTeamsRef.current, 'open-team');
          setError(info.message);
          setOffline(info.offline);
          setSnapshotKey(key);
        }
      }
    })();
  }, [subjectId, semesterId, sectionId]);

  // The initial load runs after the first render; `load` only writes state after
  // an `await`, so the effect body itself never calls `setState` synchronously.
  // `loading` is derived from a load counter rather than set inside the effect.
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
  }, [load]);

  // A team detail belongs to one scope: drop it (and the request queue) the
  // moment the subject+term+section changes, so a stale team is never rendered
  // under a different subject. Derived during render, not from an effect.
  const scopedDetail = detail && detail.key === scopeKey ? detail.team : null;
  const scopedRequests = scopedDetail ? requests : [];
  // Same rule for the caller's own state and the team list: they belong to the
  // scope they were loaded for.
  const scopedMyState = myState && myState.key === scopeKey ? myState.state : null;
  const scopedTeams = teams && teams.key === scopeKey ? teams.items : NO_TEAMS;

  const openTeam = useCallback(
    async (teamId: string) => {
      clearError();
      try {
        // The selected section travels with the request: it is what proves the
        // caller belongs to the team's scope (the server re-derives it).
        const team = await subjectTeamsApi.detail(teamId, {
          sectionId: sectionId ?? undefined,
        });
        if (!active.current) {
          return;
        }
        setDetail({ key: scopeKey, team });
        // The creator sees the request queue for the team they just opened.
        if (team.viewer.isCreator) {
          try {
            const list = await subjectTeamsApi.listRequests(teamId, { status: 'PENDING' });
            if (active.current) {
              setRequests(list);
            }
          } catch {
            // A request-queue failure must not hide the team detail.
            if (active.current) {
              setRequests([]);
            }
          }
        } else if (active.current) {
          setRequests([]);
        }
      } catch (e) {
        if (active.current) {
          const info = teamFailureNotice(e, false, 'open-team');
          setError(info.message);
          setOffline(info.offline);
        }
      }
    },
    [scopeKey, sectionId, clearError],
  );

  const closeTeam = useCallback(() => {
    setDetail(null);
    setRequests([]);
  }, []);

  const refreshRequests = useCallback(async () => {
    if (!scopedDetail?.viewer.isCreator) {
      return;
    }
    try {
      const list = await subjectTeamsApi.listRequests(scopedDetail.id, { status: 'PENDING' });
      if (active.current) {
        setRequests(list);
      }
    } catch (e) {
      if (active.current) {
        const info = teamFailureNotice(e, false, 'open-team');
        setError(info.message);
        setOffline(info.offline);
      }
    }
  }, [scopedDetail]);

  const attachDetail = useCallback(
    (team: SubjectTeamDetail) => {
      setDetail({ key: scopeKey, team });
    },
    [scopeKey],
  );

  const createTeam = useCallback(
    async (input: CreateSubjectTeamInput) => {
      clearError();
      const created = await subjectTeamsApi.create(input);
      if (!active.current) {
        return;
      }
      attachDetail(created);
      await load();
      if (created.viewer.isCreator) {
        const list = await subjectTeamsApi.listRequests(created.id, { status: 'PENDING' });
        if (active.current) {
          setRequests(list);
        }
      }
    },
    [load, attachDetail, clearError],
  );

  const updateTeam = useCallback(
    async (teamId: string, input: UpdateSubjectTeamInput) => {
      clearError();
      const updated = await subjectTeamsApi.update(teamId, input);
      if (active.current) {
        attachDetail(updated);
      }
      await load();
    },
    [load, attachDetail, clearError],
  );

  const requestJoin = useCallback(
    async (teamId: string, slotId: string, message?: string) => {
      clearError();
      // The selected section travels with the request so the server can check
      // that the student and the team share it.
      await subjectTeamsApi.requestJoin(
        teamId,
        { slotId, message },
        { sectionId: sectionId ?? undefined },
      );
      await load();
      // Re-read the opened team so the slot shows its new reservation.
      if (scopedDetail?.id === teamId) {
        await openTeam(teamId);
      }
    },
    [load, scopedDetail, openTeam, clearError, sectionId],
  );

  const decideRequest = useCallback(
    async (teamId: string, requestId: string, approve: boolean) => {
      clearError();
      await subjectTeamsApi.decideRequest(teamId, requestId, approve);
      await Promise.all([refreshRequests(), load()]);
      if (scopedDetail?.id === teamId) {
        await openTeam(teamId);
      }
    },
    [refreshRequests, load, scopedDetail, openTeam, clearError],
  );

  const cancelRequest = useCallback(
    async (teamId: string, requestId: string) => {
      clearError();
      await subjectTeamsApi.cancelRequest(teamId, requestId);
      await load();
      if (scopedDetail?.id === teamId) {
        await openTeam(teamId);
      }
    },
    [load, scopedDetail, openTeam, clearError],
  );

  /**
   * Deletes the team the caller created.
   *
   * The request is refused by the server for anybody who is not the creator,
   * so this is never called for someone else's team. Once the team is gone
   * the detail view is closed and the list is re-read, so no screen keeps
   * showing a deleted team.
   */
  const deleteTeam = useCallback(
    async (teamId: string) => {
      clearError();
      await subjectTeamsApi.remove(teamId);
      closeTeam();
      await load();
    },
    [clearError, closeTeam, load],
  );

  /**
   * Leaves the team: the caller's own membership and task slot are released,
   * the team and its other members stay as they are.
   */
  const leaveTeam = useCallback(
    async (teamId: string) => {
      clearError();
      await subjectTeamsApi.leave(teamId);
      closeTeam();
      await load();
    },
    [clearError, closeTeam, load],
  );

  return {
    loading: scopeKey !== null && snapshotKey !== scopeKey,
    error,
    offline,
    myState: scopedMyState,
    teams: scopedTeams,
    detail: scopedDetail,
    requests: scopedRequests,
    reload: load,
    openTeam,
    closeTeam,
    refreshRequests,
    createTeam,
    updateTeam,
    requestJoin,
    decideRequest,
    cancelRequest,
    deleteTeam,
    leaveTeam,
  };
}
