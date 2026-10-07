import {
  articleListResponseSchema,
  articleResponseSchema,
  errorResponseSchema,
  type ArticleStatus,
} from '@news/shared/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { buildTestApp } from '../../test/app';
import { BODY, insertArticle } from '../../test/articles';
import { resetDb } from '../../test/reset-db';
import { signIn, type TestActor } from '../../test/sessions';

type ActorName = 'author' | 'otherReporter' | 'editor' | 'admin' | 'dataEditor';
type Method = 'GET' | 'POST' | 'PATCH';

let app: App;
let actors: Record<ActorName, TestActor>;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await resetDb(app.db);
  await app.close();
});

beforeEach(async () => {
  await resetDb(app.db);
  actors = {
    author: await signIn(app, 'reporter'),
    otherReporter: await signIn(app, 'reporter'),
    editor: await signIn(app, 'editor'),
    admin: await signIn(app, 'admin'),
    dataEditor: await signIn(app, 'data_editor'),
  };
});

function call(actor: TestActor | null, method: Method, url: string, payload?: unknown) {
  return app.inject({
    method,
    url,
    payload: payload as Record<string, unknown> | undefined,
    cookies: actor?.cookies,
    headers: actor?.headers,
  });
}

function errorCode(res: { json: () => unknown }) {
  return errorResponseSchema.parse(res.json()).error.code;
}

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

interface RouteCase {
  name: string;
  /** Status of an article authored by `author` before the call. */
  status: ArticleStatus;
  method: Method;
  path: (id: number) => string;
  payload?: () => unknown;
  /** Expected HTTP status per actor. */
  expect: Record<ActorName, number>;
}

const ROUTES: RouteCase[] = [
  { name: 'list', status: 'draft', method: 'GET', path: () => '/v1/admin/articles', expect: { author: 200, otherReporter: 200, editor: 200, admin: 200, dataEditor: 403 } },
  { name: 'get', status: 'draft', method: 'GET', path: (id) => `/v1/admin/articles/${id}`, expect: { author: 200, otherReporter: 200, editor: 200, admin: 200, dataEditor: 403 } },
  { name: 'revisions', status: 'draft', method: 'GET', path: (id) => `/v1/admin/articles/${id}/revisions`, expect: { author: 200, otherReporter: 200, editor: 200, admin: 200, dataEditor: 403 } },
  {
    name: 'create',
    status: 'draft',
    method: 'POST',
    path: () => '/v1/admin/articles',
    payload: () => ({ title: 'Шинэ мэдээ', bodyJson: BODY }),
    expect: { author: 201, otherReporter: 201, editor: 201, admin: 201, dataEditor: 403 },
  },
  {
    name: 'update own draft',
    status: 'draft',
    method: 'PATCH',
    path: (id) => `/v1/admin/articles/${id}`,
    payload: () => ({ title: 'Засварласан' }),
    expect: { author: 200, otherReporter: 403, editor: 200, admin: 200, dataEditor: 403 },
  },
  {
    name: 'update in_review',
    status: 'in_review',
    method: 'PATCH',
    path: (id) => `/v1/admin/articles/${id}`,
    payload: () => ({ title: 'Засварласан' }),
    expect: { author: 403, otherReporter: 403, editor: 200, admin: 200, dataEditor: 403 },
  },
  {
    name: 'update published',
    status: 'published',
    method: 'PATCH',
    path: (id) => `/v1/admin/articles/${id}`,
    payload: () => ({ title: 'Засварласан', edit: { type: 'minor' } }),
    expect: { author: 403, otherReporter: 403, editor: 200, admin: 200, dataEditor: 403 },
  },
  {
    name: 'submit',
    status: 'draft',
    method: 'POST',
    path: (id) => `/v1/admin/articles/${id}/submit`,
    expect: { author: 200, otherReporter: 403, editor: 200, admin: 200, dataEditor: 403 },
  },
  {
    name: 'return-to-draft',
    status: 'in_review',
    method: 'POST',
    path: (id) => `/v1/admin/articles/${id}/return-to-draft`,
    expect: { author: 403, otherReporter: 403, editor: 200, admin: 200, dataEditor: 403 },
  },
  {
    name: 'publish',
    status: 'draft',
    method: 'POST',
    path: (id) => `/v1/admin/articles/${id}/publish`,
    expect: { author: 403, otherReporter: 403, editor: 200, admin: 200, dataEditor: 403 },
  },
  {
    name: 'schedule',
    status: 'draft',
    method: 'POST',
    path: (id) => `/v1/admin/articles/${id}/schedule`,
    payload: () => ({ scheduledAt: inOneHour() }),
    expect: { author: 403, otherReporter: 403, editor: 200, admin: 200, dataEditor: 403 },
  },
  {
    name: 'unpublish',
    status: 'published',
    method: 'POST',
    path: (id) => `/v1/admin/articles/${id}/unpublish`,
    expect: { author: 403, otherReporter: 403, editor: 200, admin: 200, dataEditor: 403 },
  },
];

const ACTOR_NAMES: ActorName[] = ['author', 'otherReporter', 'editor', 'admin', 'dataEditor'];
const MATRIX = ROUTES.flatMap((route) => ACTOR_NAMES.map((actor) => ({ route, actor })));

describe('role rules', () => {
  it.each(MATRIX.map(({ route, actor }) => [route.name, actor, route.expect[actor], route] as const))(
    '%s as %s → %i',
    async (_name, actorName, expected, route) => {
      const article = await insertArticle(app, actors.author.user.id, route.status);

      const res = await call(actors[actorName], route.method, route.path(article.id), route.payload?.());

      expect(res.statusCode, res.body).toBe(expected);
      if (expected === 403) expect(errorCode(res)).toBe('FORBIDDEN');
    },
  );

  it('restore: author on own draft, editors on any; others forbidden', async () => {
    const expected: Record<ActorName, number> = { author: 200, otherReporter: 403, editor: 200, admin: 200, dataEditor: 403 };
    for (const actorName of ACTOR_NAMES) {
      const created = await call(actors.author, 'POST', '/v1/admin/articles', { title: 'Анхны гарчиг', bodyJson: BODY });
      const id = articleResponseSchema.parse(created.json()).data.id;
      await call(actors.author, 'PATCH', `/v1/admin/articles/${id}`, { title: 'Хоёр дахь гарчиг' });
      const revisions = await call(actors.editor, 'GET', `/v1/admin/articles/${id}/revisions`);
      const first = (revisions.json() as { data: { id: number; kind: string }[] }).data.find((r) => r.kind === 'create');

      const res = await call(actors[actorName], 'POST', `/v1/admin/articles/${id}/revisions/${first!.id}/restore`);

      expect(res.statusCode, `${actorName}: ${res.body}`).toBe(expected[actorName]);
    }
  });

  it('a reporter becomes the author of what they create', async () => {
    const res = await call(actors.otherReporter, 'POST', '/v1/admin/articles', { title: 'Миний мэдээ', bodyJson: BODY });

    expect(articleResponseSchema.parse(res.json()).data.authorId).toBe(actors.otherReporter.user.id);
  });
});

describe('auth and request handling', () => {
  it('rejects anonymous requests', async () => {
    const res = await call(null, 'GET', '/v1/admin/articles');

    expect(res.statusCode).toBe(401);
  });

  it('checks auth and role before validating the body (no schema details leak)', async () => {
    const anonymous = await call(null, 'POST', '/v1/admin/articles', { nonsense: true });
    const wrongRole = await call(actors.dataEditor, 'POST', '/v1/admin/articles', { nonsense: true });

    expect(anonymous.statusCode).toBe(401);
    expect(wrongRole.statusCode).toBe(403);
  });

  it('requires the CSRF token on writes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/articles',
      cookies: actors.editor.cookies,
      payload: { title: 'x', bodyJson: BODY },
    });

    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('CSRF_INVALID');
  });

  it('sets Cache-Control: no-store', async () => {
    const res = await call(actors.editor, 'GET', '/v1/admin/articles');

    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns 404 for unknown and soft-deleted articles', async () => {
    const deleted = await insertArticle(app, actors.author.user.id, 'draft', { deletedAt: new Date() });

    for (const id of [999_999, deleted.id]) {
      const res = await call(actors.editor, 'GET', `/v1/admin/articles/${id}`);
      expect(res.statusCode).toBe(404);
      expect(errorCode(res)).toBe('ARTICLE_NOT_FOUND');
    }
  });

  it('rejects disallowed content with VALIDATION_ERROR', async () => {
    const res = await call(actors.editor, 'POST', '/v1/admin/articles', {
      title: 'XSS',
      bodyJson: { type: 'doc', content: [{ type: 'iframe', attrs: { src: 'https://evil.example' } }] },
    });

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });

  it('stores sanitized HTML rendered from the JSON body', async () => {
    const res = await call(actors.editor, 'POST', '/v1/admin/articles', {
      title: 'HTML',
      bodyJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '<img src=x onerror=alert(1)> ' },
              { type: 'text', text: 'холбоос', marks: [{ type: 'link', attrs: { href: 'https://example.mn', target: '_blank' } }] },
            ],
          },
        ],
      },
    });

    expect(articleResponseSchema.parse(res.json()).data.bodyHtml).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt; <a href="https://example.mn" target="_blank" rel="noopener noreferrer">холбоос</a></p>',
    );
  });
});

describe('list filters and pagination', () => {
  it('filters by status, author, category and title search', async () => {
    const a = actors.author.user.id;
    const b = actors.otherReporter.user.id;
    await insertArticle(app, a, 'draft', { title: 'Татварын хууль' });
    await insertArticle(app, a, 'published', { title: 'Төсвийн хэлэлцүүлэг' });
    await insertArticle(app, b, 'draft', { title: 'Татвар 100%_ өснө' });

    const list = async (query: string) =>
      articleListResponseSchema.parse((await call(actors.editor, 'GET', `/v1/admin/articles?${query}`)).json());

    expect((await list('status=published')).data.map((x) => x.title)).toEqual(['Төсвийн хэлэлцүүлэг']);
    expect((await list(`authorId=${b}`)).data).toHaveLength(1);
    expect((await list(`search=${encodeURIComponent('татвар')}`)).data).toHaveLength(2);
    // LIKE wildcards in the search term are matched literally.
    expect((await list(`search=${encodeURIComponent('100%_')}`)).data).toHaveLength(1);
    expect((await list(`search=${encodeURIComponent('%')}`)).data).toHaveLength(1);
    expect((await list('categoryId=12345')).data).toHaveLength(0);
  });

  it('paginates newest-updated first', async () => {
    for (let i = 0; i < 5; i++) {
      await insertArticle(app, actors.author.user.id, 'draft', { updatedAt: new Date(Date.UTC(2026, 0, i + 1)) });
    }

    const res = articleListResponseSchema.parse(
      (await call(actors.editor, 'GET', '/v1/admin/articles?page=2&pageSize=2')).json(),
    );

    expect(res.pagination).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
    expect(res.data.map((x) => x.updatedAt.slice(0, 10))).toEqual(['2026-01-03', '2026-01-02']);
  });
});
