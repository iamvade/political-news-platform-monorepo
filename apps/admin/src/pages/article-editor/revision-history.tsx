import type { ArticleRevision, AuthUser, LookupKind } from '@news/shared/schemas';
import { useQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import type { Change } from 'diff';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useLookupItems } from '@/hooks/use-lookup';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { isDirty, useEditorState, type EditorStore } from './editor-store';
import { hasChanges, revisionDiff, type LinkField, type ScalarField } from './revision-diff';

interface RevisionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: number;
  store: EditorStore;
  user: AuthUser;
  canRestore: boolean;
  onRestore: (revision: ArticleRevision) => Promise<void>;
}

const LINK_KINDS: Record<LinkField, LookupKind> = { tagIds: 'tags', personIds: 'persons', organizationIds: 'organizations', billIds: 'bills' };

function DiffText({ changes }: { changes: Change[] }) {
  return (
    <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-sm leading-6">
      {changes.map((change, index) =>
        change.added ? (
          <ins key={index} className="bg-green-100 text-green-900 no-underline dark:bg-green-900/40 dark:text-green-100">
            {change.value}
          </ins>
        ) : change.removed ? (
          <del key={index} className="bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100">
            {change.value}
          </del>
        ) : (
          <span key={index}>{change.value}</span>
        ),
      )}
    </p>
  );
}

function LinkChange({ field, added, removed }: { field: LinkField; added: number[]; removed: number[] }) {
  const { t } = useTranslation();
  const labels = useLookupItems(LINK_KINDS[field], [...added, ...removed]);
  const name = (id: number) => labels.get(id)?.label ?? `#${id}`;
  return (
    <li>
      <span className="font-medium">{t(`editor.fields.${field}`)}: </span>
      {added.length > 0 && <span className="text-green-700 dark:text-green-400">+ {added.map(name).join(', ')} </span>}
      {removed.length > 0 && <span className="text-red-700 line-through dark:text-red-400">− {removed.map(name).join(', ')}</span>}
    </li>
  );
}

function ScalarChange({ field, before, after }: { field: ScalarField; before: unknown; after: unknown }) {
  const { t } = useTranslation();
  const categories = useLookupItems('categories', field === 'categoryId' ? ([before, after].filter((v) => typeof v === 'number') as number[]) : []);
  const show = (value: unknown) => {
    if (value === null || value === undefined) return t('revision.none');
    if (field === 'isBreaking') return t(value ? 'common.yes' : 'common.no');
    if (field === 'categoryId') return categories.get(value as number)?.label ?? `#${String(value)}`;
    return `#${String(value)}`;
  };
  return (
    <li>
      <span className="font-medium">{t(`editor.fields.${field}`)}: </span>
      {show(before)} → {show(after)}
    </li>
  );
}

/** Revisions of the article, a diff of the selected one against the editor's current state, and restore. */
export function RevisionHistory({ open, onOpenChange, articleId, store, user, canRestore, onRestore }: RevisionHistoryProps) {
  const { t } = useTranslation();
  const state = useEditorState(store);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const revisions = useQuery({
    queryKey: ['article', articleId, 'revisions'],
    queryFn: () => api.articles.revisions(articleId, { pageSize: 100 }),
    enabled: open,
    refetchOnMount: 'always',
  });
  const list = revisions.data?.data ?? [];
  const selected = list.find((revision) => revision.id === selectedId) ?? null;
  const diff = selected ? revisionDiff(selected.snapshot, state.values) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t('revision.title')}</SheetTitle>
          <SheetDescription>{t('revision.description')}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <ul className="divide-y rounded-md border" aria-label={t('revision.title')}>
            {list.map((revision) => (
              <li key={revision.id}>
                <button
                  type="button"
                  aria-pressed={revision.id === selectedId}
                  onClick={() => setSelectedId(revision.id)}
                  className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50', revision.id === selectedId && 'bg-muted')}
                >
                  <span className="font-medium">{t(`revision.kind.${revision.kind}`)}</span>
                  <span className="text-muted-foreground">
                    {formatDateTime(revision.createdAt)} · {revision.editorId === user.id ? t('revision.you') : t('revision.editor', { id: revision.editorId })}
                  </span>
                </button>
              </li>
            ))}
            {revisions.isSuccess && list.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">{t('revision.empty')}</li>}
          </ul>

          {selected && diff && (
            <section className="space-y-3" aria-label={t('revision.diffTitle')}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t('revision.diffTitle')}</h3>
                {canRestore && (
                  <Button type="button" size="sm" onClick={() => setConfirming(true)}>
                    {t('revision.restore')}
                  </Button>
                )}
              </div>
              {!hasChanges(diff) && <p className="text-sm text-muted-foreground">{t('revision.identical')}</p>}
              {diff.title && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">{t('editor.fields.title')}</h4>
                  <DiffText changes={diff.title} />
                </div>
              )}
              {diff.lede && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">{t('editor.fields.lede')}</h4>
                  <DiffText changes={diff.lede} />
                </div>
              )}
              {diff.body && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">{t('editor.fields.body')}</h4>
                  <DiffText changes={diff.body} />
                </div>
              )}
              {(diff.scalars.length > 0 || diff.links.length > 0) && (
                <ul className="space-y-1 text-sm">
                  {diff.scalars.map((change) => (
                    <ScalarChange key={change.field} {...change} />
                  ))}
                  {diff.links.map((change) => (
                    <LinkChange key={change.field} {...change} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t('revision.restoreTitle')}
          description={isDirty(state) ? t('revision.restoreDescriptionUnsaved') : t('revision.restoreDescription')}
          confirmLabel={t('revision.restore')}
          onConfirm={() => {
            if (selected) void onRestore(selected);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
