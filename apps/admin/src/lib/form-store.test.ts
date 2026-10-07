import { describe, expect, it } from 'vitest';
import { createFormStore, isFormDirty } from './form-store';

describe('createFormStore', () => {
  it('tracks unsaved changes by version', () => {
    const store = createFormStore({ name: 'А', note: '' });
    expect(isFormDirty(store.get())).toBe(false);

    store.update({ name: 'Б' });
    const sent = store.get().version;
    store.update({ note: 'шинэ' }); // typed while the save was in flight
    store.markSaved(sent);

    expect(store.get().values).toEqual({ name: 'Б', note: 'шинэ' });
    expect(isFormDirty(store.get())).toBe(true);

    store.reset({ name: 'В', note: '' });
    expect(isFormDirty(store.get())).toBe(false);
    expect(store.get().values.name).toBe('В');
  });
});
