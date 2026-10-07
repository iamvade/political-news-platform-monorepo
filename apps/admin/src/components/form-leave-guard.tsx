import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { isFormDirty } from '@/lib/form-store';

interface DirtySource {
  get(): { version: number; savedVersion: number };
  subscribe(listener: () => void): () => void;
}

/** Warns before leaving a page-level form with unsaved changes (in-app navigation and tab close). */
export function FormLeaveGuard({ store }: { store: DirtySource }) {
  const { t } = useTranslation();
  const dirty = isFormDirty(useSyncExternalStore(store.subscribe, store.get, store.get));
  const blocker = useBlocker(({ currentLocation, nextLocation }) => isFormDirty(store.get()) && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => !open && blocker.reset?.()}
      title={t('form.unsaved.title')}
      description={t('form.unsaved.description')}
      confirmLabel={t('form.unsaved.leave')}
      destructive
      onConfirm={() => blocker.proceed?.()}
    />
  );
}
