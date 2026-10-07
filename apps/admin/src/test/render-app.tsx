import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app-providers';
import { createQueryClient } from '@/lib/query-client';
import { session } from '@/lib/session';
import { routes } from '@/router';

/** Renders the whole app (providers, guards, layout) at `path` with a memory router. Mock the API first. */
export function renderApp(path: string) {
  session.reset();
  const queryClient = createQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  const location = () => `${router.state.location.pathname}${router.state.location.search}`;
  return { ...utils, router, queryClient, location };
}
