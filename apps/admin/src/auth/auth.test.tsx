import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { article, page, session } from '@/test/fixtures';
import { apiError, mockApi } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

const anonymous = { 'GET /v1/admin/auth/me': () => apiError(401, 'UNAUTHORIZED') };

async function signIn(email = 'editor@newsroom.example', password = 'correct horse battery') {
  const ui = userEvent.setup();
  await ui.type(await screen.findByLabelText('Имэйл'), email);
  await ui.type(screen.getByLabelText('Нууц үг'), password);
  await ui.click(screen.getByRole('button', { name: 'Нэвтрэх' }));
}

describe('session handling', () => {
  it('sends anonymous visitors to /login with ?next=', async () => {
    mockApi(anonymous);
    const app = renderApp('/articles?status=draft');

    await screen.findByLabelText('Имэйл');
    expect(app.location()).toBe('/login?next=%2Farticles%3Fstatus%3Ddraft');
  });

  it('logs in and returns to `next`', async () => {
    const { calls } = mockApi({
      ...anonymous,
      'POST /v1/admin/auth/login': () => session('editor'),
      'GET /v1/admin/articles': () => page([article(1)]),
    });
    const app = renderApp('/login?next=%2Farticles');

    await signIn();

    expect(await screen.findByText('Нийтлэл 1')).toBeInTheDocument();
    expect(app.location()).toBe('/articles');
    expect(await screen.findByText('Тавтай морил, Б.Сараа')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/admin/auth/login')?.body).toEqual({
      email: 'editor@newsroom.example',
      password: 'correct horse battery',
    });
  });

  it('ignores an external `next` and goes to the role default', async () => {
    mockApi({ ...anonymous, 'POST /v1/admin/auth/login': () => session('data_editor'), 'GET /v1/admin/persons': () => page([]) });
    const app = renderApp('/login?next=%2F%2Fevil.example');

    await signIn();

    await waitFor(() => expect(app.location()).toBe('/persons'));
  });

  it.each([
    ['INVALID_CREDENTIALS', 401, 'Имэйл эсвэл нууц үг буруу байна.'],
    ['RATE_LIMITED', 429, 'Хэт олон оролдлого хийлээ. Түр хүлээгээд дахин оролдоно уу.'],
  ])('shows %s in Mongolian', async (code, status, message) => {
    mockApi({ ...anonymous, 'POST /v1/admin/auth/login': () => apiError(status, code) });
    const app = renderApp('/login');

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(app.location()).toBe('/login');
  });

  it('redirects to login with a toast when the session expires mid-use', async () => {
    mockApi({
      'GET /v1/admin/auth/me': () => session('editor'),
      'GET /v1/admin/articles': () => apiError(401, 'SESSION_EXPIRED'),
    });
    const app = renderApp('/articles');

    expect(await screen.findByText('Таны сесс дууссан. Дахин нэвтэрнэ үү.')).toBeInTheDocument();
    await waitFor(() => expect(app.location()).toBe('/login?next=%2Farticles'));
  });

  it('logs out with the CSRF token and lands on /login without `next`', async () => {
    const { calls } = mockApi({
      'GET /v1/admin/auth/me': () => session('editor'),
      'GET /v1/admin/articles': () => page([]),
      'POST /v1/admin/auth/logout': () => ({ status: 204 }),
    });
    const app = renderApp('/articles');
    const ui = userEvent.setup();

    await ui.click(await screen.findByRole('button', { name: /Б\.Сараа/ }));
    await ui.click(await screen.findByRole('menuitem', { name: 'Гарах' }));

    await waitFor(() => expect(app.location()).toBe('/login'));
    const logout = calls.find((c) => c.path === '/v1/admin/auth/logout');
    expect(logout?.headers.get('x-csrf-token')).toBe('csrf-token-123');
    expect(await screen.findByText('Системээс гарлаа')).toBeInTheDocument();
  });

  it('shows the signed-in user and role in the sidebar', async () => {
    mockApi({ 'GET /v1/admin/auth/me': () => session('reporter'), 'GET /v1/admin/articles': () => page([]) });
    renderApp('/articles');

    const account = await screen.findByRole('button', { name: /Б\.Сараа/ });
    expect(within(account).getByText('Сурвалжлагч')).toBeInTheDocument();
  });
});
