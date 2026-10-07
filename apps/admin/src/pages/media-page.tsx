import { MEDIA_STATUSES, mediaStatusSchema, type AdminMedia } from '@news/shared/schemas';
import { createColumnHelper } from '@tanstack/react-table';
import { ImageIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, useListParams, useListQuery, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/format';

const FILTER_KEYS = ['status'] as const;
const column = createColumnHelper<AdminMedia>();

function Thumbnail({ media }: { media: AdminMedia }) {
  const url = media.variants[0]?.url;
  if (!url) {
    return (
      <div className="flex size-12 items-center justify-center rounded bg-muted text-muted-foreground">
        <ImageIcon className="size-4" aria-hidden />
      </div>
    );
  }
  return <img src={url} alt={media.alt ?? ''} loading="lazy" className="size-12 rounded object-cover" />;
}

export function MediaPage() {
  const { t } = useTranslation();
  const list = useListParams(FILTER_KEYS);

  const query = useListQuery('media', list.params, (p) =>
    api.admin.media.list({
      page: p.page,
      pageSize: p.pageSize,
      search: p.search || undefined,
      status: mediaStatusSchema.safeParse(p.filters.status).data,
    }),
  );

  const columns = useMemo(() => {
    const missing = <span className="text-destructive">{t('pages.media.missing')}</span>;
    return [
      column.display({ id: 'preview', header: t('pages.media.columns.preview'), cell: ({ row }) => <Thumbnail media={row.original} /> }),
      column.accessor('alt', { header: t('pages.media.columns.alt'), cell: (info) => info.getValue() ?? missing }),
      column.accessor('credit', { header: t('pages.media.columns.credit'), cell: (info) => info.getValue() ?? missing }),
      column.accessor('status', { header: t('pages.media.columns.status'), cell: (info) => <StatusBadge group="media" value={info.getValue()} /> }),
      column.accessor('byteSize', { header: t('pages.media.columns.size'), cell: (info) => formatBytes(info.getValue()) }),
      column.accessor('createdAt', { header: t('pages.media.columns.created'), cell: (info) => formatDateTime(info.getValue()) }),
    ];
  }, [t]);

  const filters: FilterDef[] = [
    {
      key: 'status',
      label: t('pages.media.filters.status'),
      type: 'select',
      options: MEDIA_STATUSES.map((s) => ({ value: s, label: t(`status.media.${s}`) })),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('pages.media.title')} />
      <DataTable
        columns={columns}
        rows={query.rows}
        pagination={query.pagination}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={query.refetch}
        list={list}
        searchPlaceholder={t('pages.media.search')}
        filters={filters}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );
}
