/**
 * Phase 4.1 regression: the honest three-way classification of a session-restore
 * failure, exercised at the seam that actually decides the banner copy.
 *
 * The reported bug: a backend that ANSWERED (500) was presented as "you are
 * offline / showing cached data". These tests pin the rule:
 *   transport failure -> offline
 *   HTTP/5xx/malformed -> server-error
 *   explicit 401/403   -> rejected
 * and verify that `offline` never leaks out of a reachable-backend outcome.
 */
import { describe, expect, it } from 'vitest';import { classifyConnectionFailure, CONNECTION_MESSAGES } from '../api/connection';
import { ApiError, NetworkError, ResponseParseError } from '../api/errors';

describe('Phase 4.1 — session-failure classification never calls a reachable server "offline"', () => {
  it('a transport failure with data is degraded-but-quiet, not a warning', () => {
    const info = classifyConnectionFailure(new NetworkError('boom'), true);
    expect(info.failure).toBe('none');
    expect(info.isTransportFailure).toBe(true);
    expect(info.message).toBeNull();
  });

  it('a transport failure with no data is the ONLY real offline message', () => {
    const info = classifyConnectionFailure(new NetworkError('boom'), false);
    expect(info.failure).toBe('network');
    expect(info.message).toBe(CONNECTION_MESSAGES.network);
    expect(info.isTransportFailure).toBe(true);
  });

  it.each([500, 502, 503])('an HTTP %i is an API problem, never a transport failure', (status) => {
    const info = classifyConnectionFailure(new ApiError('server boom', status, null), false);
    expect(info.failure).toBe('api');
    expect(info.isTransportFailure).toBe(false);
    expect(info.message).not.toBe(CONNECTION_MESSAGES.network);
  });

  it('a malformed 2xx body is an API problem, never a transport failure', () => {
    const info = classifyConnectionFailure(new ResponseParseError('bad json'), false);
    expect(info.failure).toBe('api');
    expect(info.isTransportFailure).toBe(false);
  });

  it.each([401, 403])('an HTTP %i is an auth problem, never offline', (status) => {
    const info = classifyConnectionFailure(new ApiError('nope', status, null), false);
    expect(info.failure).toBe('auth');
    expect(info.isTransportFailure).toBe(false);
    expect(info.message).toBe(CONNECTION_MESSAGES.auth);
  });

  it('never returns `network` for anything that is not a NetworkError', () => {
    const nonTransport: unknown[] = [
      new ApiError('x', 500, null),
      new ApiError('x', 404, null),
      new ResponseParseError('x'),
      new Error('plain'),
      'a string',
      undefined,
    ];
    for (const e of nonTransport) {
      expect(classifyConnectionFailure(e, false).failure).not.toBe('network');
      expect(classifyConnectionFailure(e, false).isTransportFailure).toBe(false);
    }
  });
});
