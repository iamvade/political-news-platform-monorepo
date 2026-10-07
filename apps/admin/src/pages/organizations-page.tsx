import { ORGANIZATION_TYPES, organizationTypeSchema, type AdminOrganization } from '@news/shared/schemas';
import { createColumnHelper } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, useListParams, useListQuery, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';

const FILTER_KEYS = ['type'] as const;
const column = createColumnHelper<AdminOrganization>();

export function OrganizationsPage() {
  const { t } = useTranslation();
  const list = useListParams(FILTER_KEYS);

  const query = useListQuery('organizations', list.params, (p) =>
    api.admin.organizations.list({
      page: p.page,
      pageSize: p.pageSize,
      search: p.search || undefined,
      type: organizationTypeSchema.safeParse(p.filters.type).data,
    }),
  );

  const columns = useMemo(
    () => [
      column.accessor('nameMn', {
        header: t('pages.organizations.columns.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.color && <span className="size-3 rounded-full" style={{ backgroundColor: row.original.color }} aria-hidden />}
            <span className="font-medium">{row.original.nameMn}</span>
          </div>
        ),
      }),
      column.accessor('shortNameMn', { header: t('pages.organizations.columns.shortName'), cell: (info) => info.getValue() ?? '—' }),
      column.accessor('type', {
        header: t('pages.organizations.columns.type'),
        cell: (info) => <StatusBadge group="organizationType" value={info.getValue()} />,
      }),
    ],
    [t],
  );

  const filters: FilterDef[] = [
    {
      key: 'type',
      label: t('pages.organizations.filters.type'),
      type: 'select',
      options: ORGANIZATION_TYPES.map((type) => ({ value: type, label: t(`status.organizationType.${type}`) })),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('pages.organizations.title')} />
      <DataTable
        columns={columns}
        rows={query.rows}
        pagination={query.pagination}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={query.refetch}
        list={list}
        searchPlaceholder={t('pages.organizations.search')}
        filters={filters}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );
}
