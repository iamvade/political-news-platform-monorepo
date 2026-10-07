import type { UserRole } from '@news/shared/schemas';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { page, session } from '@/test/fixtures';
import { mockApi } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

function menuLabels() {
  const nav = screen.getByText('Цэс').closest('[data-sidebar="group"]') as HTMLElement;
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

describe('role-aware sidebar', () => {
  it.each<[UserRole, string[]]>([
    ['reporter', ['Нийтлэл', 'Медиа']],
    ['editor', ['Нийтлэл', 'Медиа', 'Нүүр хуудас']],
    ['data_editor', ['Хүмүүс', 'Байгууллага', 'Хуулийн төсөл', 'Амлалт', 'Залруулга', 'Медиа']],
    ['admin', ['Нийтлэл', 'Хүмүүс', 'Байгууллага', 'Хуулийн төсөл', 'Амлалт', 'Залруулга', 'Медиа', 'Нүүр хуудас', 'Хэрэглэгчид']],
  ])('%s sees only their sections', async (role, labels) => {
    mockApi({ 'GET /v1/admin/auth/me': () => session(role), 'GET /v1/admin/media': () => page([]) });
    renderApp('/media');

    await screen.findByRole('heading', { name: 'Медиа' });
    expect(menuLabels()).toEqual(labels);
  });

  it('a reporter opening /users gets the forbidden page', async () => {
    mockApi({ 'GET /v1/admin/auth/me': () => session('reporter') });
    renderApp('/users');

    expect(await screen.findByText('Хандах эрхгүй')).toBeInTheDocument();
  });

  it('sections without an API show the not-built page', async () => {
    mockApi({ 'GET /v1/admin/auth/me': () => session('admin') });
    renderApp('/users');

    expect(await screen.findByText('Энэ хэсэг хараахан бэлэн болоогүй')).toBeInTheDocument();
  });

  it('/ redirects to the role default section', async () => {
    mockApi({ 'GET /v1/admin/auth/me': () => session('data_editor'), 'GET /v1/admin/persons': () => page([]) });
    const app = renderApp('/');

    await screen.findByRole('heading', { name: 'Хүмүүс' });
    expect(app.location()).toBe('/persons');
  });
});
