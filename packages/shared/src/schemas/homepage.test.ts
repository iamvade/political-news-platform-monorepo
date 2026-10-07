import { describe, expect, it } from 'vitest';
import { homepageZonesSchema } from './homepage';
import { createPromiseBodySchema, updatePromiseBodySchema } from './records';

describe('homepageZonesSchema', () => {
  it('accepts a hero, up to 4 featured articles and ordered sections', () => {
    expect(homepageZonesSchema.safeParse({ heroArticleId: 1, featuredArticleIds: [2, 3, 4, 5], sectionCategoryIds: [3, 1] }).success).toBe(true);
    expect(homepageZonesSchema.safeParse({ heroArticleId: null, featuredArticleIds: [], sectionCategoryIds: [] }).success).toBe(true);
  });

  it.each([
    ['five featured', { heroArticleId: null, featuredArticleIds: [1, 2, 3, 4, 5], sectionCategoryIds: [] }],
    ['duplicate featured', { heroArticleId: null, featuredArticleIds: [2, 2], sectionCategoryIds: [] }],
    ['hero also featured', { heroArticleId: 2, featuredArticleIds: [2], sectionCategoryIds: [] }],
    ['duplicate section', { heroArticleId: null, featuredArticleIds: [], sectionCategoryIds: [1, 1] }],
  ])('rejects %s', (_label, zones) => {
    expect(homepageZonesSchema.safeParse(zones).success).toBe(false);
  });
});

describe('promise bodies', () => {
  it('refuse a status (it changes only through the status endpoint)', () => {
    const base = { personId: 1, textMn: 'Амлалт', madeOn: '2024-06-10', sourceUrl: 'https://source.example/a' };
    expect(createPromiseBodySchema.safeParse(base).success).toBe(true);
    expect(createPromiseBodySchema.safeParse({ ...base, status: 'kept' }).success).toBe(false);
    expect(updatePromiseBodySchema.safeParse({ status: 'kept' }).success).toBe(false);
  });
});
