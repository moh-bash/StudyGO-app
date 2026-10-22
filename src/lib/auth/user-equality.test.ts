/**
 * Regression tests for the reference-stability rule that ended the reported
 * ~once-per-second refresh loop.
 *
 * Scenario reproduced in miniature: every session validation calls
 * `GET /auth/me` and deserializes a *brand-new* object with identical content.
 * If the auth state treated it as a change, the `user` reference churned,
 * `useCatalog`'s `[user]`-keyed memo invalidated, the catalog effect refetched,
 * and the refetch's success signal re-triggered validation — a self-sustaining
 * loop. The rule under test: an unchanged profile is "the same user"; only a
 * real field change counts as new.
 */
import { describe, expect, it } from 'vitest';
import type { User } from '../api/types';
import { sameUser } from './user-equality';

const USER: User = {
  id: 'user-1',
  fullName: 'Layla Haddad',
  email: 'layla@example.com',
  role: 'STUDENT',
  status: 'ACTIVE',
  profileImageUrl: null,
  studentUniversityId: null,
  phone: null,
  programId: 'program-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('sameUser', () => {
  it('treats two independent objects with identical content as the same user', () => {
    // Two separate `GET /auth/me` deserializations: structurally equal but
    // never `===`. Must compare equal so `setUser` keeps the old reference.
    const a = structuredClone(USER);
    const b = structuredClone(USER);
    expect(a).not.toBe(b);
    expect(sameUser(a, b)).toBe(true);
  });

  it('is reflexive and treats null === null as stable', () => {
    expect(sameUser(USER, USER)).toBe(true);
    expect(sameUser(null, null)).toBe(true);
  });

  it('never matches a populated snapshot against null (sign-in/out transitions)', () => {
    expect(sameUser(USER, null)).toBe(false);
    expect(sameUser(null, USER)).toBe(false);
  });

  it('detects a real profile change on every field', () => {
    const mutations: (Partial<User>)[] = [
      { id: 'user-2' },
      { fullName: 'Layla H.' },
      { email: 'other@example.com' },
      { role: 'ADMIN' },
      { status: 'SUSPENDED' },
      { profileImageUrl: 'https://example.com/p.png' },
      { studentUniversityId: '12345' },
      { phone: '0512345678' },
      { programId: 'program-2' },
      { createdAt: '2025-12-31T00:00:00.000Z' },
      { updatedAt: '2026-02-01T00:00:00.000Z' },
    ];
    for (const patch of mutations) {
      expect(sameUser(USER, { ...USER, ...patch })).toBe(false);
    }
  });

  it('keeps one stable reference across a long sequence of identical validations', () => {
    // Simulates the repeated validation cycle that used to churn state:
    // each pass hands in a freshly deserialized, identical object.
    const start = structuredClone(USER);
    let current: User | null = start;
    for (let i = 0; i < 50; i += 1) {
      const fresh = structuredClone(USER);
      current = sameUser(current, fresh) ? current : fresh;
    }
    expect(current).toBe(start); // reference from before the loop survives it
  });
});
