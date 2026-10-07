import type { AdminHomepage, UserRole } from '@news/shared/schemas';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiError, mockApi, type MockHandler, type MockRequest } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';
import { article, fullArticle, lookupItems, page, session } from '@/test/fixtures';
import { move } from './homepage-page';

const layout = (overrides: Partial<AdminHomepage> = {}): AdminHomepage => ({
  version: 4,
  zones: { heroArticleId: 1, featuredArticleIds: [2], sectionCategoryIds: [10, 11] },
  articles: [article(1, { title: 'Гол мэдээ А' }), article(2, { title: 'Онцлох Б' })],
  categories: [
    { id: 10, nameMn: 'Улс төр' },
    { id: 11, nameMn: 'Эдийн засаг' },
  ],
  createdAt: '2026-10-06T02:00:00.000Z',
  createdBy: 7,
  ...overrides,
});

function mockHomepage(extra: Record<string, MockHandler> = {}, role: UserRole = 'editor') {
  return mockApi({
    'GET /v1/admin/auth/me': () => session(role),
    'GET /v1/admin/homepage': () => ({ body: { data: layout() } }),
    'GET /v1/admin/lookup/categories': () =>
      lookupItems([
        { id: 10, label: 'Улс төр' },
        { id: 11, label: 'Эдийн засаг' },
        { id: 12, label: 'Нийгэм' },
      ]),
    'GET /v1/admin/articles': () => page([article(3, { title: 'Шинэ мэдээ В' })]),
    ...extra,
  });
}

const sectionNames = () =>
  within(screen.getByRole('list', { name: 'Ангиллын хэсгүүд' }))
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.font-medium')?.textContent);
const puts = (calls: MockRequest[]) => calls.filter((c) => c.method === 'PUT' && c.path === '/v1/admin/homepage').map((c) => c.body);

describe('move', () => {
  it('moves an item and ignores out-of-range moves', () => {
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(move([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(move([1, 2, 3], 0, 5)).toEqual([1, 2, 3]);
  });
});

describe('homepage editor', () => {
  it('shows the live layout', async () => {
    mockHomepage();
    renderApp('/homepage');

    expect(await screen.findByText('Гол мэдээ А')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Онцлох мэдээ' })).getByText('Онцлох Б')).toBeInTheDocument();
    expect(sectionNames()).toEqual(['Улс төр', 'Эдийн засаг']);
    expect(screen.getByRole('status')).toHaveTextContent('Идэвхтэй хувилбар #4');
  });

  it('pins a featured article, reorders sections and saves a new version', async () => {
    const { calls } = mockHomepage({
      'PUT /v1/admin/homepage': (req) => {
        const body = req.body as { zones: AdminHomepage['zones'] };
        return { body: { data: layout({ version: 5, zones: body.zones, articles: [...layout().articles, article(3, { title: 'Шинэ мэдээ В' })] }) } };
      },
    });
    renderApp('/homepage');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Нэмэх' }));
    await user.click(await screen.findByRole('button', { name: /Шинэ мэдээ В/ }));
    await user.click(screen.getByRole('button', { name: '«Улс төр»-г доош' }));
    expect(sectionNames()).toEqual(['Эдийн засаг', 'Улс төр']);
    await user.click(screen.getByRole('button', { name: 'Хадгалж нийтлэх' }));

    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]).toEqual({
      zones: { heroArticleId: 1, featuredArticleIds: [2, 3], sectionCategoryIds: [11, 10] },
      expectedVersion: 4,
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Идэвхтэй хувилбар #5'));
  });

  it('reorders sections by drag and drop', async () => {
    mockHomepage();
    renderApp('/homepage');

    const politics = await screen.findByTestId('section-10');
    const economy = screen.getByTestId('section-11');
    fireEvent.dragStart(economy);
    fireEvent.dragOver(politics);
    fireEvent.drop(politics);

    expect(sectionNames()).toEqual(['Эдийн засаг', 'Улс төр']);
    expect(screen.getByRole('status')).toHaveTextContent('Хадгалаагүй өөрчлөлт байна');
  });

  it('adds a category section', async () => {
    mockHomepage();
    renderApp('/homepage');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('combobox', { name: 'Ангилал нэмэх…' }));
    await user.click(await screen.findByRole('option', { name: 'Нийгэм' }));

    expect(sectionNames()).toEqual(['Улс төр', 'Эдийн засаг', 'Нийгэм']);
  });

  it('stops on an edit conflict and offers a reload', async () => {
    mockHomepage({ 'PUT /v1/admin/homepage': () => apiError(409, 'EDIT_CONFLICT') });
    renderApp('/homepage');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '«Улс төр»-г хасах' }));
    await user.click(screen.getByRole('button', { name: 'Хадгалж нийтлэх' }));

    expect(await screen.findByText('Өөр хэрэглэгч нүүр хуудсыг хадгалсан байна')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Хадгалж нийтлэх' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Дахин ачаалах' })).toBeInTheDocument();
  });

  it('warns about pinned articles that are no longer published', async () => {
    mockHomepage({
      'GET /v1/admin/homepage': () => ({ body: { data: layout({ articles: [article(1, { title: 'Гол мэдээ А', status: 'draft' }), article(2)] }) } }),
    });
    renderApp('/homepage');

    expect(await screen.findByText('Нийтлэгдээгүй нийтлэл байна')).toBeInTheDocument();
  });

  it('loads an older version into the editor', async () => {
    const { calls } = mockHomepage({
      'GET /v1/admin/homepage/versions': () =>
        page([
          { version: 4, zones: layout().zones, createdAt: '2026-10-06T02:00:00.000Z', createdBy: 7 },
          { version: 3, zones: { heroArticleId: 8, featuredArticleIds: [], sectionCategoryIds: [12] }, createdAt: '2026-10-01T02:00:00.000Z', createdBy: 9 },
        ]),
      'GET /v1/admin/articles/8': () => ({ body: { data: fullArticle(8, { title: 'Хуучин гол мэдээ', status: 'published' }) } }),
    });
    renderApp('/homepage');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Хувилбарууд' }));
    await user.click(await screen.findByRole('button', { name: 'Ачаалах' }));

    expect(await screen.findByText('Хуучин гол мэдээ')).toBeInTheDocument();
    expect(sectionNames()).toEqual(['Нийгэм']);
    expect(calls.some((c) => c.path === '/v1/admin/articles/8')).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Хадгалаагүй өөрчлөлт байна');
  });

  it('is not available to reporters', async () => {
    mockHomepage({}, 'reporter');
    renderApp('/homepage');

    expect(await screen.findByText('Хандах эрхгүй')).toBeInTheDocument();
  });
});
