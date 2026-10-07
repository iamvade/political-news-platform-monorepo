import { useSyncExternalStore } from 'react';

export interface FormState<T> {
  values: T;
  /** Bumped on every local change; `savedVersion` is the version the server has. */
  version: number;
  savedVersion: number;
}

export const isFormDirty = (state: { version: number; savedVersion: number }) => state.version !== state.savedVersion;

/**
 * Tiny external store for one page-level form (same pattern as the article editor store). Saves and the leave
 * guard read `get()` at the moment they run, so they never act on stale values.
 */
export function createFormStore<T extends object>(initial: T) {
  let state: FormState<T> = { values: initial, version: 0, savedVersion: 0 };
  const listeners = new Set<() => void>();
  const set = (next: FormState<T>) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch: Partial<T>) {
      set({ ...state, values: { ...state.values, ...patch }, version: state.version + 1 });
    },
    /** The server now has `version` (edits made while saving stay dirty). */
    markSaved(version: number) {
      set({ ...state, savedVersion: version });
    },
    /** Replace the values with a clean server state. */
    reset(values: T) {
      set({ values, version: state.version + 1, savedVersion: state.version + 1 });
    },
  };
}

export type FormStore<T extends object> = ReturnType<typeof createFormStore<T>>;

export function useFormState<T extends object>(store: FormStore<T>): FormState<T> {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
