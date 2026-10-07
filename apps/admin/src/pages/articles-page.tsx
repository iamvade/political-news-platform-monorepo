import { can } from '@news/shared/policies';
import { ARTICLE_STATUSES, articleStatusSchema, type ArticleSummary } from '@news/shared/schemas';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DataTable, useListParams, useListQuery, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/session';

const FILTER_KEYS = ['status', 'mine'] as const;
const column = createColumnHelper<ArticleSummary>();

export function ArticlesPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const list = useListParams(FILTER_KEYS);

  const query = useListQuery('articles', list.params, (p) =>
    api.articles.list({
      page: p.page,
      pageSize: p.pageSize,
      search: p.search || undefined,
      status: articleStatusSchema.safeParse(p.filters.status).data,
      authorId: p.filters.mine && user ? user.id : undefined,
    }),
  );

  const columns = useMemo(
    () => [
      column.accessor('title', {
        header: t('pages.articles.columns.title'),
        cell: (info) => (
          <div className="flex items-center gap-2">
            <Link to={`/articles/${info.row.original.id}`} className="font-medium hover:underline">
              {info.getValue()}
            </Link>
            {info.row.original.isBreaking && <Badge variant="destructive">{t('pages.articles.breaking')}</Badge>}
          </div>
        ),
      }),
      column.accessor('status', {
        header: t('pages.articles.columns.status'),
        cell: (info) => <StatusBadge group="article" value={info.getValue()} />,
      }),
      column.display({
        id: 'published',
        header: t('pages.articles.columns.published'),
        cell: ({ row }) =>
          row.original.status === 'scheduled'
            ? t('pages.articles.scheduledFor', { date: formatDateTime(row.original.scheduledAt) })
            : formatDateTime(row.original.publishedAt),
      }),
      column.accessor('updatedAt', { header: t('pages.articles.columns.updated'), cell: (info) => formatDateTime(info.getValue()) }),
    ],
    [t],
  );

  const filters: FilterDef[] = [
    {
      key: 'status',
      label: t('pages.articles.filters.status'),
      type: 'select',
      options: ARTICLE_STATUSES.map((s) => ({ value: s, label: t(`status.article.${s}`) })),
    },
    { key: 'mine', label: t('pages.articles.filters.mine'), type: 'toggle' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pages.articles.title')}
        actions={
          user &&
          can(user, 'create') && (
            <Button asChild>
              <Link to="/articles/new">
                <Plus aria-hidden />
                {t('pages.articles.new')}
              </Link>
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        rows={query.rows}
        pagination={query.pagination}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={query.refetch}
        list={list}
        searchPlaceholder={t('pages.articles.search')}
        filters={filters}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );
}
