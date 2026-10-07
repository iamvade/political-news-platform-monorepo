import { CORRECTION_ENTITY_TYPES, correctionEntityTypeSchema, type AdminCorrection } from '@news/shared/schemas';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, useListParams, useListQuery, type FilterDef } from '@/components/data-table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { useLookupItems } from '@/hooks/use-lookup';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { CorrectionDialog } from './correction-dialog';

const FILTER_KEYS = ['entityType'] as const;
const column = createColumnHelper<AdminCorrection>();

const idsOf = (rows: AdminCorrection[], type: AdminCorrection['entityType']) => rows.filter((row) => row.entityType === type).map((row) => row.entityId);

/** Corrections log for profile data (article corrections are created by the published-edit flow). */
export function CorrectionsPage() {
  const { t } = useTranslation();
  const isAdmin = useSession().user?.role === 'admin';
  const list = useListParams(FILTER_KEYS);
  const [editing, setEditing] = useState<AdminCorrection | 'new' | null>(null);
  // Page-level (not in the cell): table cells remount when columns change, which would drop dialog state.
  const [deleting, setDeleting] = useState<AdminCorrection | null>(null);
  const query = useListQuery('corrections', list.params, (p) =>
    api.admin.corrections.list({ page: p.page, pageSize: p.pageSize, entityType: correctionEntityTypeSchema.safeParse(p.filters.entityType).data }),
  );
  const rows = query.rows ?? [];
  const persons = useLookupItems('persons', idsOf(rows, 'person'));
  const organizations = useLookupItems('organizations', idsOf(rows, 'organization'));
  const bills = useLookupItems('bills', idsOf(rows, 'bill'));
  const remove = useSaveRecord((id: number) => api.admin.corrections.remove(id), { invalidate: [['corrections']], successMessage: t('form.deleted') });

  const columns = useMemo(() => {
    const labels = { person: persons, organization: organizations, bill: bills } as const;
    return [
      column.accessor('date', { header: t('corrections.fields.date'), cell: (info) => formatDate(info.getValue()) }),
      column.display({
        id: 'target',
        header: t('corrections.fields.target'),
        cell: ({ row }) => {
          const { entityType, entityId } = row.original;
          const label = entityType in labels ? labels[entityType as keyof typeof labels].get(entityId)?.label : undefined;
          return (
            <div className="flex items-center gap-2">
              <StatusBadge group="correctionEntity" value={entityType} />
              <span>{label ?? `#${entityId}`}</span>
            </div>
          );
        },
      }),
      column.accessor('description', { header: t('corrections.fields.description'), cell: (info) => <span className="line-clamp-2">{info.getValue()}</span> }),
      column.accessor('reason', { header: t('corrections.fields.reason') }),
      column.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t('corrections.edit')} onClick={() => setEditing(row.original)}>
              <Pencil aria-hidden />
            </Button>
            {isAdmin && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t('corrections.delete')} onClick={() => setDeleting(row.original)}>
                <Trash2 aria-hidden />
              </Button>
            )}
          </div>
        ),
      }),
    ];
  }, [t, persons, organizations, bills, isAdmin]);

  const filters: FilterDef[] = [
    {
      key: 'entityType',
      label: t('corrections.fields.entityType'),
      type: 'select',
      options: CORRECTION_ENTITY_TYPES.map((type) => ({ value: type, label: t(`status.correctionEntity.${type}`) })),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('corrections.title')}
        actions={
          <Button type="button" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {t('corrections.add')}
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{t('corrections.intro')}</p>
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
      {editing && <CorrectionDialog correction={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('form.deleteTitle')}
        description={t('form.deleteDescription')}
        confirmLabel={t('form.delete')}
        destructive
        onConfirm={() => deleting && remove.submit(deleting.id)}
      />
    </div>
  );
}
