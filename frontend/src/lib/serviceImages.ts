// Photos for the demo shop's services, matched by name. Services have no image field,
// so anything an owner adds later gets the shop photo instead.
const PHOTOS = new Set([
  'beard-trim-and-shape',
  'classic-haircut',
  'grey-blending',
  'hair-and-scalp-treatment',
  'hair-coloring',
  'haircut-and-beard-trim',
  'hot-towel-shave',
  'keratin-smoothing',
  'kids-haircut',
]);

export function serviceSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function serviceImage(name: string): string {
  const slug = serviceSlug(name);
  return `/images/services/${PHOTOS.has(slug) ? slug : 'default'}.webp`;
}
