import { isApiError } from '@news/shared/api-client';
import type { Article, ArticleEdit, CreateArticleBody } from '@news/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { notify } from '@/lib/notify';
import { buildBody, isDirty, type EditorStore } from './editor-store';

export type SaveStatus = 'idle' | 'saving' | 'error';

interface SaveRequest {
  article: Article | null;
  body: CreateArticleBody;
  auto: boolean;
  edit?: ArticleEdit;
}

interface Options {
  store: EditorStore;
  /** Asks minor/substantive for published articles (null = cancelled). */
  askEditType: () => Promise<ArticleEdit | null>;
  /** First save of a new article. */
  onCreated: (article: Article) => void;
}

/**
 * Manual saves and autosaves. Every update sends `expectedUpdatedAt`; a 409 EDIT_CONFLICT means someone else
 * saved in between, so saving stops until the editor reloads (nothing is overwritten silently).
 */
export function useArticleSave({ store, askEditType, onCreated }: Options) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [conflict, setConflict] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  // A mutation (not a bare call) so a 401 ends the session through the global MutationCache handler.
  const mutation = useMutation({
    mutationFn: ({ article, body, auto, edit }: SaveRequest) =>
      article
        ? api.articles.update(article.id, { ...body, expectedUpdatedAt: article.updatedAt, autosave: auto || undefined, edit })
        : api.articles.create(body),
  });
  const { mutateAsync } = mutation;

  const save = useCallback(
    async ({ auto }: { auto: boolean }): Promise<boolean> => {
      if (inFlight.current) return false;
      const state = store.get();
      if (state.article && !isDirty(state)) return true;

      const built = buildBody(state.values);
      if ('error' in built) {
        if (!auto) notify.error(t(`editor.invalid.${built.error}`));
        return false;
      }

      let edit: ArticleEdit | undefined;
      if (state.article?.status === 'published') {
        if (auto) return false;
        const answer = await askEditType();
        if (!answer) return false;
        edit = answer;
      }

      inFlight.current = true;
      setStatus('saving');
      try {
        const { data } = await mutateAsync({ article: state.article, body: built.body, auto, edit });
        store.markSaved(state.version, data);
        setLastSavedAt(new Date());
        setStatus('idle');
        void queryClient.invalidateQueries({ queryKey: ['articles'] });
        if (!state.article) onCreated(data);
        return true;
      } catch (err) {
        setStatus('error');
        if (isApiError(err) && err.code === 'EDIT_CONFLICT') setConflict(true);
        else if (!auto) notify.apiError(err);
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [store, askEditType, onCreated, mutateAsync, queryClient, t],
  );

  return { save, status, conflict, lastSavedAt };
}
