import { describe, expect, it } from 'vitest';
import { canChangeAppointment, formatAppointmentRange, todayInJakarta } from './dates.ts';

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

describe('formatAppointmentRange', () => {
  it('formats a same-day range in Jakarta time', () => {
    expect(formatAppointmentRange('2026-10-28T07:00:00Z', '2026-10-28T07:30:00Z')).toBe(
      'Wed, 28 Oct 2026, 14:00-14:30',
    );
  });

  it('uses the Jakarta date, not the UTC date, and 24-hour midnight', () => {
    expect(formatAppointmentRange('2026-10-27T17:30:00Z', '2026-10-27T18:00:00Z')).toBe(
      'Wed, 28 Oct 2026, 00:30-01:00',
    );
  });

  it('shows both dates when the range crosses Jakarta midnight', () => {
    expect(formatAppointmentRange('2026-10-28T16:30:00Z', '2026-10-28T17:30:00Z')).toBe(
      'Wed, 28 Oct 2026, 23:30 - Thu, 29 Oct 2026, 00:30',
    );
  });
});

describe('canChangeAppointment', () => {
  const now = new Date('2026-10-28T03:00:00Z');

  it('is true when the start is more than 24 hours away', () => {
    expect(canChangeAppointment('2026-10-29T04:00:00Z', now)).toBe(true);
  });

  it('is true at exactly 24 hours', () => {
    expect(canChangeAppointment('2026-10-29T03:00:00Z', now)).toBe(true);
  });

  it('is false one minute inside the 24-hour window', () => {
    expect(canChangeAppointment('2026-10-29T02:59:00Z', now)).toBe(false);
  });

  it('is false for a start in the past', () => {
    expect(canChangeAppointment('2026-10-28T02:00:00Z', now)).toBe(false);
  });
});
