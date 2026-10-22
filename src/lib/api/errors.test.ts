/**
 * Unit tests for the network-failure taxonomy.
 *
 * `isTransportFailure` is the single source of truth for "may this be worded
 * as a connectivity problem?". Only a real transport failure (the request
 * never reached a server) qualifies; a timeout or an abort does not.
 */
import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError, isTransportFailure, networkFailureKind } from './errors';

describe('NetworkError', () => {
  it('defaults to a transport failure (the strictest meaning)', () => {
    expect(new NetworkError('boom').kind).toBe('transport');
  });

  it('carries the failure kind it was built with', () => {
    expect(new NetworkError('boom', undefined, 'timeout').kind).toBe('timeout');
    expect(new NetworkError('boom', undefined, 'aborted').kind).toBe('aborted');
  });
});

describe('isTransportFailure', () => {
  it('is true only for a genuine transport failure', () => {
    expect(isTransportFailure(new NetworkError('boom'))).toBe(true);
  });

  it('is false for a timeout (a slow server is not a lost connection)', () => {
    expect(isTransportFailure(new NetworkError('boom', undefined, 'timeout'))).toBe(false);
  });

  it('is false for an abort', () => {
    expect(isTransportFailure(new NetworkError('boom', undefined, 'aborted'))).toBe(false);
  });

  it('is false for anything that is not a network error', () => {
    expect(isTransportFailure(new ApiError('boom', 500, null))).toBe(false);
    expect(isTransportFailure(new Error('boom'))).toBe(false);
    expect(isTransportFailure(undefined)).toBe(false);
  });
});

describe('networkFailureKind', () => {
  it('returns the kind of a network error', () => {
    expect(networkFailureKind(new NetworkError('boom'))).toBe('transport');
    expect(networkFailureKind(new NetworkError('boom', undefined, 'timeout'))).toBe('timeout');
    expect(networkFailureKind(new NetworkError('boom', undefined, 'aborted'))).toBe('aborted');
  });

  it('returns null when the error is not a network error', () => {
    expect(networkFailureKind(new ApiError('boom', 500, null))).toBeNull();
    expect(networkFailureKind('boom')).toBeNull();
  });
});
