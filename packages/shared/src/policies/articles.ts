import type { AuthUser } from '../schemas/auth';
import type { ArticleStatus } from '../schemas/enums';

export type ArticleAction =
  | 'read'
  | 'create'
  | 'update'
  | 'submit'
  | 'returnToDraft'
  | 'publish'
  | 'schedule'
  | 'unpublish';

export type TransitionAction = 'submit' | 'returnToDraft' | 'publish' | 'schedule' | 'unpublish';

interface ArticleRef {
  authorId: number;
  status: ArticleStatus;
}

/**
 * Who may do what with articles. Shared by the API (enforcement) and the admin (which buttons to show).
 * - editor, admin: everything.
 * - reporter: read all; create; update and submit only their own drafts.
 * - data_editor: nothing.
 */
export function can(user: Pick<AuthUser, 'id' | 'role'>, action: ArticleAction, article?: ArticleRef): boolean {
  switch (user.role) {
    case 'editor':
    case 'admin':
      return true;
    case 'data_editor':
      return false;
    case 'reporter':
      switch (action) {
        case 'read':
        case 'create':
          return true;
        case 'update':
        case 'submit':
          return article !== undefined && article.authorId === user.id && article.status === 'draft';
        default:
          return false;
      }
  }
}

/** Allowed status transitions. Anything else is 409 INVALID_STATUS_TRANSITION. */
export const TRANSITIONS: Record<TransitionAction, { from: readonly ArticleStatus[]; to: ArticleStatus }> = {
  submit: { from: ['draft'], to: 'in_review' },
  returnToDraft: { from: ['in_review'], to: 'draft' },
  publish: { from: ['draft', 'in_review', 'scheduled'], to: 'published' },
  schedule: { from: ['draft', 'in_review', 'scheduled'], to: 'scheduled' },
  unpublish: { from: ['published', 'scheduled'], to: 'draft' },
};

export function canTransition(action: TransitionAction, from: ArticleStatus): boolean {
  return TRANSITIONS[action].from.includes(from);
}
