import { PROMISE_STATUSES, promiseStatusSchema, type AdminPromise } from '@news/shared/schemas';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DataTable, useListParams, useListQuery, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { useLookupItems } from '@/hooks/use-lookup';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

const FILTER_KEYS = ['status'] as const;
const column = createColumnHelper<AdminPromise>();

export function PromisesPage() {
  const { t } = useTranslation();
  const list = useListParams(FILTER_KEYS);
  const query = useListQuery('promises', list.params, (p) =>
    api.admin.promises.list({ page: p.page, pageSize: p.pageSize, status: promiseStatusSchema.safeParse(p.filters.status).data }),
  );
  const rows = query.rows ?? [];
  const persons = useLookupItems('persons', rows.flatMap((row) => (row.personId ? [row.personId] : [])));
  const organizations = useLookupItems('organizations', rows.flatMap((row) => (row.organizationId ? [row.organizationId] : [])));

  const columns = useMemo(
    () => [
      column.accessor('textMn', {
        header: t('promisesPage.columns.text'),
        cell: (info) => (
          <Link to={`/promises/${info.row.original.id}`} className="line-clamp-2 font-medium hover:underline">
            {info.getValue()}
          </Link>
        ),
      }),
      column.display({
        id: 'subject',
        header: t('promisesPage.columns.subject'),
        cell: ({ row }) =>
          row.original.personId
            ? (persons.get(row.original.personId)?.label ?? `#${row.original.personId}`)
            : (organizations.get(row.original.organizationId!)?.label ?? `#${row.original.organizationId}`),
      }),
      column.accessor('madeOn', { header: t('promisesPage.columns.madeOn'), cell: (info) => formatDate(info.getValue()) }),
      column.accessor('status', { header: t('promisesPage.columns.status'), cell: (info) => <StatusBadge group="promise" value={info.getValue()} /> }),
    ],
    [t, persons, organizations],
  );

  const filters: FilterDef[] = [
    {
      key: 'status',
      label: t('promisesPage.columns.status'),
      type: 'select',
      options: PROMISE_STATUSES.map((s) => ({ value: s, label: t(`status.promise.${s}`) })),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('promisesPage.title')}
        actions={
          <Button asChild>
            <Link to="/promises/new">
              <Plus aria-hidden />
              {t('promises.add')}
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
        searchable={false}
        filters={filters}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );
}
