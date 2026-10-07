import type { AdminPromise } from '@news/shared/schemas';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { lookupItems, page, session } from '@/test/fixtures';
import { mockApi, type MockHandler, type MockRequest } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

const SOURCE = 'https://source.example/platform';

const promise = (overrides: Partial<AdminPromise> = {}): AdminPromise => ({
  id: 9,
  personId: 12,
  organizationId: null,
  textMn: 'Татварыг цахимжуулна.',
  madeOn: '2024-06-10',
  status: 'not_rated',
  evidence: [],
  lastReviewedAt: null,
  sourceUrl: SOURCE,
  createdAt: '2026-10-01T02:00:00.000Z',
  updatedAt: '2026-10-01T02:00:00.000Z',
  ...overrides,
});

function mockPromise(extra: Record<string, MockHandler> = {}) {
  return mockApi({
    'GET /v1/admin/auth/me': () => session('data_editor'),
    'GET /v1/admin/promises/9': () => ({ body: { data: promise() } }),
    'GET /v1/admin/promises/9/updates': () =>
      page([
        { id: 1, promiseId: 9, status: 'in_progress', date: '2025-01-10', noteMn: 'Төсөл өргөн барьсан.', sourceUrl: 'https://source.example/bill', createdBy: 7, createdAt: '2026-10-01T02:00:00.000Z' },
      ]),
    'GET /v1/admin/lookup/persons': () => lookupItems([{ id: 12, label: 'Г.Батбаяр', sublabel: 'МАН' }]),
    ...extra,
  });
}

const bodies = (calls: MockRequest[], method: string, path: string) => calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);

describe('promise page', () => {
  it('creates a promise for the person it was opened from (status is not sent)', async () => {
    const { calls } = mockPromise({
      'POST /v1/admin/promises': (req) => ({ status: 201, body: { data: promise({ id: 10, ...(req.body as object) }) } }),
      'GET /v1/admin/promises/10/updates': () => page([]),
    });
    const app = renderApp('/promises/new?personId=12');
    const user = userEvent.setup();

    expect(await screen.findByRole('button', { name: 'Хүн: Г.Батбаяр' })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Амлалт\*?$/), 'Шинэ амлалт');
    await user.type(screen.getByLabelText(/^Өгсөн огноо/), '2024-06-10');
    await user.type(screen.getByLabelText(/^Эх сурвалжийн холбоос/), SOURCE);
    await user.click(screen.getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(app.location()).toBe('/promises/10'));
    expect(bodies(calls, 'POST', '/v1/admin/promises')).toEqual([
      { personId: 12, organizationId: null, textMn: 'Шинэ амлалт', madeOn: '2024-06-10', evidence: [], sourceUrl: SOURCE },
    ]);
  });

  it('shows the status history', async () => {
    mockPromise();
    renderApp('/promises/9');

    const history = await screen.findByRole('list', { name: 'Төлөвийн түүх' });
    expect(within(history).getByText('Төсөл өргөн барьсан.')).toBeInTheDocument();
    expect(within(history).getByText('Хэрэгжиж буй')).toBeInTheDocument();
  });

  it('changes the status only with a note and an evidence link', async () => {
    const { calls } = mockPromise({
      'POST /v1/admin/promises/9/status': (req) => ({ body: { data: promise({ status: (req.body as { status: AdminPromise['status'] }).status, lastReviewedAt: '2026-10-07T01:00:00.000Z' }) } }),
    });
    renderApp('/promises/9');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Төлөв өөрчлөх' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Хадгалах' }));
    expect(await within(dialog).findAllByText('Утга буруу байна.')).toHaveLength(2);
    expect(calls.some((c) => c.path.endsWith('/status'))).toBe(false);

    await user.click(within(dialog).getByRole('combobox', { name: /^Шинэ төлөв/ }));
    await user.click(await screen.findByRole('option', { name: 'Биелсэн' }));
    await user.type(within(dialog).getByLabelText(/^Тайлбар/), 'Хууль батлагдсан.');
    await user.type(within(dialog).getByLabelText(/^Нотлох холбоос/), 'https://source.example/law');
    await user.click(within(dialog).getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(bodies(calls, 'POST', '/v1/admin/promises/9/status')).toHaveLength(1));
    expect(bodies(calls, 'POST', '/v1/admin/promises/9/status')[0]).toMatchObject({ status: 'kept', noteMn: 'Хууль батлагдсан.', sourceUrl: 'https://source.example/law', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByText('Биелсэн').length).toBeGreaterThan(0);
  });

  it('saves evidence links with the promise', async () => {
    const { calls } = mockPromise({
      'PATCH /v1/admin/promises/9': (req) => ({ body: { data: promise(req.body as object) } }),
    });
    renderApp('/promises/9');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Холбоос нэмэх' }));
    await user.type(screen.getByRole('textbox', { name: 'Тайлбар' }), 'Хуулийн төсөл');
    await user.type(screen.getByLabelText('Холбоос'), 'https://source.example/bill');
    await user.click(screen.getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(bodies(calls, 'PATCH', '/v1/admin/promises/9')).toHaveLength(1));
    expect(bodies(calls, 'PATCH', '/v1/admin/promises/9')[0]).toMatchObject({ evidence: [{ url: 'https://source.example/bill', label: 'Хуулийн төсөл' }] });
    expect(bodies(calls, 'PATCH', '/v1/admin/promises/9')[0]).not.toHaveProperty('status');
  });
});
