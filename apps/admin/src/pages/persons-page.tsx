import type { AdminPerson } from '@news/shared/schemas';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DataTable, useListParams, useListQuery, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/session';

const FILTER_KEYS = ['deleted'] as const;
const column = createColumnHelper<AdminPerson>();

export function PersonsPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const isAdmin = user?.role === 'admin';
  const list = useListParams(FILTER_KEYS);

  const query = useListQuery('persons', list.params, (p) =>
    api.admin.persons.list({
      page: p.page,
      pageSize: p.pageSize,
      search: p.search || undefined,
      // Only admins may list deleted people (the API returns 403 otherwise).
      includeDeleted: isAdmin && p.filters.deleted ? 'true' : undefined,
    }),
  );

  const columns = useMemo(
    () => [
      column.accessor('displayName', {
        header: t('pages.persons.columns.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.deletedAt ? (
              <span className="font-medium">{row.original.displayName}</span>
            ) : (
              <Link to={`/persons/${row.original.id}`} className="font-medium hover:underline">
                {row.original.displayName}
              </Link>
            )}
            <span className="text-muted-foreground">
              {row.original.patronymicMn} {row.original.givenNameMn}
            </span>
            {row.original.deletedAt && <Badge variant="destructive">{t('pages.persons.deleted')}</Badge>}
          </div>
        ),
      }),
      column.accessor('slug', { header: t('pages.persons.columns.slug'), cell: (info) => <code className="text-xs">{info.getValue()}</code> }),
      column.accessor('updatedAt', { header: t('pages.persons.columns.updated'), cell: (info) => formatDateTime(info.getValue()) }),
    ],
    [t],
  );

  const filters: FilterDef[] = isAdmin ? [{ key: 'deleted', label: t('pages.persons.filters.showDeleted'), type: 'toggle' }] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pages.persons.title')}
        actions={
          <Button asChild>
            <Link to="/persons/new">
              <Plus aria-hidden />
              {t('persons.new')}
            </Link>
          </Button>
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
        searchPlaceholder={t('pages.persons.search')}
        filters={filters}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );
}
