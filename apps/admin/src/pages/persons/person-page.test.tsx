import type { UserRole } from '@news/shared/schemas';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { lookupItems, page, person, position, session } from '@/test/fixtures';
import { mockApi, type MockHandler, type MockRequest } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

const SOURCE = 'https://source.example/new';

function mockPerson(role: UserRole = 'data_editor', extra: Record<string, MockHandler> = {}) {
  return mockApi({
    'GET /v1/admin/auth/me': () => session(role),
    'GET /v1/admin/persons/12': () => ({ body: { data: person(12) } }),
    'GET /v1/admin/positions': () =>
      page([position(5), position(4, { organizationId: 9, titleMn: 'Сайд', startDate: '2016-08-01', endDate: '2020-06-30' })]),
    'GET /v1/admin/lookup/organizations': (req) =>
      req.query.get('ids')
        ? lookupItems([
            { id: 3, label: 'Улсын Их Хурал' },
            { id: 9, label: 'Сангийн яам' },
          ])
        : lookupItems([{ id: 3, label: 'Улсын Их Хурал' }]),
    'GET /v1/admin/statements': () => page([]),
    'GET /v1/admin/persons': () => page([]),
    ...extra,
  });
}

const bodies = (calls: MockRequest[], method: string, path: string) => calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);

describe('person profile', () => {
  it('loads the person and saves only after a change', async () => {
    const { calls } = mockPerson('data_editor', {
      'PATCH /v1/admin/persons/12': (req) => ({ body: { data: person(12, { ...(req.body as object), displayName: 'Г.Батбаяр' }) } }),
    });
    renderApp('/persons/12');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Г.Батбаяр' })).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Хадгалах' });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText('Нэр (англи)'), 'Batbayar');
    expect(screen.getByRole('status')).toHaveTextContent('Хадгалаагүй өөрчлөлт байна');
    await user.click(save);

    await waitFor(() => expect(bodies(calls, 'PATCH', '/v1/admin/persons/12')).toHaveLength(1));
    expect(bodies(calls, 'PATCH', '/v1/admin/persons/12')[0]).toMatchObject({ givenNameMn: 'Батбаяр', givenNameEn: 'Batbayar', birthDate: '1975-03-02', gender: 'male' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Бүх өөрчлөлт хадгалагдсан'));
  });

  it('creates a person and moves to the new profile', async () => {
    const { calls } = mockApi({
      'GET /v1/admin/auth/me': () => session('data_editor'),
      'POST /v1/admin/persons': (req) => ({ status: 201, body: { data: person(31, { ...(req.body as object), displayName: 'Д.Сараа' }) } }),
      'GET /v1/admin/positions': () => page([]),
      'GET /v1/admin/statements': () => page([]),
    });
    const app = renderApp('/persons/new');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^Овог\*?$/), 'Дорж');
    await user.type(screen.getByLabelText(/^Нэр\*?$/), 'Сараа');
    await user.click(screen.getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(app.location()).toBe('/persons/31'));
    expect(bodies(calls, 'POST', '/v1/admin/persons')[0]).toEqual({
      givenNameMn: 'Сараа',
      patronymicMn: 'Дорж',
      givenNameEn: null,
      patronymicEn: null,
      birthDate: null,
      gender: null,
      photoMediaId: null,
      bioMn: null,
    });
    expect(await screen.findByRole('heading', { name: 'Д.Сараа' })).toBeInTheDocument();
  });

  it('flags missing required names without calling the API', async () => {
    const { calls } = mockApi({ 'GET /v1/admin/auth/me': () => session('data_editor') });
    renderApp('/persons/new');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Хадгалах' }));

    expect(await screen.findAllByText('Утга буруу байна.')).toHaveLength(2);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

describe('positions timeline', () => {
  it('shows positions with organization names, current ones marked', async () => {
    mockPerson();
    renderApp('/persons/12');

    const timeline = await screen.findByRole('list', { name: 'Албан тушаал' });
    expect(await within(timeline).findByText('Улсын Их Хурал')).toBeInTheDocument();
    expect(within(timeline).getByText('Сангийн яам')).toBeInTheDocument();
    expect(within(timeline).getByText(/одоо/)).toBeInTheDocument();
  });

  it('adds a position with an organization picked from the lookup', async () => {
    const { calls } = mockPerson('data_editor', {
      'POST /v1/admin/positions': (req) => ({ status: 201, body: { data: position(6, req.body as object) } }),
    });
    renderApp('/persons/12');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Албан тушаал нэмэх' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Байгууллага' }));
    await user.click(await screen.findByRole('option', { name: /Улсын Их Хурал/ }));
    await user.type(within(dialog).getByLabelText(/^Албан тушаал\*?$/), 'Байнгын хорооны дарга');
    await user.type(within(dialog).getByLabelText(/^Эхэлсэн/), '2025-01-10');
    await user.type(within(dialog).getByLabelText(/^Эх сурвалжийн холбоос/), SOURCE);
    await user.click(within(dialog).getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(bodies(calls, 'POST', '/v1/admin/positions')).toHaveLength(1));
    expect(bodies(calls, 'POST', '/v1/admin/positions')[0]).toEqual({
      personId: 12,
      organizationId: 3,
      titleMn: 'Байнгын хорооны дарга',
      titleEn: null,
      startDate: '2025-01-10',
      endDate: null,
      sourceUrl: SOURCE,
    });
  });

  it('ends a current position', async () => {
    const { calls } = mockPerson('data_editor', {
      'PATCH /v1/admin/positions/5': (req) => ({ body: { data: position(5, req.body as object) } }),
    });
    renderApp('/persons/12');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '«УИХ-ын гишүүн» дуусгах' }));
    const dialog = await screen.findByRole('dialog');
    const date = within(dialog).getByLabelText(/^Дууссан/);
    await user.clear(date);
    await user.type(date, '2026-09-30');
    await user.click(within(dialog).getByRole('button', { name: 'Дуусгах' }));

    await waitFor(() => expect(bodies(calls, 'PATCH', '/v1/admin/positions/5')).toEqual([{ endDate: '2026-09-30' }]));
  });

  it.each<[UserRole, boolean]>([
    ['data_editor', false],
    ['admin', true],
  ])('%s can delete positions: %s', async (role, canDelete) => {
    mockPerson(role);
    renderApp('/persons/12');

    await screen.findByRole('list', { name: 'Албан тушаал' });
    expect(screen.queryAllByRole('button', { name: /устгах$/ }).length > 0).toBe(canDelete);
  });
});

describe('linked records', () => {
  it('shows declarations with grouped amounts in their tab', async () => {
    mockPerson('data_editor', {
      'GET /v1/admin/declarations': () =>
        page([
          {
            id: 1,
            personId: 12,
            year: 2024,
            filedOn: null,
            income: '125000000.50',
            assets: '9000000000000000.00',
            liabilities: null,
            details: {},
            sourceUrl: SOURCE,
            createdAt: '2026-10-01T02:00:00.000Z',
            updatedAt: '2026-10-01T02:00:00.000Z',
          },
        ]),
    });
    renderApp('/persons/12');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('tab', { name: 'Хөрөнгийн мэдүүлэг' }));

    const row = (await screen.findByText('2024')).closest('tr')!;
    expect(row).toHaveTextContent(new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 2 }).format(125000000.5));
    // 16-digit amounts keep every digit (formatted from the string, not a float).
    expect(row.textContent?.replace(/\D/g, '')).toContain('9000000000000000');
  });

  it('adds a statement with a source', async () => {
    const { calls } = mockPerson('data_editor', {
      'POST /v1/admin/statements': (req) => ({ status: 201, body: { data: { id: 1, articleId: null, contextMn: null, createdAt: '2026-10-01T02:00:00.000Z', updatedAt: '2026-10-01T02:00:00.000Z', ...(req.body as object) } } }),
    });
    renderApp('/persons/12');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Мэдэгдэл нэмэх' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Ишлэл/), 'Татварыг бууруулна.');
    await user.type(within(dialog).getByLabelText(/^Хэлсэн огноо/), '2025-02-01');
    await user.type(within(dialog).getByLabelText(/^Эх сурвалжийн холбоос/), SOURCE);
    await user.click(within(dialog).getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(bodies(calls, 'POST', '/v1/admin/statements')).toEqual([
      { personId: 12, quoteMn: 'Татварыг бууруулна.', contextMn: null, saidOn: '2025-02-01', sourceUrl: SOURCE },
    ]));
  });
});
