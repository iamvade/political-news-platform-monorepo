import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/full-page-loader';
import { ForbiddenPage } from '@/pages/status-pages';
import { useSession } from '@/lib/session';
import { canAccess, defaultPath, type SectionKey } from '@/navigation';

/** Signed-in area. Anonymous visitors go to /login?next=<where they were> (not after an explicit logout). */
export function RequireAuth() {
  const { status, endedBy } = useSession();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') {
    const here = `${location.pathname}${location.search}`;
    const query = endedBy === 'logout' || here === '/' ? '' : `?next=${encodeURIComponent(here)}`;
    return <Navigate to={`/login${query}`} replace />;
  }
  return <Outlet />;
}

/** Hides a whole section from roles that cannot use it (the API enforces this too). */
export function RequireSection({ section, children }: { section: SectionKey; children: ReactNode }) {
  const { user } = useSession();
  if (!user || !canAccess(user.role, section)) return <ForbiddenPage />;
  return children;
}

export function IndexRedirect() {
  const { user } = useSession();
  return <Navigate to={user ? defaultPath(user.role) : '/login'} replace />;
}
