import type { AuthUser } from '@news/shared/schemas';
import { useSyncExternalStore } from 'react';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionState {
  status: SessionStatus;
  user: AuthUser | null;
  /** Kept in memory only (never localStorage); sent as X-CSRF-Token by the API client. */
  csrfToken: string | null;
  /** Why the session ended; `logout` suppresses the `?next=` redirect. */
  endedBy: 'logout' | 'expired' | null;
}

const INITIAL: SessionState = { status: 'loading', user: null, csrfToken: null, endedBy: null };

let state: SessionState = INITIAL;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  for (const listener of listeners) listener();
}

/** Tiny external store shared by React (useSession) and the API client (CSRF header). */
export const session = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setAuthenticated(user: AuthUser, csrfToken: string) {
    set({ status: 'authenticated', user, csrfToken, endedBy: null });
  },
  setAnonymous(endedBy: SessionState['endedBy'] = null) {
    set({ status: 'anonymous', user: null, csrfToken: null, endedBy });
  },
  /** Tests only. */
  reset() {
    set(INITIAL);
  },
};

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}
