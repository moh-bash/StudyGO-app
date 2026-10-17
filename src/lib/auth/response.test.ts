/** Unit tests for the authentication payload validators. */
import { describe, expect, it } from 'vitest';
import { ResponseParseError } from '../api/errors';
import { parseAuthResponse, parseUser } from './response';

describe('parseUser', () => {
  it('accepts a well-formed user and normalises nullable fields', () => {
    const user = parseUser({
      id: 'u1',
      fullName: 'Layla',
      email: 'layla@example.com',
      role: 'STUDENT',
      status: 'ACTIVE',
      profileImageUrl: null,
      studentUniversityId: 'SVU-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(user.id).toBe('u1');
    expect(user.role).toBe('STUDENT');
    expect(user.studentUniversityId).toBe('SVU-1');
  });

  it('rejects payloads missing required identity fields', () => {
    expect(() => parseUser({ fullName: 'Layla' })).toThrow(ResponseParseError);
    expect(() => parseUser(null)).toThrow(ResponseParseError);
  });
});

describe('parseAuthResponse', () => {
  it('accepts a valid auth response', () => {
    const parsed = parseAuthResponse({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u1', fullName: 'Layla', email: 'l@e.com' },
    });
    expect(parsed.accessToken).toBe('a');
    expect(parsed.refreshToken).toBe('r');
    expect(parsed.user.id).toBe('u1');
  });

  it('rejects missing tokens', () => {
    expect(() => parseAuthResponse({ accessToken: 'a', user: {} })).toThrow(ResponseParseError);
  });

  it('rejects an invalid user inside a valid token pair', () => {
    expect(() => parseAuthResponse({ accessToken: 'a', refreshToken: 'r', user: {} })).toThrow(
      ResponseParseError,
    );
  });
});
