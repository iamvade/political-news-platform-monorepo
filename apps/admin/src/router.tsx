import type { RouteObject } from 'react-router';
import { IndexRedirect, RequireAuth, RequireSection } from '@/auth/guards';
import { AppLayout } from '@/components/layout/app-layout';
import { ArticleEditorPage } from '@/pages/article-editor/article-editor-page';
import { ArticlesPage } from '@/pages/articles-page';
import { BillPage } from '@/pages/bills/bill-page';
import { VoteGridPage } from '@/pages/bills/vote-grid-page';
import { BillsPage } from '@/pages/bills-page';
import { LoginPage } from '@/pages/login-page';
import { MediaPage } from '@/pages/media-page';
import { OrganizationsPage } from '@/pages/organizations-page';
import { CorrectionsPage } from '@/pages/corrections/corrections-page';
import { HomepagePage } from '@/pages/homepage/homepage-page';
import { PersonPage } from '@/pages/persons/person-page';
import { PromisePage } from '@/pages/promises/promise-page';
import { PromisesPage } from '@/pages/promises/promises-page';
import { PersonsPage } from '@/pages/persons-page';
import { NotBuiltPage, NotFoundPage } from '@/pages/status-pages';

/** Shared by the browser router (main.tsx) and memory routers in tests. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <IndexRedirect /> },
          { path: 'articles', element: <RequireSection section="articles"><ArticlesPage /></RequireSection> },
          { path: 'articles/:id', element: <RequireSection section="articles"><ArticleEditorPage /></RequireSection> },
          { path: 'persons', element: <RequireSection section="persons"><PersonsPage /></RequireSection> },
          { path: 'persons/:id', element: <RequireSection section="persons"><PersonPage /></RequireSection> },
          { path: 'organizations', element: <RequireSection section="organizations"><OrganizationsPage /></RequireSection> },
          { path: 'bills', element: <RequireSection section="bills"><BillsPage /></RequireSection> },
          { path: 'bills/:id', element: <RequireSection section="bills"><BillPage /></RequireSection> },
          { path: 'bills/:id/votes', element: <RequireSection section="bills"><VoteGridPage /></RequireSection> },
          { path: 'promises', element: <RequireSection section="promises"><PromisesPage /></RequireSection> },
          { path: 'promises/:id', element: <RequireSection section="promises"><PromisePage /></RequireSection> },
          { path: 'corrections', element: <RequireSection section="corrections"><CorrectionsPage /></RequireSection> },
          { path: 'media', element: <RequireSection section="media"><MediaPage /></RequireSection> },
          { path: 'homepage', element: <RequireSection section="homepage"><HomepagePage /></RequireSection> },
          { path: 'users', element: <RequireSection section="users"><NotBuiltPage titleKey="pages.users.title" /></RequireSection> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
