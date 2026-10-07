import { describe, expect, it } from 'vitest';
import { positionImportRowSchema, voteImportBodySchema, voteImportRowSchema } from './imports';

const vote = { value: 'yes', date: '2025-04-17', motion: 'final_vote', sourceUrl: 'https://source.example/v' };

describe('import row schemas', () => {
  it.each([
    ['slugs', { billSlug: 'tax-bill', personSlug: 'g-batbayar' }, true],
    ['ids', { billId: 1, personId: 2 }, true],
    ['mixed', { billId: 1, personSlug: 'g-batbayar' }, true],
    ['both bill id and slug', { billId: 1, billSlug: 'tax-bill', personSlug: 'g-batbayar' }, false],
    ['no person', { billSlug: 'tax-bill' }, false],
  ])('vote row with %s → %s', (_label, refs, valid) => {
    expect(voteImportRowSchema.safeParse({ ...vote, ...refs }).success).toBe(valid);
  });

  it('position row requires exactly one org ref and ordered dates', () => {
    const base = { personSlug: 'g-batbayar', titleMn: 'Гишүүн', startDate: '2020-01-01', sourceUrl: 'https://source.example/p' };

    expect(positionImportRowSchema.safeParse({ ...base, organizationSlug: 'mpp' }).success).toBe(true);
    expect(positionImportRowSchema.safeParse({ ...base, organizationSlug: 'mpp', organizationId: 3 }).success).toBe(false);
    expect(positionImportRowSchema.safeParse({ ...base, organizationSlug: 'mpp', endDate: '2019-12-31' }).success).toBe(false);
  });

  it('defaults dryRun to false and caps rows', () => {
    const row = { ...vote, billId: 1, personId: 2 };

    expect(voteImportBodySchema.parse({ rows: [row] }).dryRun).toBe(false);
    expect(voteImportBodySchema.safeParse({ rows: [] }).success).toBe(false);
    expect(voteImportBodySchema.safeParse({ rows: Array.from({ length: 5_001 }, () => row) }).success).toBe(false);
  });
});
