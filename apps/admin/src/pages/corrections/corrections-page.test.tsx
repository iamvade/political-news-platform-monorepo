import type { AdminCorrection, UserRole } from '@news/shared/schemas';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { lookupItems, page, session } from '@/test/fixtures';
import { mockApi, type MockRequest } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

const correction = (id: number, overrides: Partial<AdminCorrection> = {}): AdminCorrection => ({
  id,
  entityType: 'person',
  entityId: 12,
  date: '2026-10-02',
  description: 'Төрсөн огноог зассан.',
  reason: 'Буруу оруулсан',
  createdBy: 7,
  createdAt: '2026-10-02T02:00:00.000Z',
  updatedAt: '2026-10-02T02:00:00.000Z',
  ...overrides,
});

function mockCorrections(role: UserRole = 'data_editor') {
  return mockApi({
    'GET /v1/admin/auth/me': () => session(role),
    'GET /v1/admin/corrections': () => page([correction(1), correction(2, { entityType: 'vote', entityId: 55, description: 'Саналыг зассан.' })]),
    'GET /v1/admin/lookup/persons': () => lookupItems([{ id: 12, label: 'Г.Батбаяр' }]),
    'GET /v1/admin/lookup/bills': () => lookupItems([{ id: 7, label: 'Татварын хуулийн төсөл' }]),
    'POST /v1/admin/corrections': (req) => ({ status: 201, body: { data: correction(3, req.body as object) } }),
    'DELETE /v1/admin/corrections/1': () => ({ status: 204 }),
  });
}

const bodies = (calls: MockRequest[], method: string, path: string) => calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);

describe('corrections page', () => {
  it('lists corrections with their targets', async () => {
    mockCorrections();
    renderApp('/corrections');

    const personRow = (await screen.findByText('Төрсөн огноог зассан.')).closest('tr')!;
    expect(await within(personRow).findByText('Г.Батбаяр')).toBeInTheDocument();
    expect(within(personRow).getByText('Хүн')).toBeInTheDocument();
    const voteRow = screen.getByText('Саналыг зассан.').closest('tr')!;
    expect(voteRow).toHaveTextContent('#55');
  });

  it('adds a correction for a bill picked from the lookup', async () => {
    const { calls } = mockCorrections();
    renderApp('/corrections');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Залруулга нэмэх' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /^Төрөл/ }));
    await user.click(await screen.findByRole('option', { name: 'Хуулийн төсөл' }));
    await user.click(within(dialog).getByRole('button', { name: 'Хамаарах бичлэг' }));
    await user.click(await screen.findByRole('option', { name: /Татварын хуулийн төсөл/ }));
    await user.type(within(dialog).getByLabelText(/^Юуг зассан/), 'Бүртгэлийн дугаарыг зассан.');
    await user.type(within(dialog).getByLabelText(/^Шалтгаан/), 'Үсгийн алдаа');
    await user.click(within(dialog).getByRole('button', { name: 'Хадгалах' }));

    await waitFor(() => expect(bodies(calls, 'POST', '/v1/admin/corrections')).toHaveLength(1));
    expect(bodies(calls, 'POST', '/v1/admin/corrections')[0]).toMatchObject({
      entityType: 'bill',
      entityId: 7,
      description: 'Бүртгэлийн дугаарыг зассан.',
      reason: 'Үсгийн алдаа',
    });
  });

  it('only admins can delete', async () => {
    mockCorrections('data_editor');
    renderApp('/corrections');
    await screen.findByText('Төрсөн огноог зассан.');
    expect(screen.queryAllByRole('button', { name: 'Залруулга устгах' })).toHaveLength(0);
  });

  it('admin deletes after confirming', async () => {
    const { calls } = mockCorrections('admin');
    renderApp('/corrections');
    const user = userEvent.setup();

    await screen.findByText('Г.Батбаяр');
    const row = screen.getByText('Төрсөн огноог зассан.').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Залруулга устгах' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Устгах' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/v1/admin/corrections/1')).toBe(true));
  });
});
