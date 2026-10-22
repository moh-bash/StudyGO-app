/** Unit tests for the catalog cache scoping rules (account isolation). */
import { describe, expect, it } from 'vitest';
import { isCatalogCacheForScope } from './catalog-scope';

describe('isCatalogCacheForScope', () => {
  it('accepts a cache written by the same account for the same program', () => {
    expect(
      isCatalogCacheForScope(
        { userId: 'u1', programId: 'p1' },
        { userId: 'u1', programId: 'p1' },
      ),
    ).toBe(true);
  });

  it('accepts a no-program cache for the same no-program account', () => {
    expect(
      isCatalogCacheForScope(
        { userId: 'u1', programId: null },
        { userId: 'u1', programId: null },
      ),
    ).toBe(true);
  });

  it('rejects a cache written by a different account', () => {
    expect(
      isCatalogCacheForScope(
        { userId: 'u2', programId: 'p1' },
        { userId: 'u1', programId: 'p1' },
      ),
    ).toBe(false);
  });

  it('rejects a cache from the same account but another program', () => {
    expect(
      isCatalogCacheForScope(
        { userId: 'u1', programId: 'p2' },
        { userId: 'u1', programId: 'p1' },
      ),
    ).toBe(false);
  });

  it('never matches legacy rows written before the user_id column existed', () => {
    expect(
      isCatalogCacheForScope(
        { userId: null, programId: 'p1' },
        { userId: 'u1', programId: 'p1' },
      ),
    ).toBe(false);
  });

  it('rejects a cached no-program row for an account with a program', () => {
    expect(
      isCatalogCacheForScope(
        { userId: 'u1', programId: null },
        { userId: 'u1', programId: 'p1' },
      ),
    ).toBe(false);
  });
});
