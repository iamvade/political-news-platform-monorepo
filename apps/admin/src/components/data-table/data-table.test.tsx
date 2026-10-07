import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { article, media, page, session } from '@/test/fixtures';
import { apiError, mockApi, type MockRequest } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

const lastListCall = (calls: MockRequest[], path = '/v1/admin/articles') => calls.filter((c) => c.path === path).at(-1)!;

/** 45 articles; the handler pages them like the API does. */
function articlesApi() {
  const all = Array.from({ length: 45 }, (_, i) => article(i + 1));
  return mockApi({
    'GET /v1/admin/auth/me': () => session('editor'),
    'GET /v1/admin/articles': ({ query }) => {
      const p = Number(query.get('page') ?? 1);
      const size = Number(query.get('pageSize') ?? 20);
      const search = query.get('search');
      const rows = search ? all.filter((a) => a.title.includes(search)) : all;
      return page(rows.slice((p - 1) * size, p * size), { page: p, pageSize: size, total: rows.length });
    },
  });
}

describe('DataTable (Articles list)', () => {
  it('renders rows, translated statuses and pagination summary', async () => {
    articlesApi();
    renderApp('/articles');

    expect(await screen.findByText('Нийтлэл 1')).toBeInTheDocument();
    expect(screen.getAllByText('Нийтлэгдсэн').length).toBeGreaterThan(0);
    expect(screen.getByText('Нийт 45')).toBeInTheDocument();
    expect(screen.getByText('1 / 3 хуудас')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Өмнөх' })).toBeDisabled();
  });

  it('paginates through the URL', async () => {
    const { calls } = articlesApi();
    const app = renderApp('/articles');
    const ui = userEvent.setup();

    await screen.findByText('Нийтлэл 1');
    await ui.click(screen.getByRole('button', { name: /Дараах/ }));

    expect(await screen.findByText('Нийтлэл 21')).toBeInTheDocument();
    expect(app.location()).toBe('/articles?page=2');
    expect(lastListCall(calls).query.get('page')).toBe('2');
  });

  it('debounces search into the URL and the API, resetting to page 1', async () => {
    const { calls } = articlesApi();
    const app = renderApp('/articles?page=2');
    const ui = userEvent.setup();

    await screen.findByText('Нийтлэл 21');
    await ui.type(screen.getByRole('searchbox', { name: 'Гарчгаар хайх…' }), 'Нийтлэл 4');

    await waitFor(() => expect(app.location()).toBe(`/articles?search=${encodeURIComponent('Нийтлэл 4').replace(/%20/g, '+')}`));
    await waitFor(() => expect(lastListCall(calls).query.get('search')).toBe('Нийтлэл 4'));
    // One request for the final term, not one per keystroke.
    expect(calls.filter((c) => c.query.get('search')?.startsWith('Ни')).length).toBe(1);
  });

  it('applies a select filter (validated) and a toggle filter', async () => {
    const { calls } = articlesApi();
    const app = renderApp('/articles?page=3');
    const ui = userEvent.setup();

    await screen.findByText('Нийтлэл 41');
    await ui.click(screen.getByRole('combobox', { name: 'Төлөв' }));
    await ui.click(await screen.findByRole('option', { name: 'Ноорог' }));

    await waitFor(() => expect(app.location()).toBe('/articles?status=draft'));
    await waitFor(() => expect(lastListCall(calls).query.get('status')).toBe('draft'));

    await ui.click(screen.getByRole('button', { name: 'Миний нийтлэл' }));
    await waitFor(() => expect(lastListCall(calls).query.get('authorId')).toBe('7'));
    expect(screen.getByRole('button', { name: 'Миний нийтлэл' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignores invalid filter values from the URL', async () => {
    const { calls } = articlesApi();
    renderApp('/articles?status=hacked');

    await screen.findByText('Нийтлэл 1');
    expect(lastListCall(calls).query.has('status')).toBe(false);
  });

  it('changes page size', async () => {
    const { calls } = articlesApi();
    const app = renderApp('/articles');
    const ui = userEvent.setup();

    await screen.findByText('Нийтлэл 1');
    await ui.click(screen.getByRole('combobox', { name: 'Хуудсанд' }));
    await ui.click(await screen.findByRole('option', { name: '50' }));

    await waitFor(() => expect(app.location()).toBe('/articles?pageSize=50'));
    expect(await screen.findByText('Нийтлэл 45')).toBeInTheDocument();
    expect(lastListCall(calls).query.get('pageSize')).toBe('50');
  });

  it('shows the empty state', async () => {
    mockApi({ 'GET /v1/admin/auth/me': () => session('editor'), 'GET /v1/admin/articles': () => page([]) });
    renderApp('/articles');

    expect(await screen.findByText('Илэрц олдсонгүй.')).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    let fail = true;
    const { calls } = mockApi({
      'GET /v1/admin/auth/me': () => session('editor'),
      'GET /v1/admin/articles': () => (fail ? apiError(503, 'SERVICE_UNAVAILABLE') : page([article(9)])),
    });
    renderApp('/articles');
    const ui = userEvent.setup();

    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(within(alert).getByText(/Үйлчилгээ түр ажиллахгүй байна/)).toBeInTheDocument();
    fail = false;
    await ui.click(within(alert).getByRole('button', { name: 'Дахин оролдох' }));

    expect(await screen.findByText('Нийтлэл 9')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/v1/admin/articles').length).toBeGreaterThanOrEqual(2);
  });
});

describe('Media list', () => {
  it('shows thumbnails from variant URLs and flags missing credit', async () => {
    mockApi({
      'GET /v1/admin/auth/me': () => session('reporter'),
      'GET /v1/admin/media': () => page([media(1), media(2, { credit: null, variants: [] })]),
    });
    renderApp('/media');

    const img = await screen.findByRole('img', { name: 'Төрийн ордон' });
    expect(img).toHaveAttribute('src', 'https://media.test/media/1/w320.webp');
    expect(screen.getByText('Бөглөөгүй')).toBeInTheDocument();
  });
});
