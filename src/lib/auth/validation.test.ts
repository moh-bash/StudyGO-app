/** Unit tests for the sign-up form validators (phone, Phase 1). */
import { describe, expect, it } from 'vitest';
import { validatePhone } from './validation';

describe('validatePhone', () => {
  it('accepts an empty value — the field is optional', () => {
    expect(validatePhone('')).toBeNull();
    expect(validatePhone('   ')).toBeNull();
  });

  it('accepts values matching the backend rule (5–20 digits, + and - separators)', () => {
    expect(validatePhone('0512345678')).toBeNull();
    expect(validatePhone('+963-912 345 678')).toBeNull();
    expect(validatePhone('12345')).toBeNull();
    expect(validatePhone('12345678901234567890')).toBeNull();
  });

  it('rejects too short, too long, or non-numeric values', () => {
    expect(validatePhone('1234')).not.toBeNull();
    expect(validatePhone('123456789012345678901')).not.toBeNull();
    expect(validatePhone('not-a-phone')).not.toBeNull();
  });
});
