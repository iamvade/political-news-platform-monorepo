import type { ContentDoc } from '@news/shared/content';
import { can } from '@news/shared/policies';
import type { Article, ArticleEdit, ArticleRevision, AuthUser } from '@news/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/react';
import { ArrowLeft, Lock, Save, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/editor/rich-text-editor';
import { api } from '@/lib/api';
import { notify } from '@/lib/notify';
import { formatUbTime } from '@/lib/timezone';
import { EMPTY_DOC, createEditorStore, isDirty, useEditorState } from './editor-store';
import { useEditTypeDialog } from './edit-type-dialog';
import { MetadataPanel } from './metadata-panel';
import { RevisionHistory } from './revision-history';
import { UnsavedChangesGuard } from './unsaved-changes-guard';
import { useArticleSave, type SaveStatus } from './use-article-save';
import { WorkflowCard, type TransitionPayload } from './workflow-card';

/** Background save cadence for drafts and articles in review. */
export const AUTOSAVE_INTERVAL_MS = 15_000;

interface ArticleEditorProps {
  /** null = new article (created on the first save). Read once: remount to load another state. */
  article: Article | null;
  user: AuthUser;
  onCreated: (article: Article) => void;
  /** Server state replaced the local one (restore): remount with it. */
  onReplace: (article: Article) => void;
  /** Discard local changes and load the latest server state (after an edit conflict). */
  onReload: () => void;
}

function callTransition(id: number, payload: TransitionPayload) {
  switch (payload.action) {
    case 'submit':
      return api.articles.submit(id);
    case 'returnToDraft':
      return api.articles.returnToDraft(id, { note: payload.note });
    case 'publish':
      return api.articles.publish(id);
    case 'schedule':
      return api.articles.schedule(id, { scheduledAt: payload.scheduledAt });
    case 'unpublish':
      return api.articles.unpublish(id);
  }
}

function statusText(t: (key: string, options?: Record<string, unknown>) => string, opts: { conflict: boolean; status: SaveStatus; dirty: boolean; lastSavedAt: Date | null; article: Article | null }) {
  if (opts.conflict) return t('editor.status.conflict');
  if (opts.status === 'saving') return t('editor.status.saving');
  if (opts.status === 'error') return t('editor.status.error');
  if (opts.dirty) return t('editor.status.unsaved');
  const savedAt = opts.lastSavedAt ?? (opts.article ? new Date(opts.article.updatedAt) : null);
  return savedAt ? t('editor.status.savedAt', { time: formatUbTime(savedAt) }) : t('editor.status.new');
}

export function ArticleEditor({ article: initialArticle, user, onCreated, onReplace, onReload }: ArticleEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [store] = useState(() => createEditorStore(initialArticle));
  const state = useEditorState(store);
  const { article, values } = state;
  const dirty = isDirty(state);
  const editType = useEditTypeDialog();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { save, status, conflict, lastSavedAt } = useArticleSave({ store, askEditType: editType.ask, onCreated });

  const canEdit = article ? can(user, 'update', article) : can(user, 'create');
  // While a new article is being created the form is frozen: the editor remounts on its new URL.
  const creating = status === 'saving' && article === null;
  const editable = canEdit && !conflict && !creating;
  const autosaveOn = article !== null && canEdit && !conflict && (article.status === 'draft' || article.status === 'in_review');

  useEffect(() => {
    if (!autosaveOn) return;
    const timer = setInterval(() => {
      if (isDirty(store.get())) void save({ auto: true });
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [autosaveOn, save, store]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (editable) void save({ auto: false });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editable, save]);

  const onBodyChange = useCallback((doc: JSONContent) => store.update({ bodyJson: doc }), [store]);

  const transition = useMutation({ mutationFn: ({ id, payload }: { id: number; payload: TransitionPayload }) => callTransition(id, payload) });
  const restore = useMutation({
    mutationFn: ({ id, revision, edit }: { id: number; revision: ArticleRevision; edit?: ArticleEdit }) =>
      api.articles.restoreRevision(id, revision.id, { edit }),
  });

  async function runTransition(payload: TransitionPayload) {
    const current = store.get();
    if (!current.article) return;
    if (isDirty(current)) {
      // Published edits need an edit type; ask for an explicit save rather than chaining dialogs.
      if (current.article.status === 'published') return notify.info(t('editor.workflow.saveBeforeTransition'));
      if (!(await save({ auto: false }))) return;
    }
    try {
      const { data } = await transition.mutateAsync({ id: current.article.id, payload });
      store.setArticle(data);
      notify.success(t(`editor.workflow.done.${payload.action}`));
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
    } catch (err) {
      notify.apiError(err);
    }
  }

  async function handleRestore(revision: ArticleRevision) {
    const current = store.get().article;
    if (!current) return;
    let edit: ArticleEdit | undefined;
    if (current.status === 'published') {
      const answer = await editType.ask();
      if (!answer) return;
      edit = answer;
    }
    try {
      const { data } = await restore.mutateAsync({ id: current.id, revision, edit });
      notify.success(t('revision.restored'));
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
      onReplace(data);
    } catch (err) {
      notify.apiError(err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label={t('editor.back')}>
            <Link to="/articles">
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{t(article ? 'editor.editTitle' : 'editor.newTitle')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {statusText(t, { conflict, status, dirty, lastSavedAt, article })}
          </span>
          {article && (
            <Button type="button" variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              {t('revision.open')}
            </Button>
          )}
          {canEdit && (
            <Button type="button" size="sm" onClick={() => void save({ auto: false })} disabled={!editable || status === 'saving' || (!dirty && article !== null)}>
              <Save aria-hidden />
              {t('editor.save')}
            </Button>
          )}
        </div>
      </div>

      {conflict && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>{t('editor.conflict.title')}</AlertTitle>
          <AlertDescription>{t('editor.conflict.description')}</AlertDescription>
          <AlertAction>
            <Button type="button" size="sm" variant="outline" onClick={onReload}>
              {t('editor.conflict.reload')}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {!canEdit && (
        <Alert>
          <Lock aria-hidden />
          <AlertTitle>{t('editor.readOnly.title')}</AlertTitle>
          <AlertDescription>{t('editor.readOnly.description')}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <Input
            value={values.title}
            onChange={(event) => store.update({ title: event.target.value })}
            placeholder={t('editor.titlePlaceholder')}
            aria-label={t('editor.fields.title')}
            maxLength={300}
            readOnly={!editable}
            className="h-12 text-xl font-semibold md:text-2xl"
          />
          <RichTextEditor initialContent={(initialArticle?.bodyJson ?? EMPTY_DOC) as ContentDoc} editable={editable} onChange={onBodyChange} />
        </div>
        <aside className="space-y-4">
          <WorkflowCard article={article} user={user} busy={transition.isPending || status === 'saving'} onTransition={(payload) => void runTransition(payload)} />
          <MetadataPanel store={store} user={user} disabled={!editable} />
        </aside>
      </div>

      {article && (
        <RevisionHistory
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          articleId={article.id}
          store={store}
          user={user}
          canRestore={canEdit}
          onRestore={handleRestore}
        />
      )}
      <UnsavedChangesGuard store={store} />
      {editType.element}
    </div>
  );
}
