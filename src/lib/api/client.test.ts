/**
 * Unit tests for the HTTP client's refresh-on-401 behaviour.
 *
 * Secure storage and `fetch` are mocked; no real backend or device is used.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponseParseError } from './errors';
import { apiRequest, setRefreshHandler } from './client';

const store = vi.hoisted(() => ({
  access: null as string | null,
  refresh: null as string | null,
}));

vi.mock('../storage/token-storage', () => ({
  TokenStorageError: class TokenStorageError extends Error {},
  tokenStorage: {
    getAccessToken: async () => store.access,
    getRefreshToken: async () => store.refresh,
    getTokens: async () =>
      store.access !== null && store.refresh !== null
        ? { accessToken: store.access, refreshToken: store.refresh }
        : null,
    saveTokens: async (t: { accessToken: string; refreshToken: string }) => {
      store.access = t.accessToken;
      store.refresh = t.refreshToken;
    },
    clearTokens: async () => {
      store.access = null;
      store.refresh = null;
    },
  },
}));

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

function err(status: number) {
  return { statusCode: status, error: 'Error', message: `failed ${status}` };
}

// Dependency-free base64url encoder so we can build real (unverified) JWTs the
// client's `exp` reader understands.
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlEncode(value: unknown): string {
  const json = JSON.stringify(value);
  let out = '';
  for (let i = 0; i < json.length; i += 3) {
    const a = json.charCodeAt(i);
    const b = json.charCodeAt(i + 1);
    const c = json.charCodeAt(i + 2);
    out += BASE64_CHARS[a >> 2];
    out += BASE64_CHARS[((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4)];
    if (!Number.isNaN(b)) out += BASE64_CHARS[((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6)];
    if (!Number.isNaN(c)) out += BASE64_CHARS[c & 63];
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}

function jwtWithExp(expSeconds: number): string {
  return `${base64UrlEncode({ alg: 'none', typ: 'JWT' })}.${base64UrlEncode({ exp: expSeconds })}.sig`;
}

const fetchMock = vi.fn();

beforeEach(() => {
  store.access = null;
  store.refresh = null;
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setRefreshHandler(null);
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://test.local';
});

afterEach(() => {
  setRefreshHandler(null);
});

function authHeaderOfCall(index: number): string | undefined {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return (init?.headers as Record<string, string> | undefined)?.Authorization;
}

describe('apiRequest', () => {
  it('attaches the stored bearer token to authenticated requests', async () => {
    store.access = 'tok-1';
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await apiRequest('/secure', { auth: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authHeaderOfCall(0)).toBe('Bearer tok-1');
  });

  it('refreshes once and retries with the newest token on a 401', async () => {
    store.access = 'old';
    store.refresh = 'r1';
    const handler = vi.fn(async () => {
      store.access = 'new';
      return 'new';
    });
    setRefreshHandler(handler);

    fetchMock
      .mockResolvedValueOnce(json(401, err(401)))
      .mockResolvedValueOnce(json(200, { value: 42 }));

    const result = await apiRequest<{ value: number }>('/secure', { auth: true });

    expect(result).toEqual({ value: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authHeaderOfCall(1)).toBe('Bearer new');
  });

  it('retries at most once when the retried request is also 401', async () => {
    store.access = 'old';
    const handler = vi.fn(async () => {
      store.access = 'new';
      return 'new';
    });

    setRefreshHandler(handler);

    fetchMock
      .mockResolvedValueOnce(json(401, err(401)))
      .mockResolvedValueOnce(json(401, err(401)));

    await expect(apiRequest('/secure', { auth: true })).rejects.toMatchObject({ statusCode: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one refresh operation across concurrent protected requests', async () => {
    store.access = 'old';
    let resolveRefresh!: (token: string) => void;
    const handler = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = (token) => {
            store.access = token;
            resolve(token);
          };
        }),
    );
    setRefreshHandler(handler);
    fetchMock
      .mockResolvedValueOnce(json(401, err(401)))
      .mockResolvedValueOnce(json(401, err(401)))
      .mockResolvedValueOnce(json(200, { request: 1 }))
      .mockResolvedValueOnce(json(200, { request: 2 }));

    const first = apiRequest('/first', { auth: true });
    const second = apiRequest('/second', { auth: true });
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(1);
      expect(resolveRefresh).toBeTypeOf('function');
    });
    resolveRefresh('new');

    await expect(Promise.all([first, second])).resolves.toEqual([
      { request: 1 },
      { request: 2 },
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not refresh when retryOnUnauthorized is false', async () => {
    store.access = 'old';
    const handler = vi.fn();
    setRefreshHandler(handler);
    fetchMock.mockResolvedValueOnce(json(401, err(401)));

    await expect(
      apiRequest('/logout-like', { auth: true, retryOnUnauthorized: false }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(handler).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on 403', async () => {
    store.access = 'old';
    const handler = vi.fn();
    setRefreshHandler(handler);
    fetchMock.mockResolvedValueOnce(json(403, err(403)));

    await expect(apiRequest('/secure', { auth: true })).rejects.toMatchObject({ statusCode: 403 });
    expect(handler).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not refresh an unauthenticated request', async () => {
    const handler = vi.fn();
    setRefreshHandler(handler);
    fetchMock.mockResolvedValueOnce(json(401, err(401)));

    await expect(apiRequest('/public')).rejects.toMatchObject({ statusCode: 401 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('fails fast (no network) when an authenticated request has no stored token', async () => {
    store.access = null;
    await expect(apiRequest('/secure', { auth: true })).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces malformed 2xx bodies as a parse error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{ not json',
    } as unknown as Response);

    await expect(apiRequest('/thing')).rejects.toBeInstanceOf(ResponseParseError);
  });
});

describe('apiRequest proactive refresh', () => {
  it('refreshes an expiring token before sending instead of waiting for a 401', async () => {
    const expiring = jwtWithExp(Math.floor(Date.now() / 1000) - 10);
    store.access = expiring;
    const handler = vi.fn(async () => {
      store.access = 'fresh';
      return 'fresh';
    });
    setRefreshHandler(handler);
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await apiRequest('/secure', { auth: true });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authHeaderOfCall(0)).toBe('Bearer fresh');
  });

  it('sends a non-expiring token without refreshing', async () => {
    const valid = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    store.access = valid;
    const handler = vi.fn(async () => 'unused');
    setRefreshHandler(handler);
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await apiRequest('/secure', { auth: true });

    expect(handler).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authHeaderOfCall(0)).toBe(`Bearer ${valid}`);
  });

  it('does not proactively refresh when retryOnUnauthorized is false', async () => {
    const expiring = jwtWithExp(Math.floor(Date.now() / 1000) - 10);
    store.access = expiring;
    const handler = vi.fn(async () => 'unused');
    setRefreshHandler(handler);
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await apiRequest('/logout-like', { auth: true, retryOnUnauthorized: false });

    expect(handler).not.toHaveBeenCalled();
    expect(authHeaderOfCall(0)).toBe(`Bearer ${expiring}`);
  });
});
