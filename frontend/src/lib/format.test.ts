import { describe, expect, it } from 'vitest';
import { formatDuration, formatIdr } from './format.ts';

describe('formatIdr', () => {
  it('formats zero', () => {
    expect(formatIdr(0)).toBe('Rp 0');
  });

  it('groups thousands with dots', () => {
    expect(formatIdr(75000)).toBe('Rp 75.000');
  });

  it('groups millions', () => {
    expect(formatIdr(1250000)).toBe('Rp 1.250.000');
  });
});

describe('formatDuration', () => {
  it('shows minutes under an hour', () => {
    expect(formatDuration(30)).toBe('30 min');
  });

  it('shows whole hours', () => {
    expect(formatDuration(120)).toBe('2 h');
  });

  it('shows hours and minutes', () => {
    expect(formatDuration(90)).toBe('1 h 30 min');
  });
});
