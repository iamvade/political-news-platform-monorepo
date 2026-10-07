import type { UserRole } from '@news/shared/schemas';
import { describe, expect, it } from 'vitest';
import { canAccess, defaultPath, safeNext, visibleSections } from './navigation';

describe('navigation', () => {
  it.each<[UserRole, string[]]>([
    ['reporter', ['articles', 'media']],
    ['editor', ['articles', 'media', 'homepage']],
    ['data_editor', ['persons', 'organizations', 'bills', 'promises', 'corrections', 'media']],
    ['admin', ['articles', 'persons', 'organizations', 'bills', 'promises', 'corrections', 'media', 'homepage', 'users']],
  ])('%s sees %j', (role, keys) => {
    expect(visibleSections(role).map((s) => s.key)).toEqual(keys);
  });

  it('defaultPath is the first visible section', () => {
    expect(defaultPath('reporter')).toBe('/articles');
    expect(defaultPath('data_editor')).toBe('/persons');
  });

  it('canAccess mirrors the menu', () => {
    expect(canAccess('reporter', 'users')).toBe(false);
    expect(canAccess('data_editor', 'articles')).toBe(false);
    expect(canAccess('admin', 'users')).toBe(true);
  });

  it.each([
    ['/articles?status=draft', '/articles?status=draft'],
    ['//evil.example', null],
    ['/\\evil.example', null],
    ['https://evil.example', null],
    ['/login?next=/x', null],
    [null, null],
  ])('safeNext(%s) → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
