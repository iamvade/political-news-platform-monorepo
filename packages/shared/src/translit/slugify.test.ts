import { describe, expect, it } from 'vitest';
import { SLUG_MAX_LENGTH, SLUG_PATTERN, slugify } from './slugify';

describe('slugify', () => {
  it.each([
    ['УИХ Татварын ерөнхий хуулийг баталлаа', 'uikh-tatvaryn-eronkhii-khuuliig-batallaa'],
    ['Үүрцайх Өлзийбаяр', 'uurtsaikh-olziibayar'],
    ['Жаргал, Цэцэг & Чимэг!', 'jargal-tsetseg-chimeg'],
    ['Яамны ёс зүй, Юу болов?', 'yaamny-yos-zui-yuu-bolov'],
    ['2026 оны төсөв', '2026-ony-tosov'],
    ['Café déjà vu', 'cafe-deja-vu'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
    expect(slugify(input)).toMatch(SLUG_PATTERN);
  });

  it('falls back when nothing usable remains', () => {
    expect(slugify('!!! ???')).toBe('article');
    expect(slugify('', 'x')).toBe('x');
  });

  it('caps the length at a word boundary', () => {
    const slug = slugify('Улсын Их Хурлын нэгдсэн хуралдаанаар хэлэлцсэн '.repeat(5));

    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug).toMatch(SLUG_PATTERN);
  });
});
