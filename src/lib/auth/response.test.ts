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
      phone: '0512345678',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(user.id).toBe('u1');
    expect(user.role).toBe('STUDENT');
    expect(user.studentUniversityId).toBe('SVU-1');
    expect(user.phone).toBe('0512345678');
  });

  it('normalises a missing/empty phone to null', () => {
    const base = { id: 'u1', fullName: 'Layla', email: 'layla@example.com' };
    expect(parseUser(base).phone).toBeNull();
    expect(parseUser({ ...base, phone: '' }).phone).toBeNull();
  });

  it('recognises every backend role and degrades unknown roles to STUDENT', () => {
    const base = { id: 'u1', fullName: 'Layla', email: 'layla@example.com' };
    expect(parseUser({ ...base, role: 'ADMIN' }).role).toBe('ADMIN');
    expect(parseUser({ ...base, role: 'PROGRAM_MANAGER' }).role).toBe('PROGRAM_MANAGER');
    expect(parseUser({ ...base, role: 'SUBJECT_MANAGER' }).role).toBe('SUBJECT_MANAGER');
    expect(parseUser({ ...base, role: 'SUPER_ADMIN' }).role).toBe('STUDENT');
    expect(parseUser(base).role).toBe('STUDENT');
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
