import { describe, expect, it } from 'vitest';
import { parseIdSlug, parsePage, parseSlug, routes } from './routes';

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

  it('section URLs: page 1 without a number, later pages with one', () => {
    expect(routes.section('uls-tor')).toBe('/section/uls-tor');
    expect(routes.section('uls-tor', 1)).toBe('/section/uls-tor');
    expect(routes.section('uls-tor', 3)).toBe('/section/uls-tor/3');
  });

  it.each([
    ['uls-tor', 'uls-tor'],
    ['uls', 'uls'],
    ['Uls-tor', null],
    ['uls_tor', null],
    ['uls--tor', null],
    ['-uls', null],
    ['', null],
  ] as const)('parseSlug(%j)', (segment, expected) => {
    expect(parseSlug(segment)).toBe(expected);
  });

  it.each([
    ['1', 1],
    ['2', 2],
    ['10000', 10_000],
    ['10001', null],
    ['02', null],
    ['0', null],
    ['-1', null],
    ['x', null],
    ['1e3', null],
  ] as const)('parsePage(%j)', (segment, expected) => {
    expect(parsePage(segment)).toBe(expected);
  });
});
