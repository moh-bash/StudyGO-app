/**
 * Unit tests for the public program-registration endpoint binding.
 *
 * `fetch` and secure storage are mocked; no real backend or device is used.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError, ResponseParseError } from './errors';
import { programsApi } from './programs';

vi.mock('../storage/token-storage', () => ({
  TokenStorageError: class TokenStorageError extends Error {},
  tokenStorage: {
    getAccessToken: async () => null,
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

describe('programsApi.registration', () => {
  it('loads and parses the bare array from GET /programs/registration', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, [
        { id: 'p1', name: 'Information Technology', code: 'IT' },
        { id: 'p2', name: 'Computer Science', code: null },
      ]),
    );

    const programs = await programsApi.registration();

    expect(programs).toEqual([
      { id: 'p1', name: 'Information Technology', code: 'IT' },
      { id: 'p2', name: 'Computer Science', code: null },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/programs/registration');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('returns an empty list when the backend has no active programs', async () => {
    fetchMock.mockResolvedValueOnce(json(200, []));

    expect(await programsApi.registration()).toEqual([]);
  });

  it('coerces a missing code to null', async () => {
    fetchMock.mockResolvedValueOnce(json(200, [{ id: 'p1', name: 'Engineering' }]));

    expect(await programsApi.registration()).toEqual([
      { id: 'p1', name: 'Engineering', code: null },
    ]);
  });

  it('surfaces a transport failure as a NetworkError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(programsApi.registration()).rejects.toBeInstanceOf(NetworkError);
  });

  it('recovers on a retry after a failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(json(200, [{ id: 'p1', name: 'IT', code: 'IT' }]));

    await expect(programsApi.registration()).rejects.toBeInstanceOf(NetworkError);
    expect(await programsApi.registration()).toEqual([{ id: 'p1', name: 'IT', code: 'IT' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a non-array body', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: [] }));

    await expect(programsApi.registration()).rejects.toBeInstanceOf(ResponseParseError);
  });

  it('rejects an item missing its id or name', async () => {
    fetchMock.mockResolvedValueOnce(json(200, [{ name: 'No id' }]));

    await expect(programsApi.registration()).rejects.toBeInstanceOf(ResponseParseError);
  });
});
