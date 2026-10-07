import { isApiError } from '@news/shared/api-client';
import type { AuthUser } from '@news/shared/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { session } from '@/lib/session';

interface AuthContextValue {
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Restores the cookie session once per page load (StrictMode runs effects twice). */
let restoring: Promise<void> | null = null;

function restoreSession(): Promise<void> {
  restoring ??= api.auth
    .me()
    .then(({ data }) => session.setAuthenticated(data.user, data.csrfToken))
    .catch((err: unknown) => {
      // 401 = no session. Anything else (API down) also leaves us signed out; the login page shows errors.
      if (!isApiError(err) || err.status !== 401) console.warn('Session restore failed', err);
      session.setAnonymous();
    })
    .finally(() => {
      restoring = null;
    });
  return restoring;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (session.get().status === 'loading') void restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.auth.login({ email, password });
    session.setAuthenticated(data.user, data.csrfToken);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Session may already be gone server-side; signing out locally is what matters.
    }
    session.setAnonymous('logout');
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(() => ({ login, logout }), [login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
