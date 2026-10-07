import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { isDirty, useEditorState, type EditorStore } from './editor-store';

/** Warns before leaving with unsaved changes: in-app navigation (dialog) and tab close/reload (browser prompt). */
export function UnsavedChangesGuard({ store }: { store: EditorStore }) {
  const { t } = useTranslation();
  const dirty = isDirty(useEditorState(store));
  // Reads the store at navigation time, so a save that finished a moment ago is respected.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty(store.get()) && currentLocation.pathname !== nextLocation.pathname);

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
      title={t('editor.unsaved.title')}
      description={t('editor.unsaved.description')}
      confirmLabel={t('editor.unsaved.leave')}
      destructive
      onConfirm={() => blocker.proceed?.()}
    />
  );
}
