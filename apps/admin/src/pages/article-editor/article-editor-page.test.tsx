import type { Article, ArticleRevision, LookupItem, UserRole } from '@news/shared/schemas';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fullArticle, media, page, session } from '@/test/fixtures';
import { apiError, mockApi, type MockHandler, type MockRequest } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';
import { AUTOSAVE_INTERVAL_MS } from './article-editor';

const items = (data: LookupItem[]) => ({ status: 200, body: { data } });

/** Session + the article + the lookups every editor screen loads. */
function mockEditor(role: UserRole, article: Article, extra: Record<string, MockHandler> = {}) {
  return mockApi({
    'GET /v1/admin/auth/me': () => session(role),
    [`GET /v1/admin/articles/${article.id}`]: () => ({ body: { data: article } }),
    'GET /v1/admin/lookup/categories': () => items([{ id: 2, label: 'Улс төр', sublabel: null, imageUrl: null }]),
    'GET /v1/admin/articles': () => page([]),
    ...extra,
  });
}

const titleInput = () => screen.findByRole('textbox', { name: 'Гарчиг' });
const patches = (calls: MockRequest[], id = 12) => calls.filter((c) => c.method === 'PATCH' && c.path === `/v1/admin/articles/${id}`);

afterEach(() => {
  vi.useRealTimers();
});

describe('article editor: loading and saving', () => {
  it('loads the article into the form', async () => {
    mockEditor('reporter', fullArticle(12));
    renderApp('/articles/12');

    expect(await titleInput()).toHaveValue('Нийтлэл 12');
    expect(screen.getByRole('textbox', { name: 'Товч агуулга' })).toHaveValue('Товч агуулга');
    expect(await screen.findByText('Улсын Их Хурал хуралдлаа.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Хадгалсан');
  });

  it('autosaves unsaved changes every 15 s with autosave and expectedUpdatedAt', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const article = fullArticle(12);
    const { calls } = mockEditor('reporter', article, {
      'PATCH /v1/admin/articles/12': (req) => ({ body: { data: { ...article, ...(req.body as object), updatedAt: '2026-10-07T01:00:00.000Z' } } }),
    });
    renderApp('/articles/12');
    const user = userEvent.setup();

    await user.type(await titleInput(), ' шинэ');
    expect(screen.getByRole('status')).toHaveTextContent('Хадгалаагүй өөрчлөлт байна');
    act(() => vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.body).toMatchObject({
      title: 'Нийтлэл 12 шинэ',
      autosave: true,
      expectedUpdatedAt: article.updatedAt,
      personIds: [],
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Хадгалсан'));

    // Nothing changed since: the next tick sends nothing; the next save uses the new updatedAt.
    act(() => vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS));
    await user.type(await titleInput(), '!');
    act(() => vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS));
    await waitFor(() => expect(patches(calls)).toHaveLength(2));
    expect(patches(calls)[1]!.body).toMatchObject({ expectedUpdatedAt: '2026-10-07T01:00:00.000Z' });
  });

  it('stops autosaving and offers a reload on 409 EDIT_CONFLICT', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { calls } = mockEditor('reporter', fullArticle(12), {
      'PATCH /v1/admin/articles/12': () => apiError(409, 'EDIT_CONFLICT'),
    });
    renderApp('/articles/12');
    const user = userEvent.setup();

    await user.type(await titleInput(), ' шинэ');
    act(() => vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS));

    expect(await screen.findByText('Өөр хэрэглэгч энэ нийтлэлийг хадгалсан байна')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Дахин ачаалах' })).toBeInTheDocument();
    expect(await titleInput()).toHaveAttribute('readonly');
    act(() => vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS * 3));
    expect(patches(calls)).toHaveLength(1);
  });

  it('creates a new article on the first save and moves to its URL', async () => {
    const created = fullArticle(31, { title: 'Шинэ мэдээ' });
    const { calls } = mockApi({
      'GET /v1/admin/auth/me': () => session('reporter'),
      'GET /v1/admin/lookup/categories': () => items([]),
      'POST /v1/admin/articles': () => ({ status: 201, body: { data: created } }),
    });
    const app = renderApp('/articles/new');
    const user = userEvent.setup();

    await user.type(await titleInput(), 'Шинэ мэдээ');
    await user.click(screen.getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(app.location()).toBe('/articles/31'));
    const post = calls.find((c) => c.method === 'POST' && c.path === '/v1/admin/articles');
    expect(post?.body).toMatchObject({ title: 'Шинэ мэдээ', bodyJson: { type: 'doc' }, lede: null, tagIds: [] });
    expect(await titleInput()).toHaveValue('Шинэ мэдээ');
    expect(screen.getByRole('heading', { name: 'Нийтлэл засах' })).toBeInTheDocument();
  });

  it('asks for the edit type when saving a published article', async () => {
    const article = fullArticle(12, { status: 'published', publishedAt: '2026-10-01T02:00:00.000Z' });
    const { calls } = mockEditor('editor', article, {
      'PATCH /v1/admin/articles/12': (req) => ({ body: { data: { ...article, ...(req.body as object) } } }),
    });
    renderApp('/articles/12');
    const user = userEvent.setup();

    await user.type(await titleInput(), ' (засвар)');
    await user.click(screen.getByRole('button', { name: 'Хадгалах' }));
    const dialog = await screen.findByRole('dialog', { name: 'Нийтлэгдсэн нийтлэлийг засах' });
    await user.click(within(dialog).getByRole('radio', { name: /Агуулгын залруулга/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Юуг зассан бэ' }), 'Тоог зассан');
    await user.type(within(dialog).getByRole('textbox', { name: 'Шалтгаан' }), 'Алдаа');
    await user.click(within(dialog).getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.body).toMatchObject({
      edit: { type: 'substantive', correction: { description: 'Тоог зассан', reason: 'Алдаа' } },
    });
    expect(patches(calls)[0]!.body).not.toHaveProperty('autosave');
  });
});

describe('article editor: workflow', () => {
  const buttonNames = () =>
    ['Хянуулахаар илгээх', 'Ноорог руу буцаах', 'Нийтлэх', 'Төлөвлөх', 'Нийтлэлээс хасах'].filter((name) => screen.queryByRole('button', { name }));

  it.each<[UserRole, Article['status'], string[]]>([
    ['reporter', 'draft', ['Хянуулахаар илгээх']],
    ['editor', 'draft', ['Хянуулахаар илгээх', 'Нийтлэх', 'Төлөвлөх']],
    ['editor', 'in_review', ['Ноорог руу буцаах', 'Нийтлэх', 'Төлөвлөх']],
    ['admin', 'published', ['Нийтлэлээс хасах']],
    ['reporter', 'in_review', []],
  ])('%s on a %s article sees %j', async (role, status, expected) => {
    mockEditor(role, fullArticle(12, { status, publishedAt: status === 'published' ? '2026-10-01T02:00:00.000Z' : null }));
    renderApp('/articles/12');

    await titleInput();
    expect(buttonNames()).toEqual(expected);
  });

  it('shows a reporter a read-only editor for a submitted article', async () => {
    mockEditor('reporter', fullArticle(12, { status: 'in_review' }));
    renderApp('/articles/12');

    expect(await screen.findByText('Зөвхөн унших горим')).toBeInTheDocument();
    expect(await titleInput()).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Хадгалах' })).not.toBeInTheDocument();
  });

  it('schedules with the UTC instant of the entered Ulaanbaatar time', async () => {
    const article = fullArticle(12, { status: 'in_review' });
    const { calls } = mockEditor('editor', article, {
      'POST /v1/admin/articles/12/schedule': (req) => ({
        body: { data: { ...article, status: 'scheduled', scheduledAt: (req.body as { scheduledAt: string }).scheduledAt } },
      }),
    });
    renderApp('/articles/12');
    await titleInput();

    fireEvent.change(screen.getByLabelText('Нийтлэх цаг'), { target: { value: '2030-01-02T09:30' } });
    await userEvent.click(screen.getByRole('button', { name: 'Төлөвлөх' }));

    await waitFor(() => expect(calls.some((c) => c.path === '/v1/admin/articles/12/schedule')).toBe(true));
    expect(calls.find((c) => c.path === '/v1/admin/articles/12/schedule')?.body).toEqual({ scheduledAt: '2030-01-02T01:30:00.000Z' });
    expect(await screen.findByText('Нийтлэх цагийг товлолоо.')).toBeInTheDocument();
  });

  it('refuses a schedule time in the past', async () => {
    const { calls } = mockEditor('editor', fullArticle(12));
    renderApp('/articles/12');
    await titleInput();

    fireEvent.change(screen.getByLabelText('Нийтлэх цаг'), { target: { value: '2020-01-01T10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Төлөвлөх' }));

    expect(await screen.findByText('Ирээдүйн цаг сонгоно уу.')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/schedule'))).toBe(false);
  });

  it('saves pending changes before submitting', async () => {
    const article = fullArticle(12);
    const { calls } = mockEditor('reporter', article, {
      'PATCH /v1/admin/articles/12': (req) => ({ body: { data: { ...article, ...(req.body as object) } } }),
      'POST /v1/admin/articles/12/submit': () => ({ body: { data: { ...article, status: 'in_review' } } }),
    });
    renderApp('/articles/12');
    const user = userEvent.setup();

    await user.type(await titleInput(), '!');
    await user.click(screen.getByRole('button', { name: 'Хянуулахаар илгээх' }));

    await screen.findByText('Хянуулахаар илгээлээ.');
    const order = calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);
    expect(order).toEqual(['PATCH /v1/admin/articles/12', 'POST /v1/admin/articles/12/submit']);
  });
});

describe('article editor: metadata', () => {
  it('does not let a cover without credit be chosen', async () => {
    const noCredit = media(4, { credit: null });
    const { calls } = mockEditor('editor', fullArticle(12), {
      'GET /v1/admin/media': () => page([noCredit]),
      'GET /v1/admin/media/4': () => ({ body: { data: noCredit } }),
      'PATCH /v1/admin/media/4': (req) => ({ body: { data: { ...noCredit, ...(req.body as object) } } }),
    });
    renderApp('/articles/12');
    const user = userEvent.setup();
    await titleInput();

    await user.click(screen.getByRole('button', { name: 'Нүүр зураг сонгох' }));
    const dialog = await screen.findByRole('dialog', { name: 'Нүүр зураг сонгох' });
    await user.click(await within(dialog).findByRole('option', { name: 'Төрийн ордон' }));

    const select = within(dialog).getByRole('button', { name: 'Сонгох' });
    expect(select).toBeDisabled();
    expect(within(dialog).getByText('Нүүр зурагт тайлбар болон эх сурвалж заавал шаардлагатай.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Эх сурвалж'), 'Б.Сараа');
    expect(select).toBeEnabled();
    await user.click(select);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === 'PATCH' && c.path === '/v1/admin/media/4')?.body).toEqual({ alt: 'Төрийн ордон', credit: 'Б.Сараа' });
    expect(screen.getByRole('status')).toHaveTextContent('Хадгалаагүй өөрчлөлт байна');
  });

  it('hydrates linked persons and adds new ones from search', async () => {
    const article = fullArticle(12, { personIds: [3] });
    const { calls } = mockEditor('reporter', article, {
      'GET /v1/admin/lookup/persons': (req) =>
        req.query.get('ids') === '3'
          ? items([{ id: 3, label: 'Г.Батбаяр', sublabel: 'МАН', imageUrl: 'https://media.test/p3.webp' }])
          : items([{ id: 5, label: 'Д.Сарантуяа', sublabel: null, imageUrl: null }]),
      'PATCH /v1/admin/articles/12': (req) => ({ body: { data: { ...article, ...(req.body as object) } } }),
    });
    renderApp('/articles/12');
    const user = userEvent.setup();

    const chips = await screen.findByRole('list', { name: 'Холбогдох хүмүүс' });
    expect(await within(chips).findByText('Г.Батбаяр')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Холбогдох хүмүүс нэмэх' }));
    await user.click(await screen.findByRole('option', { name: /Д\.Сарантуяа/ }));
    await user.keyboard('{Escape}');
    expect(within(chips).getByText('Д.Сарантуяа')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Хадгалах' }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.body).toMatchObject({ personIds: [3, 5] });
  });
});

describe('article editor: leaving and history', () => {
  it('asks before leaving with unsaved changes', async () => {
    mockEditor('reporter', fullArticle(12));
    const app = renderApp('/articles/12');
    const user = userEvent.setup();

    await user.type(await titleInput(), '!');
    await user.click(screen.getByRole('link', { name: 'Нийтлэлийн жагсаалт руу буцах' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(app.location()).toBe('/articles/12');
    await user.click(within(dialog).getByRole('button', { name: 'Хадгалахгүй гарах' }));
    await waitFor(() => expect(app.location()).toBe('/articles'));
  });

  it('leaves without asking when everything is saved', async () => {
    mockEditor('reporter', fullArticle(12));
    const app = renderApp('/articles/12');

    await titleInput();
    await userEvent.click(screen.getByRole('link', { name: 'Нийтлэлийн жагсаалт руу буцах' }));

    await waitFor(() => expect(app.location()).toBe('/articles'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows a diff of a revision and restores it', async () => {
    const article = fullArticle(12, { title: 'Шинэ гарчиг' });
    const revision: ArticleRevision = {
      id: 101,
      articleId: 12,
      kind: 'update',
      editorId: 7,
      createdAt: '2026-10-05T03:00:00.000Z',
      snapshot: { title: 'Хуучин гарчиг', lede: 'Товч агуулга', bodyJson: article.bodyJson, categoryId: null, coverMediaId: null, isBreaking: false },
    };
    const { calls } = mockEditor('reporter', article, {
      'GET /v1/admin/articles/12/revisions': () => page([revision]),
      'POST /v1/admin/articles/12/revisions/101/restore': () => ({ body: { data: { ...article, title: 'Хуучин гарчиг' } } }),
    });
    renderApp('/articles/12');
    const user = userEvent.setup();
    await titleInput();

    await user.click(screen.getByRole('button', { name: 'Хувилбарууд' }));
    await user.click(await screen.findByRole('button', { name: /Хадгалсан.*Та/ }));
    const diff = screen.getByRole('region', { name: 'Сонгосон хувилбараас хойшхи өөрчлөлт' });
    expect(within(diff).getByText('Хуучин', { selector: 'del' })).toBeInTheDocument();
    expect(within(diff).getByText('Шинэ', { selector: 'ins' })).toBeInTheDocument();

    await user.click(within(diff).getByRole('button', { name: 'Сэргээх' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Сэргээх' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/revisions/101/restore'))).toBe(true));
    await waitFor(async () => expect(await titleInput()).toHaveValue('Хуучин гарчиг'));
  });
});
