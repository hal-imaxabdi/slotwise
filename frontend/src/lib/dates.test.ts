import { describe, expect, it } from 'vitest';
import { todayInJakarta } from './dates.ts';

describe('todayInJakarta', () => {
  it('returns the Jakarta calendar date for a midday UTC instant', () => {
    expect(todayInJakarta(new Date('2026-10-27T05:00:00Z'))).toBe('2026-10-27');
  });

  it('is still the same day at 23:59 Jakarta time', () => {
    expect(todayInJakarta(new Date('2026-10-27T16:59:00Z'))).toBe('2026-10-27');
  });

  it('rolls over to the next day at midnight Jakarta time', () => {
    expect(todayInJakarta(new Date('2026-10-27T17:00:00Z'))).toBe('2026-10-28');
  });
});
