import { isApiError } from '@news/shared/api-client';
import type { Article } from '@news/shared/schemas';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { errorMessage, notify } from '@/lib/notify';
import { useSession } from '@/lib/session';
import { NotFoundPage } from '@/pages/status-pages';
import { ArticleEditor } from './article-editor';

const articleKey = (id: number | null) => ['article', id] as const;

/** `/articles/new` and `/articles/:id`. */
export function ArticleEditorPage() {
  const { t } = useTranslation();
  const { id = 'new' } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Bumped to remount the editor with fresh server state (restore, reload after a conflict).
  const [generation, setGeneration] = useState(0);
  const articleId = id === 'new' ? null : /^\d+$/.test(id) ? Number(id) : NaN;

  const query = useQuery({
    queryKey: articleKey(articleId),
    queryFn: () => api.articles.get(articleId!),
    enabled: articleId !== null && !Number.isNaN(articleId),
    // The editor owns the state once loaded; refetch only on purpose.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const onCreated = useCallback(
    (article: Article) => {
      queryClient.setQueryData(articleKey(article.id), { data: article });
      void navigate(`/articles/${article.id}`, { replace: true });
    },
    [navigate, queryClient],
  );

  const onReplace = useCallback(
    (article: Article) => {
      queryClient.setQueryData(articleKey(article.id), { data: article });
      setGeneration((n) => n + 1);
    },
    [queryClient],
  );

  const onReload = useCallback(async () => {
    try {
      await queryClient.fetchQuery({ queryKey: articleKey(articleId), queryFn: () => api.articles.get(articleId!), staleTime: 0 });
      setGeneration((n) => n + 1);
    } catch (err) {
      notify.apiError(err);
    }
  }, [articleId, queryClient]);

  if (!user) return null;
  if (Number.isNaN(articleId)) return <NotFoundPage />;
  if (articleId === null) {
    return <ArticleEditor key="new" article={null} user={user} onCreated={onCreated} onReplace={onReplace} onReload={() => undefined} />;
  }
  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (query.isError) {
    if (isApiError(query.error) && query.error.status === 404) return <NotFoundPage />;
    return (
      <div className="space-y-3 text-sm">
        <p className="text-destructive">{errorMessage(query.error)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t('table.retry')}
        </Button>
      </div>
    );
  }
  return (
    <ArticleEditor
      key={`${articleId}:${generation}`}
      article={query.data.data}
      user={user}
      onCreated={onCreated}
      onReplace={onReplace}
      onReload={() => void onReload()}
    />
  );
}
