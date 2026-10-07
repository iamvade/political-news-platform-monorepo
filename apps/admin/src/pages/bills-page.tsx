import { BILL_STATUSES, billStatusSchema, type AdminBill } from '@news/shared/schemas';
import { createColumnHelper } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, useListParams, useListQuery, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

const FILTER_KEYS = ['status'] as const;
const column = createColumnHelper<AdminBill>();

export function BillsPage() {
  const { t } = useTranslation();
  const list = useListParams(FILTER_KEYS);

  const query = useListQuery('bills', list.params, (p) =>
    api.admin.bills.list({
      page: p.page,
      pageSize: p.pageSize,
      search: p.search || undefined,
      status: billStatusSchema.safeParse(p.filters.status).data,
    }),
  );

  const columns = useMemo(
    () => [
      column.accessor('titleMn', { header: t('pages.bills.columns.title'), cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
      column.accessor('registrationNumber', { header: t('pages.bills.columns.registrationNumber'), cell: (info) => info.getValue() ?? '—' }),
      column.accessor('status', { header: t('pages.bills.columns.status'), cell: (info) => <StatusBadge group="bill" value={info.getValue()} /> }),
      column.accessor('submittedOn', { header: t('pages.bills.columns.submittedOn'), cell: (info) => formatDate(info.getValue()) }),
    ],
    [t],
  );

  const filters: FilterDef[] = [
    {
      key: 'status',
      label: t('pages.bills.filters.status'),
      type: 'select',
      options: BILL_STATUSES.map((s) => ({ value: s, label: t(`status.bill.${s}`) })),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('pages.bills.title')} />
      <DataTable
        columns={columns}
        rows={query.rows}
        pagination={query.pagination}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={query.refetch}
        list={list}
        searchPlaceholder={t('pages.bills.search')}
        filters={filters}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );
}
