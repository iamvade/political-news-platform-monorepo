import type { VoteRosterMember } from '@news/shared/schemas';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { bill, lookupItems, page, session } from '@/test/fixtures';
import { mockApi, type MockHandler, type MockRequest } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

const SOURCE = 'https://source.example/vote';

function mockBill(extra: Record<string, MockHandler> = {}) {
  return mockApi({
    'GET /v1/admin/auth/me': () => session('data_editor'),
    'GET /v1/admin/bills/7': () => ({ body: { data: bill(7, { sponsors: [{ personId: 3, role: 'initiator' }] }) } }),
    'GET /v1/admin/bill-stages': () =>
      page([
        { id: 1, billId: 7, stage: 'submitted', date: '2025-01-05', noteMn: null, sourceUrl: SOURCE, createdAt: '2026-10-01T02:00:00.000Z', updatedAt: '2026-10-01T02:00:00.000Z' },
      ]),
    'GET /v1/admin/bills/7/vote-sessions': () =>
      page([{ date: '2025-01-15', motion: 'final_vote', counts: { yes: 40, no: 20, abstain: 1, absent: 15 }, total: 76, sourceUrls: [SOURCE] }]),
    'GET /v1/admin/lookup/persons': (req) =>
      req.query.get('ids')
        ? lookupItems([
            { id: 3, label: 'Г.Батбаяр', sublabel: 'МАН' },
            { id: 5, label: 'Д.Сарантуяа' },
          ])
        : lookupItems([{ id: 5, label: 'Д.Сарантуяа' }]),
    ...extra,
  });
}

const bodies = (calls: MockRequest[], method: string, path: string) => calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);

describe('bill page', () => {
  it('shows the bill, its stages, sponsors and roll calls', async () => {
    mockBill();
    renderApp('/bills/7');

    expect(await screen.findByRole('heading', { name: 'Татварын хуулийн төсөл' })).toBeInTheDocument();
    expect(within(await screen.findByRole('list', { name: 'Шат дамжлага' })).getByText('Өргөн мэдүүлсэн')).toBeInTheDocument();
    expect(await within(screen.getByRole('list', { name: 'Санаачлагчид' })).findByText('Г.Батбаяр')).toBeInTheDocument();
    const session = (await screen.findByText('final_vote')).closest('tr')!;
    expect(session).toHaveTextContent('40');
    expect(within(session).getByRole('link', { name: 'Нээх' })).toHaveAttribute('href', '/bills/7/votes?date=2025-01-15&motion=final_vote');
  });

  it('adds a co-sponsor and saves the whole list', async () => {
    const { calls } = mockBill({
      'PUT /v1/admin/bills/7/sponsors': (req) => ({ body: { data: bill(7, req.body as object) } }),
    });
    renderApp('/bills/7');
    const user = userEvent.setup();

    const save = await screen.findByRole('button', { name: 'Санаачлагчдыг хадгалах' });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Санаачлагч нэмэх' }));
    await user.click(await screen.findByRole('option', { name: /Д\.Сарантуяа/ }));
    await user.click(save);

    await waitFor(() =>
      expect(bodies(calls, 'PUT', '/v1/admin/bills/7/sponsors')).toEqual([
        {
          sponsors: [
            { personId: 3, role: 'initiator' },
            { personId: 5, role: 'co_sponsor' },
          ],
        },
      ]),
    );
  });

  it('adds a stage with its source', async () => {
    const { calls } = mockBill({
      'POST /v1/admin/bill-stages': (req) => ({ status: 201, body: { data: { id: 2, noteMn: null, createdAt: '2026-10-01T02:00:00.000Z', updatedAt: '2026-10-01T02:00:00.000Z', ...(req.body as object) } } }),
    });
    renderApp('/bills/7');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Шат нэмэх' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Огноо/), '2025-02-10');
    await user.type(within(dialog).getByLabelText(/^Эх сурвалжийн холбоос/), SOURCE);
    await user.click(within(dialog).getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() =>
      expect(bodies(calls, 'POST', '/v1/admin/bill-stages')).toEqual([{ billId: 7, stage: 'submitted', date: '2025-02-10', noteMn: null, sourceUrl: SOURCE }]),
    );
  });

  it('creates a bill and opens it', async () => {
    const { calls } = mockBill({
      'POST /v1/admin/bills': (req) => ({ status: 201, body: { data: bill(7, req.body as object) } }),
    });
    const app = renderApp('/bills/new');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^Гарчиг\*?$/), 'Татварын хуулийн төсөл');
    await user.type(screen.getByLabelText(/^Эх сурвалжийн холбоос/), SOURCE);
    await user.click(screen.getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(app.location()).toBe('/bills/7'));
    expect(bodies(calls, 'POST', '/v1/admin/bills')[0]).toMatchObject({ titleMn: 'Татварын хуулийн төсөл', initiatorType: 'government', status: 'submitted', sourceUrl: SOURCE });
  });
});

describe('vote grid', () => {
  const members: VoteRosterMember[] = [
    { personId: 3, displayName: 'Г.Батбаяр', partyShortName: 'МАН', inOffice: true, voteId: null, value: null, sourceUrl: null },
    { personId: 5, displayName: 'Д.Сарантуяа', partyShortName: 'АН', inOffice: true, voteId: 90, value: 'no', sourceUrl: SOURCE },
    { personId: 8, displayName: 'Ц.Цэцэг', partyShortName: null, inOffice: false, voteId: 91, value: 'yes', sourceUrl: SOURCE },
  ];
  const roster = () => ({ body: { data: { billId: 7, date: '2025-01-15', motion: 'final_vote', members } } });
  const importResult = (dryRun: boolean) => ({ body: { data: { dryRun, summary: { create: 1, update: 1, unchanged: 1 }, diff: { create: [], update: [] } } } });
  const GRID = '/bills/7/votes?date=2025-01-15&motion=final_vote';

  it('lists the roster, pre-fills recorded votes and the common source, then saves after a dry run', async () => {
    const { calls } = mockBill({
      'GET /v1/admin/bills/7/vote-roster': roster,
      'POST /v1/admin/votes/import': (req) => importResult((req.body as { dryRun: boolean }).dryRun),
    });
    renderApp(GRID);
    const user = userEvent.setup();

    const batbayar = await screen.findByRole('radiogroup', { name: 'Г.Батбаяр' });
    expect(within(screen.getByRole('radiogroup', { name: 'Д.Сарантуяа' })).getByRole('radio', { name: 'Татгалзсан' })).toBeChecked();
    expect(screen.getByText('Тухайн өдөр гишүүн биш')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Санал хураалтын эх сурвалж/)).toHaveValue(SOURCE);

    await user.click(within(batbayar).getByRole('radio', { name: 'Зөвшөөрсөн' }));
    await user.click(screen.getByRole('button', { name: 'Хадгалах' }));

    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('1 шинэ, 1 өөрчлөгдөх, 1 өөрчлөгдөхгүй');
    const dry = bodies(calls, 'POST', '/v1/admin/votes/import');
    expect(dry).toEqual([
      {
        dryRun: true,
        rows: [
          { billId: 7, personId: 3, value: 'yes', date: '2025-01-15', motion: 'final_vote', sourceUrl: SOURCE },
          { billId: 7, personId: 5, value: 'no', date: '2025-01-15', motion: 'final_vote', sourceUrl: SOURCE },
          { billId: 7, personId: 8, value: 'yes', date: '2025-01-15', motion: 'final_vote', sourceUrl: SOURCE },
        ],
      },
    ]);

    await user.click(within(confirm).getByRole('button', { name: 'Хадгалах' }));
    await waitFor(() => expect(bodies(calls, 'POST', '/v1/admin/votes/import')).toHaveLength(2));
    expect(bodies(calls, 'POST', '/v1/admin/votes/import')[1]).toMatchObject({ dryRun: false });
    expect(await screen.findByText('Саналуудыг хадгаллаа.')).toBeInTheDocument();
  });

  it('fills unset rows as absent', async () => {
    mockBill({ 'GET /v1/admin/bills/7/vote-roster': roster });
    renderApp(GRID);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Үлдсэнийг «Ирээгүй» болгох' }));

    expect(within(screen.getByRole('radiogroup', { name: 'Г.Батбаяр' })).getByRole('radio', { name: 'Ирээгүй' })).toBeChecked();
    expect(within(screen.getByRole('radiogroup', { name: 'Д.Сарантуяа' })).getByRole('radio', { name: 'Татгалзсан' })).toBeChecked();
  });

  it('requires one valid source URL before saving', async () => {
    const { calls } = mockBill({ 'GET /v1/admin/bills/7/vote-roster': roster });
    renderApp(GRID);
    const user = userEvent.setup();

    await user.clear(await screen.findByLabelText(/^Санал хураалтын эх сурвалж/));
    await user.click(screen.getByRole('button', { name: 'Хадгалах' }));

    expect(await screen.findByText('http:// эсвэл https:// хаяг оруулна уу.')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/v1/admin/votes/import')).toBe(false);
  });

  it('starts a roll call from a date and motion', async () => {
    mockBill({ 'GET /v1/admin/bills/7/vote-roster': roster });
    const app = renderApp('/bills/7/votes');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^Санал хураалт/), 'consideration');
    await user.click(screen.getByRole('button', { name: 'Нээх' }));

    await waitFor(() => expect(app.location()).toMatch(/^\/bills\/7\/votes\?date=\d{4}-\d{2}-\d{2}&motion=consideration$/));
  });
});
