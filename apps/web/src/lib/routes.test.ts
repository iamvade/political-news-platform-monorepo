import { describe, expect, it } from 'vitest';
import { parseIdSlug, routes } from './routes';

describe('routes', () => {
  it('builds canonical id + slug URLs', () => {
    expect(routes.article({ id: 42, slug: 'tosov' })).toBe('/news/42-tosov');
    expect(routes.person({ id: 12, slug: 'g-batbayar' })).toBe('/person/12-g-batbayar');
  });

  it.each([
    ['42-tosov-batlav', { id: 42, slug: 'tosov-batlav' }],
    ['42', null],
    ['tosov', null],
    ['0-tosov', null],
    ['42-Tosov', null],
    ['42-tosov--x', null],
  ] as const)('parseIdSlug(%s)', (segment, expected) => {
    expect(parseIdSlug(segment)).toEqual(expected);
  });
});
