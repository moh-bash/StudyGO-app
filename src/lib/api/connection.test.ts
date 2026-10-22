/**
 * Unit tests for the connectivity classifier.
 *
 * These lock down the exact reported bug: a request the backend *answered* (any
 * HTTP status) must never be surfaced as "the device could not reach the
 * server", and a transport failure with data already on screen must not warn at
 * all. Pure logic, no React, no network.
 */
import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from './errors';
import {
  CONNECTION_MESSAGES,
  TEAMS_FAILURE_MESSAGES,
  cacheReadFailure,
  classifyConnectionFailure,
  classifyTeamsFailure,
  connectionFailed,
  connectionIdle,
  connectionSucceeded,
} from './connection';

describe('classifyConnectionFailure', () => {
  it('reports a network failure with no data as unreachable', () => {
    const info = classifyConnectionFailure(new NetworkError('offline'), false);
    expect(info.failure).toBe('network');
    expect(info.message).toBe(CONNECTION_MESSAGES.network);
    expect(info.isTransportFailure).toBe(true);
  });

  it('reports a TIMEOUT as a slow server, never as an offline device', () => {
    // The Phase 5.2 defect: a slow (cold-start) backend timed out and the app
    // told the student to "check your internet connection".
    const info = classifyConnectionFailure(new NetworkError('slow', undefined, 'timeout'), false);
    expect(info.failure).toBe('timeout');
    expect(info.message).toBe(CONNECTION_MESSAGES.timeout);
    expect(info.isTransportFailure).toBe(false);
    expect(info.message).not.toContain('الإنترنت');
  });

  it('reports a TIMEOUT as a slow server even when cached data is shown', () => {
    const info = classifyConnectionFailure(new NetworkError('slow', undefined, 'timeout'), true);
    expect(info.failure).toBe('timeout');
    expect(info.isTransportFailure).toBe(false);
  });

  it('stays silent on an ABORTED request (it says nothing about the server)', () => {
    const info = classifyConnectionFailure(new NetworkError('cancelled', undefined, 'aborted'), false);
    expect(info.failure).toBe('none');
    expect(info.message).toBeNull();
    expect(info.isTransportFailure).toBe(false);
  });

  it('does NOT warn on a transport failure when cached data is shown', () => {
    const info = classifyConnectionFailure(new NetworkError('offline'), true);
    expect(info.failure).toBe('none');
    expect(info.message).toBeNull();
    // It is still a genuine transport failure for callers that care...
    expect(info.isTransportFailure).toBe(true);
  });

  it('classifies a 401 as an auth error, never as offline', () => {
    const info = classifyConnectionFailure(new ApiError('unauthorized', 401, null), false);
    expect(info.failure).toBe('auth');
    expect(info.message).toBe(CONNECTION_MESSAGES.auth);
    expect(info.isTransportFailure).toBe(false);
  });

  it('classifies a 403 as an auth error, never as offline', () => {
    const info = classifyConnectionFailure(new ApiError('forbidden', 403, null), true);
    expect(info.failure).toBe('auth');
    expect(info.isTransportFailure).toBe(false);
  });

  it('classifies a 5xx as an API error, using the backend message', () => {
    const info = classifyConnectionFailure(new ApiError('boom', 500, null), false);
    expect(info.failure).toBe('api');
    expect(info.message).toBe('boom');
    expect(info.isTransportFailure).toBe(false);
  });

  it('classifies a 404 as an API error (server answered)', () => {
    const info = classifyConnectionFailure(new ApiError('missing', 404, null), false);
    expect(info.failure).toBe('api');
    expect(info.isTransportFailure).toBe(false);
  });

  it('treats an unexpected thrown Error as an API problem, not offline', () => {
    const info = classifyConnectionFailure(new Error('parse failed'), false);
    expect(info.failure).toBe('api');
    expect(info.message).toBe('parse failed');
    expect(info.isTransportFailure).toBe(false);
  });

  it('treats a non-Error thrown value as an API problem with a default message', () => {
    const info = classifyConnectionFailure('nope', false);
    expect(info.failure).toBe('api');
    expect(info.message).toBe(CONNECTION_MESSAGES.api);
  });

  it('reports a cache read failure distinctly', () => {
    const info = cacheReadFailure();
    expect(info.failure).toBe('cache');
    expect(info.message).toBe(CONNECTION_MESSAGES.cache);
    expect(info.isTransportFailure).toBe(false);
  });
});

describe('connection state reducer', () => {
  it('starts idle with no error', () => {
    expect(connectionIdle()).toEqual({ failure: 'none', error: null });
  });

  it('applies a classification to the state', () => {
    expect(connectionFailed(classifyConnectionFailure(new NetworkError('x'), false))).toEqual({
      failure: 'network',
      error: CONNECTION_MESSAGES.network,
    });
  });

  it('clears any previous error on success', () => {
    const failed = connectionFailed(classifyConnectionFailure(new ApiError('boom', 500, null), false));
    expect(failed.error).not.toBeNull();
    expect(connectionSucceeded()).toEqual({ failure: 'none', error: null });
    expect(connectionIdle()).toEqual(connectionSucceeded());
  });
});

describe('classifyTeamsFailure', () => {
  it('words a real transport failure as an offline problem', () => {
    expect(classifyTeamsFailure(new NetworkError('x'), false)).toEqual({
      message: TEAMS_FAILURE_MESSAGES.offline,
      offline: true,
    });
  });

  it('words a TIMEOUT as a slow server, never as a connectivity problem', () => {
    // The reported Phase 5.2 bug: a delayed backend produced
    // "تحقق من اتصالك بالإنترنت" while the device was online the whole time.
    const result = classifyTeamsFailure(new NetworkError('x', undefined, 'timeout'), false);
    expect(result.offline).toBe(false);
    expect(result.message).toBe(TEAMS_FAILURE_MESSAGES.timeout);
    expect(result.message).not.toContain('الإنترنت');
  });

  it('words a TIMEOUT as a slow server even while teams are already on screen', () => {
    const result = classifyTeamsFailure(new NetworkError('x', undefined, 'timeout'), true);
    expect(result.offline).toBe(false);
    expect(result.message).toBe(TEAMS_FAILURE_MESSAGES.timeout);
  });

  it('stays silent on an ABORTED request', () => {
    const result = classifyTeamsFailure(new NetworkError('x', undefined, 'aborted'), false);
    expect(result.offline).toBe(false);
    expect(result.message).toBeNull();
  });

  it('stays silent on a transport failure while teams are already on screen', () => {
    expect(classifyTeamsFailure(new NetworkError('x'), true)).toEqual({
      message: null,
      offline: true,
    });
  });

  it('never marks a server error as offline, and keeps the backend message', () => {
    const result = classifyTeamsFailure(new ApiError('اسم الفريق مستخدم بالفعل', 400, null), false);
    expect(result.offline).toBe(false);
    expect(result.message).toBe('اسم الفريق مستخدم بالفعل');
  });

  it('treats a 5xx as an API problem, not a connectivity problem', () => {
    const result = classifyTeamsFailure(new ApiError('', 500, null), false);
    expect(result.offline).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('classifies 401/403 as auth, never as offline', () => {
    for (const status of [401, 403]) {
      const result = classifyTeamsFailure(new ApiError('nope', status, null), false);
      expect(result.offline).toBe(false);
      expect(result.message).toBe(CONNECTION_MESSAGES.auth);
    }
  });

  it('falls back to a generic message for a non-Error thrown value', () => {
    const result = classifyTeamsFailure('weird', false);
    expect(result.offline).toBe(false);
    expect(result.message).toBe(TEAMS_FAILURE_MESSAGES.api);
  });

  it('does not leak the catalog wording for an unexpected Error', () => {
    const result = classifyTeamsFailure(new Error('parse failed'), false);
    expect(result.offline).toBe(false);
    // A non-ApiError carries no user-facing copy, so the Teams message is used
    // rather than the catalog's ("تعذّر تحميل دليل المواد ...").
    expect(result.message).toBe(TEAMS_FAILURE_MESSAGES.api);
    expect(result.message).not.toBe(CONNECTION_MESSAGES.api);
  });
});
