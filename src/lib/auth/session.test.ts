/**
 * Unit tests for the authentication session service: login, registration,
 * startup restore, refresh rotation, single-flight refresh, logout and the
 * important failure paths. Secure storage, the profile cache and `fetch` are
 * mocked — no real backend, credentials or device are used.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponseParseError } from '../api/errors';
import type { User } from '../api/types';
import { TokenStorageError } from '../storage/token-storage';
import * as session from './session';

const store = vi.hoisted(() => ({
  access: null as string | null,
  refresh: null as string | null,
  failSave: false,
}));
const profile = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('../storage/token-storage', () => {
  class TokenStorageError extends Error {
    constructor(message: string, readonly cause?: unknown) {
      super(message);
      this.name = 'TokenStorageError';
    }
  }
  return {
    TokenStorageError,
    tokenStorage: {
      getAccessToken: async () => store.access,
      getRefreshToken: async () => store.refresh,
      getTokens: async () =>
        store.access !== null && store.refresh !== null
          ? { accessToken: store.access, refreshToken: store.refresh }
          : null,
      saveTokens: async (t: { accessToken: string; refreshToken: string }) => {
        if (store.failSave) {
          throw new TokenStorageError('simulated secure-storage write failure');
        }
        store.access = t.accessToken;
        store.refresh = t.refreshToken;
      },
      clearTokens: async () => {
        store.access = null;
        store.refresh = null;
      },
    },
  };
});

vi.mock('../storage/profile-cache', () => ({
  saveProfile: async (u: unknown) => {
    profile.value = u;
  },
  getProfile: async () => profile.value,
  clearProfile: async () => {
    profile.value = null;
  },
}));

const USER: User = {
  id: 'user-1',
  fullName: 'Layla Haddad',
  email: 'layla@example.com',
  role: 'STUDENT',
  status: 'ACTIVE',
  profileImageUrl: null,
  studentUniversityId: null,
  phone: null,
  programId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function authBody(accessToken: string, refreshToken: string, user: User = USER) {
  return { accessToken, refreshToken, user };
}

function err(status: number, message = `failed ${status}`) {
  return { statusCode: status, error: 'Error', message };
}

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

type MockResponse =
  | { kind: 'http'; status: number; body: unknown }
  | { kind: 'network' }
  | { kind: 'hang' };
const routes = new Map<string, MockResponse[]>();

function on(method: string, suffix: string, ...responses: MockResponse[]) {
  routes.set(`${method.toUpperCase()} ${suffix}`, responses.slice());
}

/** An `AbortError`-shaped rejection, as the platform produces on abort. */
function abortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

/**
 * A request that never answers and only settles when its signal aborts —
 * the shape of a backend that is reachable but slower than the deadline.
 */
function hangUntilAborted(init?: RequestInit): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) {
      reject(new Error('expected an abort signal'));
      return;
    }
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    signal.addEventListener('abort', () => reject(abortError()));
  });
}

function mockFetch(input: unknown, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = (init?.method ?? 'GET').toUpperCase();
  for (const [key, queue] of routes) {
    const [m, suffix] = key.split(' ');
    if (m === method && url.endsWith(suffix)) {
      const next = queue.shift();
      if (!next) {
        throw new Error(`No queued response for ${method} ${url}`);
      }
      if (next.kind === 'network') {
        throw new TypeError('Network request failed');
      }
      if (next.kind === 'hang') {
        return hangUntilAborted(init);
      }
      return Promise.resolve(json(next.status, next.body));
    }
  }
  throw new Error(`No mock route for ${method} ${url}`);
}

const fetchMock = vi.fn(mockFetch);

function callsTo(method: string, suffix: string): number {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    return (init?.method ?? 'GET').toUpperCase() === method.toUpperCase() && String(call[0]).endsWith(suffix);
  }).length;
}

beforeEach(() => {
  store.access = null;
  store.refresh = null;
  store.failSave = false;
  profile.value = null;
  routes.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(mockFetch);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://test.local';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signIn', () => {
  it('persists tokens and profile on success', async () => {
    on('POST', '/auth/login', { kind: 'http', status: 200, body: authBody('a1', 'r1') });

    const user = await session.signIn('  Layla@Example.com ', 'Str0ngPass');

    expect(user).toMatchObject({ id: USER.id, fullName: USER.fullName });
    expect(store.access).toBe('a1');
    expect(store.refresh).toBe('r1');
    expect(profile.value).toMatchObject({ id: USER.id });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toEqual({ email: 'Layla@Example.com', password: 'Str0ngPass' });
  });

  it('does not authenticate or persist on invalid credentials', async () => {
    on('POST', '/auth/login', { kind: 'http', status: 401, body: err(401, 'Invalid email or password') });

    await expect(session.signIn('a@b.com', 'wrong')).rejects.toMatchObject({ statusCode: 401 });
    expect(store.access).toBeNull();
    expect(store.refresh).toBeNull();
    expect(profile.value).toBeNull();
  });

  it('rejects a malformed success body without persisting', async () => {
    on('POST', '/auth/login', { kind: 'http', status: 200, body: { accessToken: 123 } });

    await expect(session.signIn('a@b.com', 'Str0ngPass')).rejects.toBeInstanceOf(ResponseParseError);
    expect(store.access).toBeNull();
  });

  it('surfaces a secure-storage write failure instead of a false session', async () => {
    store.failSave = true;
    on('POST', '/auth/login', { kind: 'http', status: 200, body: authBody('a1', 'r1') });

    await expect(session.signIn('a@b.com', 'Str0ngPass')).rejects.toBeInstanceOf(TokenStorageError);
  });
});

describe('signUp', () => {
  it('follows the real register contract and persists the returned session', async () => {
    on('POST', '/auth/register', { kind: 'http', status: 201, body: authBody('a2', 'r2') });

    const user = await session.signUp({
      fullName: '  Layla Haddad ',
      email: ' layla@example.com ',
      password: 'Str0ngPass',
      programId: 'program-uuid-1',
    });

    expect(user.id).toBe(USER.id);
    expect(store.access).toBe('a2');
    expect(store.refresh).toBe('r2');
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toEqual({
      fullName: 'Layla Haddad',
      email: 'layla@example.com',
      password: 'Str0ngPass',
      programId: 'program-uuid-1',
    });
  });

  it('sends the selected programId and never a client-controlled role', async () => {
    on('POST', '/auth/register', { kind: 'http', status: 201, body: authBody('a3', 'r3') });

    await session.signUp({
      fullName: 'Layla Haddad',
      email: 'layla@example.com',
      password: 'Str0ngPass',
      programId: '11111111-2222-3333-4444-555555555555',
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.programId).toBe('11111111-2222-3333-4444-555555555555');
    expect(body).not.toHaveProperty('role');
  });

  it('sends an optional phone when provided and omits it when empty', async () => {
    on('POST', '/auth/register', { kind: 'http', status: 201, body: authBody('a4', 'r4') });

    await session.signUp({
      fullName: 'Layla Haddad',
      email: 'layla@example.com',
      password: 'Str0ngPass',
      phone: '  0512345678  ',
      programId: 'program-uuid-1',
    });
    let body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.phone).toBe('0512345678');

    on('POST', '/auth/register', { kind: 'http', status: 201, body: authBody('a5', 'r5') });
    await session.signUp({
      fullName: 'Layla Haddad',
      email: 'layla@example.com',
      password: 'Str0ngPass',
      phone: '   ',
      programId: 'program-uuid-1',
    });
    body = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(body).not.toHaveProperty('phone');
  });

  it('does not fabricate a session when registration fails', async () => {
    on('POST', '/auth/register', { kind: 'http', status: 409, body: err(409, 'email exists') });

    await expect(
      session.signUp({
        fullName: 'Layla',
        email: 'a@b.com',
        password: 'Str0ngPass',
        programId: 'program-uuid-1',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(store.access).toBeNull();
  });
});

describe('restoreSession', () => {
  it('resolves to none when no credentials are stored', async () => {
    expect(await session.restoreSession()).toEqual({ state: 'none' });
  });

  it('validates a stored session against GET /auth/me', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    on('GET', '/auth/me', { kind: 'http', status: 200, body: USER });

    const outcome = await session.restoreSession();

    expect(outcome).toMatchObject({ state: 'authenticated' });
    if (outcome.state === 'authenticated') {
      expect(outcome.user.id).toBe(USER.id);
    }
  });

  it('refreshes a 401 and then reports authenticated', async () => {
    store.access = 'expired';
    store.refresh = 'r1';
    on(
      'GET',
      '/auth/me',
      { kind: 'http', status: 401, body: err(401) },
      { kind: 'http', status: 200, body: USER },
    );
    on('POST', '/auth/refresh', { kind: 'http', status: 200, body: authBody('a2', 'r2') });

    const outcome = await session.restoreSession();

    expect(outcome.state).toBe('authenticated');
    expect(store.access).toBe('a2');
    expect(store.refresh).toBe('r2');
  });

  it('clears an invalid session when refresh is rejected', async () => {
    store.access = 'expired';
    store.refresh = 'bad';
    on('GET', '/auth/me', { kind: 'http', status: 401, body: err(401) });
    on('POST', '/auth/refresh', { kind: 'http', status: 401, body: err(401) });

    const outcome = await session.restoreSession();

    expect(outcome).toEqual({ state: 'rejected' });
    expect(store.access).toBeNull();
    expect(store.refresh).toBeNull();
  });

  it('preserves credentials and reports offline on a network failure', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    profile.value = USER;
    on('GET', '/auth/me', { kind: 'network' });

    const outcome = await session.restoreSession();

    expect(outcome.state).toBe('offline');
    expect(store.access).toBe('a1');
    expect(store.refresh).toBe('r1');
  });

  it('reports server-error (never offline) when the backend misses the startup deadline', async () => {
    // The Phase 5.2 defect: a slow (cold-start) backend aborted the startup
    // validation after RESTORE_TIMEOUT_MS and the app claimed the device had
    // no internet connection. An unanswered request proves nothing about
    // connectivity, so it must be reported as a server problem.
    vi.useFakeTimers();
    try {
      store.access = 'a1';
      store.refresh = 'r1';
      profile.value = USER;
      on('GET', '/auth/me', { kind: 'hang' });

      const pending = session.restoreSession();
      await vi.advanceTimersByTimeAsync(6_000);
      const outcome = await pending;

      expect(outcome.state).toBe('server-error');
      expect(outcome).toHaveProperty('user', USER);
      expect(store.access).toBe('a1');
      expect(store.refresh).toBe('r1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports server-error (never offline) when the refresh attempt misses the deadline', async () => {
    vi.useFakeTimers();
    try {
      store.access = 'expired';
      store.refresh = 'r1';
      profile.value = USER;
      on('GET', '/auth/me', { kind: 'http', status: 401, body: err(401) });
      on('POST', '/auth/refresh', { kind: 'hang' });

      const pending = session.restoreSession();
      await vi.advanceTimersByTimeAsync(20_000);
      const outcome = await pending;

      expect(outcome.state).toBe('server-error');
      expect(store.access).toBe('expired');
    } finally {
      vi.useRealTimers();
    }
  });

  it('classifies a 5xx as server-error, never as offline, and keeps tokens', async () => {
    // The server ANSWERED with 500: the device is online. Reporting this as
    // "offline" produced the false connectivity warning (Phase 4.1 bug).
    store.access = 'a1';
    store.refresh = 'r1';
    profile.value = USER;
    on('GET', '/auth/me', { kind: 'http', status: 500, body: err(500) });

    const outcome = await session.restoreSession();

    expect(outcome.state).toBe('server-error');
    expect(outcome).toHaveProperty('user', USER);
    expect(store.access).toBe('a1');
    expect(store.refresh).toBe('r1');
    expect(callsTo('POST', '/auth/refresh')).toBe(0);
  });

  it('classifies a malformed 2xx body as server-error, not offline', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    profile.value = USER;
    on('GET', '/auth/me', { kind: 'http', status: 200, body: { unexpected: true } });

    const outcome = await session.restoreSession();

    expect(outcome.state).toBe('server-error');
    expect(store.access).toBe('a1');
  });

  it('reports offline only when the refresh attempt itself cannot reach the network', async () => {
    store.access = 'expired';
    store.refresh = 'r1';
    profile.value = USER;
    on('GET', '/auth/me', { kind: 'http', status: 401, body: err(401) });
    on('POST', '/auth/refresh', { kind: 'network' });

    const outcome = await session.restoreSession();

    expect(outcome.state).toBe('offline');
    expect(store.access).toBe('expired');
    expect(store.refresh).toBe('r1');
  });

  it('reports server-error when the refresh attempt answers with a 5xx', async () => {
    store.access = 'expired';
    store.refresh = 'r1';
    profile.value = USER;
    on('GET', '/auth/me', { kind: 'http', status: 401, body: err(401) });
    on('POST', '/auth/refresh', { kind: 'http', status: 503, body: err(503) });

    const outcome = await session.restoreSession();

    expect(outcome.state).toBe('server-error');
    expect(store.access).toBe('expired');
    expect(store.refresh).toBe('r1');
  });

  it('treats a 403 as a rejection without attempting a refresh', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    on('GET', '/auth/me', { kind: 'http', status: 403, body: err(403) });

    const outcome = await session.restoreSession();

    expect(outcome.state).toBe('rejected');
    expect(callsTo('POST', '/auth/refresh')).toBe(0);
  });
});

describe('refreshSession', () => {
  it('rotates and persists both tokens', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    on('POST', '/auth/refresh', { kind: 'http', status: 200, body: authBody('a2', 'r2') });

    const response = await session.refreshSession();

    expect(response.accessToken).toBe('a2');
    expect(store.access).toBe('a2');
    expect(store.refresh).toBe('r2');
    expect(profile.value).toMatchObject({ id: USER.id });
  });

  it('clears the session on refresh rejection', async () => {
    store.access = 'a1';
    store.refresh = 'bad';
    on('POST', '/auth/refresh', { kind: 'http', status: 401, body: err(401) });

    await expect(session.refreshSession()).rejects.toMatchObject({ statusCode: 401 });
    expect(store.access).toBeNull();
    expect(store.refresh).toBeNull();
  });

  it('de-duplicates concurrent refreshes into a single request', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    on('POST', '/auth/refresh', { kind: 'http', status: 200, body: authBody('a2', 'r2') });

    const [a, b] = await Promise.all([session.refreshSession(), session.refreshSession()]);

    expect(a).toBe(b);
    expect(callsTo('POST', '/auth/refresh')).toBe(1);
    expect(store.access).toBe('a2');
  });

  it('does not persist a refresh that resolves after the session was cleared', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    let resolveFetch!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return pending;
      }
      throw new Error(`unexpected ${url}`);
    });

    const inFlight = session.refreshSession();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await session.clearSession(); // e.g. a logout racing the refresh
    resolveFetch(json(200, authBody('a2', 'r2')));

    await expect(inFlight).rejects.toMatchObject({ statusCode: 401 });
    expect(store.access).toBeNull();
    expect(store.refresh).toBeNull();
  });
});

describe('logout', () => {
  it('revokes remotely and clears local credentials + profile', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    profile.value = USER;
    on('POST', '/auth/logout', { kind: 'http', status: 200, body: { message: 'Logged out' } });

    await session.logout();

    expect(callsTo('POST', '/auth/logout')).toBe(1);
    expect(store.access).toBeNull();
    expect(store.refresh).toBeNull();
    expect(profile.value).toBeNull();
  });

  it('still clears locally when the server is unreachable', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    profile.value = USER;
    on('POST', '/auth/logout', { kind: 'network' });

    await session.logout();

    expect(store.access).toBeNull();
    expect(profile.value).toBeNull();
  });

  it('does not trigger a token refresh when logout returns 401', async () => {
    store.access = 'a1';
    store.refresh = 'r1';
    on('POST', '/auth/logout', { kind: 'http', status: 401, body: err(401) });

    await session.logout();

    expect(callsTo('POST', '/auth/refresh')).toBe(0);
    expect(store.access).toBeNull();
  });
});
