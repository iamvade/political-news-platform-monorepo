import type { AdminMedia, Article, ArticleSummary, AuthUser, UserRole } from '@news/shared/schemas';

export function user(role: UserRole = 'editor'): AuthUser {
  return { id: 7, email: `${role}@newsroom.example`, displayName: 'Б.Сараа', role };
}

export const session = (role: UserRole = 'editor') => ({ status: 200, body: { data: { user: user(role), csrfToken: 'csrf-token-123' } } });

export function article(id: number, overrides: Partial<ArticleSummary> = {}): ArticleSummary {
  return {
    id,
    title: `Нийтлэл ${id}`,
    slug: `niitlel-${id}`,
    status: 'published',
    authorId: 7,
    categoryId: null,
    isBreaking: false,
    publishedAt: '2026-10-01T02:00:00.000Z',
    scheduledAt: null,
    updatedAt: '2026-10-02T03:00:00.000Z',
    ...overrides,
  };
}

export function page<T>(data: T[], { page = 1, pageSize = 20, total = data.length } = {}) {
  return { status: 200, body: { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } };
}

export function media(id: number, overrides: Partial<AdminMedia> = {}): AdminMedia {
  return {
    id,
    status: 'ready',
    mime: 'image/jpeg',
    width: 1600,
    height: 900,
    byteSize: 240_000,
    originalFilename: 'zurag.jpg',
    alt: 'Төрийн ордон',
    credit: 'Б.Сараа',
    processingError: null,
    uploadedBy: 7,
    variants: [{ width: 320, height: 180, url: 'https://media.test/media/1/w320.webp' }],
    createdAt: '2026-10-01T02:00:00.000Z',
    updatedAt: '2026-10-01T02:00:00.000Z',
    ...overrides,
  };
}

/** Full article as returned by GET /v1/admin/articles/:id (author = the fixture user, id 7). */
export function fullArticle(id: number, overrides: Partial<Article> = {}): Article {
  return {
    ...article(id, { status: 'draft', publishedAt: null }),
    lede: 'Товч агуулга',
    bodyJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Улсын Их Хурал хуралдлаа.' }] }] },
    bodyHtml: '<p>Улсын Их Хурал хуралдлаа.</p>',
    coverMediaId: null,
    createdAt: '2026-10-01T02:00:00.000Z',
    tagIds: [],
    personIds: [],
    organizationIds: [],
    billIds: [],
    ...overrides,
  };
}
