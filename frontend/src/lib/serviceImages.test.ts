import { describe, expect, it } from 'vitest';
import { serviceImage, serviceSlug } from './serviceImages.ts';

describe('serviceImage', () => {
  it('matches a demo service by name, ignoring case and punctuation', () => {
    expect(serviceSlug('Haircut and Beard Trim')).toBe('haircut-and-beard-trim');
    expect(serviceImage('Hot Towel Shave')).toBe('/images/services/hot-towel-shave.webp');
    expect(serviceImage('  KIDS haircut! ')).toBe('/images/services/kids-haircut.webp');
  });

  it('falls back to the shop photo for a service it does not know', () => {
    expect(serviceImage('Eyebrow Threading')).toBe('/images/services/default.webp');
  });
});
