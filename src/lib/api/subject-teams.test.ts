/**
 * Unit tests for the subject-team API bindings.
 *
 * `fetch` and secure storage are mocked; no real backend or device is used.
 * These assert URL/query construction and the runtime response validators, which
 * is where a client-side mistake would silently enable an ineligible view.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponseParseError } from './errors';
import { parseMyState, parseTeamDetail, parseTeamPage, subjectTeamsApi } from './subject-teams';

vi.mock('../storage/token-storage', () => ({
  TokenStorageError: class TokenStorageError extends Error {},
  tokenStorage: {
    getAccessToken: async () => 'test-token',
    getRefreshToken: async () => null,
    getTokens: async () => null,
    saveTokens: async () => {},
    clearTokens: async () => {},
  },
}));

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://test.local';
});

afterEach(() => {
  vi.restoreAllMocks();
});

const teamSummary = {
  id: 't1',
  name: 'فريق',
  description: null,
  subjectId: 's1',
  subjectNameAr: 'مادة',
  semesterId: 'm1',
  semesterName: 'الفصل',
  sectionId: 'c1',
  sectionCode: 'A1',
  professorId: 'p1',
  professorName: 'أحمد',
  scope: 'SECTION',
  creatorId: 'u1',
  creatorName: 'المالك',
  maxMembers: 3,
  memberCount: 1,
  openSlotCount: 2,
  contactMethod: 'TELEGRAM',
  contactValue: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('subjectTeamsApi URL construction', () => {
  it('sends subject+term+section as query on GET /teams/subject/mine', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        team: null,
        membershipSlotId: null,
        pendingRequest: null,
        hasEligibleSection: true,
      }),
    );

    await subjectTeamsApi.mine({ subjectId: 's1', semesterId: 'm1', sectionId: 'c1' });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(String(url)).toContain('/teams/subject/mine');
    expect(String(url)).toContain('subjectId=s1');
    expect(String(url)).toContain('semesterId=m1');
    expect(String(url)).toContain('sectionId=c1');
  });

  it('omits undefined query parameters', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }));

    await subjectTeamsApi.list({ subjectId: 's1', semesterId: 'm1' });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(String(url)).not.toContain('sectionId');
    expect(String(url)).not.toContain('scope');
  });

  it('sends accept/reject as an explicit boolean body', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        id: 'r1',
        status: 'APPROVED',
        message: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        decidedAt: '2026-01-02T00:00:00.000Z',
        studentId: 'u2',
        studentName: 'طالب',
        slotId: 'slot1',
        slotPosition: 2,
        taskDescription: 'مهمة',
      }),
    );

    await subjectTeamsApi.decideRequest('t1', 'r1', true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/teams/subject/t1/join-requests/r1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ approve: true });
  });

  it('targets /teams/subject (never the generic /teams) for creation', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        ...teamSummary,
        slots: [],
        members: [],
        viewer: {
          isCreator: true,
          isMember: true,
          membershipSlotId: null,
          pendingRequestSlotId: null,
          pendingRequestId: null,
        },
      }),
    );

    await subjectTeamsApi.create({
      name: 'فريق',
      subjectId: 's1',
      sectionId: 'c1',
      semesterId: 'm1',
      scope: 'SECTION',
      maxMembers: 2,
      taskSlots: [{ taskDescription: 'مهمة أ' }, { taskDescription: 'مهمة ب' }],
      contactMethod: 'TELEGRAM',
      contactValue: 'group',
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(String(url).endsWith('/teams/subject')).toBe(true);
  });

  it('deletes the team through DELETE /teams/subject/:id', async () => {
    fetchMock.mockResolvedValueOnce(json(204, undefined));

    await subjectTeamsApi.remove('t1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/teams/subject/t1');
    expect(String(url)).not.toContain('/members/me');
    expect(init.method).toBe('DELETE');
  });

  it('leaves the team through DELETE /teams/subject/:id/members/me', async () => {
    fetchMock.mockResolvedValueOnce(json(204, undefined));

    await subjectTeamsApi.leave('t1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/teams/subject/t1/members/me');
    expect(init.method).toBe('DELETE');
  });

  it('sends the selected section when opening a team', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        ...teamSummary,
        slots: [],
        members: [],
        viewer: {
          isCreator: false,
          isMember: false,
          membershipSlotId: null,
          pendingRequestSlotId: null,
          pendingRequestId: null,
        },
      }),
    );

    await subjectTeamsApi.detail('t1', { sectionId: 'c1' });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(String(url)).toContain('/teams/subject/t1');
    expect(String(url)).toContain('sectionId=c1');
  });

  it('omits the section when the student has none', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        ...teamSummary,
        slots: [],
        members: [],
        viewer: {
          isCreator: false,
          isMember: false,
          membershipSlotId: null,
          pendingRequestSlotId: null,
          pendingRequestId: null,
        },
      }),
    );

    await subjectTeamsApi.detail('t1');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(String(url)).not.toContain('sectionId');
  });

  it('sends the selected section when requesting to join a team', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        id: 'r1',
        status: 'PENDING',
        message: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        decidedAt: null,
        studentId: 'u2',
        studentName: 'طالب',
        slotId: 'slot1',
        slotPosition: 2,
        taskDescription: 'مهمة',
      }),
    );

    await subjectTeamsApi.requestJoin('t1', { slotId: 'slot1' }, { sectionId: 'c1' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/teams/subject/t1/join-requests');
    expect(String(url)).toContain('sectionId=c1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ slotId: 'slot1' });
  });
});

describe('runtime response validation', () => {
  it('rejects a malformed team detail (missing slots)', () => {
    expect(() => parseTeamDetail({ ...teamSummary })).toThrow(ResponseParseError);
  });

  it('rejects a team whose numeric field is a string', () => {
    expect(() =>
      parseTeamDetail({
        ...teamSummary,
        maxMembers: '3',
        slots: [],
        members: [],
        viewer: {
          isCreator: false,
          isMember: false,
          membershipSlotId: null,
          pendingRequestSlotId: null,
          pendingRequestId: null,
        },
      }),
    ).toThrow(ResponseParseError);
  });

  it('reads viewer booleans strictly, so a non-true value is not treated as creator', () => {
    const detail = parseTeamDetail({
      ...teamSummary,
      slots: [],
      members: [],
      viewer: {
        isCreator: 'true',
        isMember: 1,
        membershipSlotId: null,
        pendingRequestSlotId: null,
        pendingRequestId: null,
      },
    });
    expect(detail.viewer.isCreator).toBe(false);
    expect(detail.viewer.isMember).toBe(false);
  });

  it('rejects a viewer missing its nullable slot fields', () => {
    expect(() =>
      parseTeamDetail({ ...teamSummary, slots: [], members: [], viewer: {} }),
    ).toThrow(ResponseParseError);
  });

  it('parses a page envelope and its meta', () => {
    const page = parseTeamPage({
      data: [teamSummary],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(page.data).toHaveLength(1);
    expect(page.meta.total).toBe(1);
  });

  it('rejects a page missing its meta envelope', () => {
    expect(() => parseTeamPage({ data: [] })).toThrow(ResponseParseError);
  });

  it('parses mine with a pending request', () => {
    const state = parseMyState({
      team: null,
      membershipSlotId: null,
      pendingRequest: { id: 'r1', slotId: 'slot1', status: 'PENDING' },
      hasEligibleSection: true,
    });
    expect(state.pendingRequest?.status).toBe('PENDING');
    expect(state.hasEligibleSection).toBe(true);
  });

  it('rejects a request list that is not an array', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: [] }));
    await expect(subjectTeamsApi.listRequests('t1')).rejects.toBeInstanceOf(ResponseParseError);
  });
});
