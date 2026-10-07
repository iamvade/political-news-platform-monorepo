import { describe, expect, it } from 'vitest';
import { pageRange } from './pagination';

describe('pageRange', () => {
  it.each([
    [1, 0, []],
    [1, 1, [1]],
    [1, 5, [1, 2, 3, 4, 5]],
    [4, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 10, [1, 2, 'gap', 10]],
    [5, 10, [1, 'gap', 4, 5, 6, 'gap', 10]],
    [10, 10, [1, 'gap', 9, 10]],
    [3, 10, [1, 2, 3, 4, 'gap', 10]],
    [4, 10, [1, 2, 3, 4, 5, 'gap', 10]],
    [8, 10, [1, 'gap', 7, 8, 9, 10]],
    [99, 10, [1, 'gap', 9, 10]],
  ] as const)('page %i of %i', (page, total, expected) => {
    expect(pageRange(page, total)).toEqual(expected);
  });
});
