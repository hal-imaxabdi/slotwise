import { describe, expect, it } from 'vitest';
import { formatMinute, jakartaToUtcIso } from './closures.ts';

describe('jakartaToUtcIso', () => {
  it('converts Jakarta midnight to 17:00 UTC the previous day', () => {
    expect(jakartaToUtcIso('2026-11-02', 0)).toBe('2026-11-01T17:00:00.000Z');
  });

  it('adds minutes of the day', () => {
    expect(jakartaToUtcIso('2026-11-02', 570)).toBe('2026-11-02T02:30:00.000Z');
  });

  it('treats 1440 as the next Jakarta midnight', () => {
    expect(jakartaToUtcIso('2026-11-02', 1440)).toBe('2026-11-02T17:00:00.000Z');
  });
});

describe('formatMinute', () => {
  it('pads hours and minutes', () => {
    expect(formatMinute(0)).toBe('00:00');
    expect(formatMinute(570)).toBe('09:30');
    expect(formatMinute(1410)).toBe('23:30');
  });

  it('shows the end of day as 24:00', () => {
    expect(formatMinute(1440)).toBe('24:00');
  });
});
