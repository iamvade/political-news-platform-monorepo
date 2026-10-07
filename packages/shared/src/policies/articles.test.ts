import type { ArticleStatus, UserRole } from '../schemas/enums';
import { describe, expect, it } from 'vitest';
import { can, canTransition, type ArticleAction, type TransitionAction } from './articles';

const ME = 1;
const OTHER = 2;
const STATUSES: ArticleStatus[] = ['draft', 'in_review', 'scheduled', 'published', 'archived'];
const ACTIONS: ArticleAction[] = ['read', 'create', 'update', 'submit', 'returnToDraft', 'publish', 'schedule', 'unpublish'];

describe('can()', () => {
  it.each<UserRole>(['editor', 'admin'])('%s can do every action on any article', (role) => {
    for (const action of ACTIONS) {
      for (const status of STATUSES) {
        expect(can({ id: ME, role }, action, { authorId: OTHER, status })).toBe(true);
      }
    }
  });

  it('data_editor can do nothing', () => {
    for (const action of ACTIONS) {
      expect(can({ id: ME, role: 'data_editor' }, action)).toBe(false);
      expect(can({ id: ME, role: 'data_editor' }, action, { authorId: ME, status: 'draft' })).toBe(false);
    }
  });

  describe('reporter', () => {
    const reporter = { id: ME, role: 'reporter' as const };

    it('can read and create', () => {
      expect(can(reporter, 'read')).toBe(true);
      expect(can(reporter, 'read', { authorId: OTHER, status: 'published' })).toBe(true);
      expect(can(reporter, 'create')).toBe(true);
    });

    it.each<ArticleAction>(['update', 'submit'])('can %s only their own drafts', (action) => {
      for (const status of STATUSES) {
        expect(can(reporter, action, { authorId: ME, status })).toBe(status === 'draft');
        expect(can(reporter, action, { authorId: OTHER, status })).toBe(false);
      }
      expect(can(reporter, action)).toBe(false);
    });

    it.each<ArticleAction>(['returnToDraft', 'publish', 'schedule', 'unpublish'])('can never %s', (action) => {
      for (const status of STATUSES) {
        expect(can(reporter, action, { authorId: ME, status })).toBe(false);
      }
    });
  });
});

describe('canTransition()', () => {
  const allowed: Record<TransitionAction, ArticleStatus[]> = {
    submit: ['draft'],
    returnToDraft: ['in_review'],
    publish: ['draft', 'in_review', 'scheduled'],
    schedule: ['draft', 'in_review', 'scheduled'],
    unpublish: ['published', 'scheduled'],
  };

  it.each(Object.entries(allowed) as [TransitionAction, ArticleStatus[]][])('%s', (action, from) => {
    for (const status of STATUSES) {
      expect(canTransition(action, status)).toBe(from.includes(status));
    }
  });
});
