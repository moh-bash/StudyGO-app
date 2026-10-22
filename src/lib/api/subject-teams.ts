/**
 * Typed route bindings for the Phase 5 subject-team endpoints.
 *
 * Everything lives under `/teams/subject` (`SubjectTeamsController`) so it never
 * collides with the pre-existing generic `/teams/:id` routes. Thin wrappers over
 * {@link apiRequest}: they hold no UI or selection state, and the server always
 * re-derives eligibility from the authenticated caller — the `sectionId` sent
 * here is the student's *local* planning pick, not an authorization claim.
 *
 * Endpoints
 * ---------
 * - `POST   /teams/subject`                        create a team (creator = first member)
 * - `GET    /teams/subject/mine`                   caller's own team/request state
 * - `GET    /teams/subject`                        list visible teams for subject+term
 * - `GET    /teams/subject/:id`                    team detail with task slots
 * - `PATCH  /teams/subject/:id`                    edit permitted fields (creator only)
 * - `POST   /teams/subject/:id/join-requests`      request a specific open slot
 * - `GET    /teams/subject/:id/join-requests`      list requests (creator only)
 * - `PATCH  /teams/subject/:id/join-requests/:requestId`  accept / reject (creator only)
 * - `DELETE /teams/subject/:id/join-requests/:requestId`  cancel own request
 * - `DELETE /teams/subject/:id/members/me`         leave the team (releases my slot)
 * - `DELETE /teams/subject/:id`                    delete my team (creator only)
 *
 * Responses are validated at runtime before reaching the UI.
 */
import { apiRequest } from './client';
import { ResponseParseError } from './errors';

/** Eligibility scope of a team (mirrors the backend `TeamScope` enum). */
export type SubjectTeamScope = 'SECTION' | 'PROFESSOR';

/** Supported external contact methods (mirrors the backend `TeamContactMethod`). */
export type SubjectTeamContactMethod = 'WHATSAPP_PHONE' | 'TELEGRAM' | 'GROUP_LINK';

/** Task-slot state (mirrors the backend `TeamTaskSlotState`). */
export type SubjectTeamSlotState = 'OPEN' | 'JOINED';

/** Join-request status (mirrors the backend `JoinRequestStatus`). */
export type SubjectJoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** A team as returned by the list/mine endpoints. */
export interface SubjectTeamSummary {
  id: string;
  name: string;
  description: string | null;
  subjectId: string | null;
  subjectNameAr: string | null;
  semesterId: string | null;
  semesterName: string | null;
  sectionId: string | null;
  sectionCode: string | null;
  professorId: string | null;
  professorName: string | null;
  scope: SubjectTeamScope;
  creatorId: string;
  creatorName: string;
  maxMembers: number;
  memberCount: number;
  openSlotCount: number;
  contactMethod: SubjectTeamContactMethod | null;
  /** Only present when the caller is the creator or an accepted member. */
  contactValue: string | null;
  createdAt: string;
}

/** One task slot on a team. */
export interface SubjectTeamSlot {
  id: string;
  position: number;
  taskDescription: string;
  state: SubjectTeamSlotState;
  memberId: string | null;
  memberName: string | null;
  /** Only surfaced to the creator for a pending request. */
  pendingRequestStudentId: string | null;
}

/** Full team detail, including slots, (permitted) members and the viewer's role. */
export interface SubjectTeamDetail extends SubjectTeamSummary {
  slots: SubjectTeamSlot[];
  members: {
    userId: string;
    fullName: string;
    role: 'OWNER' | 'MEMBER';
    slotId: string | null;
  }[];
  viewer: {
    isCreator: boolean;
    isMember: boolean;
    membershipSlotId: string | null;
    pendingRequestSlotId: string | null;
    pendingRequestId: string | null;
  };
}

/** The caller's own state for a subject+term. */
export interface MySubjectTeamState {
  team: SubjectTeamSummary | null;
  membershipSlotId: string | null;
  pendingRequest: {
    id: string;
    slotId: string | null;
    status: SubjectJoinRequestStatus;
  } | null;
  /** True when the caller currently has a usable section for this subject+term. */
  hasEligibleSection: boolean;
}

/** A join request as seen by the creator. */
export interface CreatorJoinRequest {
  id: string;
  status: SubjectJoinRequestStatus;
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  studentId: string;
  studentName: string;
  slotId: string | null;
  slotPosition: number | null;
  taskDescription: string | null;
}

/** A page of teams, matching the backend pagination envelope. */
export interface SubjectTeamPage {
  data: SubjectTeamSummary[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateSubjectTeamInput {
  name: string;
  description?: string;
  subjectId: string;
  /** The student's own section for this subject+term (validated server-side). */
  sectionId: string;
  semesterId: string;
  scope: SubjectTeamScope;
  /** Total members including the creator; must equal `taskSlots.length`. */
  maxMembers: number;
  taskSlots: { taskDescription: string }[];
  contactMethod: SubjectTeamContactMethod;
  contactValue: string;
}

export interface UpdateSubjectTeamInput {
  description?: string;
  contactMethod?: SubjectTeamContactMethod;
  contactValue?: string;
  taskSlots?: { id: string; taskDescription: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fail(what: string): never {
  throw new ResponseParseError(`Malformed subject-team response: ${what}.`);
}

function str(value: unknown, what: string, nullable = false): string | null {
  if (value === null && nullable) {
    return null;
  }
  if (typeof value !== 'string') {
    fail(what);
  }
  return value;
}

function num(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(what);
  }
  return value;
}

function parseSlot(value: unknown): SubjectTeamSlot {
  if (!isRecord(value)) {
    fail('task slot is not an object');
  }
  return {
    id: str(value.id, 'slot.id') as string,
    position: num(value.position, 'slot.position'),
    taskDescription: str(value.taskDescription, 'slot.taskDescription') as string,
    state: str(value.state, 'slot.state') as SubjectTeamSlotState,
    memberId: str(value.memberId, 'slot.memberId', true),
    memberName: str(value.memberName, 'slot.memberName', true),
    pendingRequestStudentId: str(
      value.pendingRequestStudentId,
      'slot.pendingRequestStudentId',
      true,
    ),
  };
}

function parseSummary(value: unknown): SubjectTeamSummary {
  if (!isRecord(value)) {
    fail('team is not an object');
  }
  return {
    id: str(value.id, 'team.id') as string,
    name: str(value.name, 'team.name') as string,
    description: str(value.description, 'team.description', true),
    subjectId: str(value.subjectId, 'team.subjectId', true),
    subjectNameAr: str(value.subjectNameAr, 'team.subjectNameAr', true),
    semesterId: str(value.semesterId, 'team.semesterId', true),
    semesterName: str(value.semesterName, 'team.semesterName', true),
    sectionId: str(value.sectionId, 'team.sectionId', true),
    sectionCode: str(value.sectionCode, 'team.sectionCode', true),
    professorId: str(value.professorId, 'team.professorId', true),
    professorName: str(value.professorName, 'team.professorName', true),
    scope: str(value.scope, 'team.scope') as SubjectTeamScope,
    creatorId: str(value.creatorId, 'team.creatorId') as string,
    creatorName: str(value.creatorName, 'team.creatorName') as string,
    maxMembers: num(value.maxMembers, 'team.maxMembers'),
    memberCount: num(value.memberCount, 'team.memberCount'),
    openSlotCount: num(value.openSlotCount, 'team.openSlotCount'),
    contactMethod: str(value.contactMethod, 'team.contactMethod', true) as
      | SubjectTeamContactMethod
      | null,
    contactValue: str(value.contactValue, 'team.contactValue', true),
    createdAt: str(value.createdAt, 'team.createdAt') as string,
  };
}

/** Validates and narrows a single team detail payload. */
export function parseTeamDetail(value: unknown): SubjectTeamDetail {
  const base = parseSummary(value);
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.slots)) {
    fail('team.slots is not an array');
  }
  if (!Array.isArray(record.members)) {
    fail('team.members is not an array');
  }
  if (!isRecord(record.viewer)) {
    fail('team.viewer is not an object');
  }
  const viewer = record.viewer;
  return {
    ...base,
    slots: record.slots.map(parseSlot),
    members: record.members.map((member) => {
      if (!isRecord(member)) {
        fail('member is not an object');
      }
      return {
        userId: str(member.userId, 'member.userId') as string,
        fullName: str(member.fullName, 'member.fullName') as string,
        role: str(member.role, 'member.role') as 'OWNER' | 'MEMBER',
        slotId: str(member.slotId, 'member.slotId', true),
      };
    }),
    viewer: {
      isCreator: viewer.isCreator === true,
      isMember: viewer.isMember === true,
      membershipSlotId: str(viewer.membershipSlotId, 'viewer.membershipSlotId', true),
      pendingRequestSlotId: str(
        viewer.pendingRequestSlotId,
        'viewer.pendingRequestSlotId',
        true,
      ),
      pendingRequestId: str(viewer.pendingRequestId, 'viewer.pendingRequestId', true),
    },
  };
}

function parseCreatorRequest(value: unknown): CreatorJoinRequest {
  if (!isRecord(value)) {
    fail('join request is not an object');
  }
  return {
    id: str(value.id, 'request.id') as string,
    status: str(value.status, 'request.status') as SubjectJoinRequestStatus,
    message: str(value.message, 'request.message', true),
    createdAt: str(value.createdAt, 'request.createdAt') as string,
    decidedAt: str(value.decidedAt, 'request.decidedAt', true),
    studentId: str(value.studentId, 'request.studentId') as string,
    studentName: str(value.studentName, 'request.studentName') as string,
    slotId: str(value.slotId, 'request.slotId', true),
    slotPosition: value.slotPosition === null ? null : num(value.slotPosition, 'request.slotPosition'),
    taskDescription: str(value.taskDescription, 'request.taskDescription', true),
  };
}

export function parseMyState(value: unknown): MySubjectTeamState {
  if (!isRecord(value)) {
    fail('mine is not an object');
  }
  const pending = value.pendingRequest;
  return {
    team: value.team === null ? null : parseSummary(value.team),
    membershipSlotId: str(value.membershipSlotId, 'mine.membershipSlotId', true),
    pendingRequest:
      pending === null
        ? null
        : (() => {
            if (!isRecord(pending)) {
              fail('mine.pendingRequest is not an object');
            }
            return {
              id: str(pending.id, 'pending.id') as string,
              slotId: str(pending.slotId, 'pending.slotId', true),
              status: str(pending.status, 'pending.status') as SubjectJoinRequestStatus,
            };
          })(),
    hasEligibleSection: value.hasEligibleSection === true,
  };
}

export function parseTeamPage(value: unknown): SubjectTeamPage {
  if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.meta)) {
    fail('page envelope is malformed');
  }
  const meta = value.meta;
  return {
    data: value.data.map(parseSummary),
    meta: {
      page: num(meta.page, 'meta.page'),
      limit: num(meta.limit, 'meta.limit'),
      total: num(meta.total, 'meta.total'),
      totalPages: num(meta.totalPages, 'meta.totalPages'),
    },
  };
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const serialized = search.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

export const subjectTeamsApi = {
  /** `GET /teams/subject/mine` — the caller's own team/request state. */
  mine: (
    params: { subjectId: string; semesterId: string; sectionId?: string },
    options?: { signal?: AbortSignal },
  ): Promise<MySubjectTeamState> =>
    apiRequest<unknown>(
      `/teams/subject/mine${query({
        subjectId: params.subjectId,
        semesterId: params.semesterId,
        sectionId: params.sectionId,
      })}`,
      { auth: true, signal: options?.signal },
    ).then(parseMyState),

  /** `GET /teams/subject` — teams visible to the caller for a subject+term. */
  list: (
    params: {
      subjectId: string;
      semesterId: string;
      sectionId?: string;
      scope?: SubjectTeamScope;
      search?: string;
      page?: number;
      limit?: number;
    },
    options?: { signal?: AbortSignal },
  ): Promise<SubjectTeamPage> =>
    apiRequest<unknown>(
      `/teams/subject${query({
        subjectId: params.subjectId,
        semesterId: params.semesterId,
        sectionId: params.sectionId,
        scope: params.scope,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
      { auth: true, signal: options?.signal },
    ).then(parseTeamPage),

  /**
   * `GET /teams/subject/:id` — team detail with its task slots.
   *
   * `sectionId` is the section the student currently has selected for this
   * subject+term. The server re-derives the caller's eligibility from it, so a
   * section-scoped team is only visible to the students of that section.
   */
  detail: (
    teamId: string,
    params?: { sectionId?: string },
    options?: { signal?: AbortSignal },
  ): Promise<SubjectTeamDetail> =>
    apiRequest<unknown>(
      `/teams/subject/${teamId}${query({ sectionId: params?.sectionId })}`,
      { auth: true, signal: options?.signal },
    ).then(parseTeamDetail),

  /** `POST /teams/subject` — create a team; the creator becomes the first member. */
  create: (input: CreateSubjectTeamInput): Promise<SubjectTeamDetail> =>
    apiRequest<unknown>('/teams/subject', { auth: true, method: 'POST', body: input }).then(
      parseTeamDetail,
    ),

  /** `PATCH /teams/subject/:id` — edit permitted fields (creator only). */
  update: (teamId: string, input: UpdateSubjectTeamInput): Promise<SubjectTeamDetail> =>
    apiRequest<unknown>(`/teams/subject/${teamId}`, {
      auth: true,
      method: 'PATCH',
      body: input,
    }).then(parseTeamDetail),

  /**
   * `POST /teams/subject/:id/join-requests` — request a specific open slot.
   *
   * `sectionId` is the section the student currently has selected: the server
   * checks that the student and the team belong to the same section before it
   * accepts the request.
   */
  requestJoin: (
    teamId: string,
    input: { slotId: string; message?: string },
    params?: { sectionId?: string },
  ): Promise<CreatorJoinRequest> =>
    apiRequest<unknown>(`/teams/subject/${teamId}/join-requests${query({ sectionId: params?.sectionId })}`, {
      auth: true,
      method: 'POST',
      body: input,
    }).then(parseCreatorRequest),

  /** `GET /teams/subject/:id/join-requests` — list requests (creator only). */
  listRequests: (
    teamId: string,
    params?: { status?: SubjectJoinRequestStatus },
    options?: { signal?: AbortSignal },
  ): Promise<CreatorJoinRequest[]> =>
    apiRequest<unknown>(
      `/teams/subject/${teamId}/join-requests${query({ status: params?.status })}`,
      { auth: true, signal: options?.signal },
    ).then((value) => {
      if (!Array.isArray(value)) {
        fail('join requests is not an array');
      }
      return value.map(parseCreatorRequest);
    }),

  /** `PATCH /teams/subject/:id/join-requests/:requestId` — accept or reject. */
  decideRequest: (
    teamId: string,
    requestId: string,
    approve: boolean,
  ): Promise<CreatorJoinRequest> =>
    apiRequest<unknown>(`/teams/subject/${teamId}/join-requests/${requestId}`, {
      auth: true,
      method: 'PATCH',
      body: { approve },
    }).then(parseCreatorRequest),

  /** `DELETE /teams/subject/:id/join-requests/:requestId` — cancel own request. */
  cancelRequest: (teamId: string, requestId: string): Promise<void> =>
    apiRequest<void>(`/teams/subject/${teamId}/join-requests/${requestId}`, {
      auth: true,
      method: 'DELETE',
    }),

  /**
   * `DELETE /teams/subject/:id` — delete my team.
   *
   * Only the creator may do this: the server rejects the request for anyone
   * else. The whole team goes with it (every membership and every pending
   * join request), so the caller confirms the impact first.
   */
  remove: (teamId: string): Promise<void> =>
    apiRequest<void>(`/teams/subject/${teamId}`, { auth: true, method: 'DELETE' }),

  /**
   * `DELETE /teams/subject/:id/members/me` — leave the team.
   *
   * Removes only the caller's own membership and releases their task slot; the
   * team and its other members stay untouched. The creator cannot leave — they
   * have to delete the team instead.
   */
  leave: (teamId: string): Promise<void> =>
    apiRequest<void>(`/teams/subject/${teamId}/members/me`, { auth: true, method: 'DELETE' }),
};
