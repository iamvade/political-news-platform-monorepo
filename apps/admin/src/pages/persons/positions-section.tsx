import { createPositionBodySchema, type AdminPosition, type CreatePositionBody } from '@news/shared/schemas';
import { useQuery } from '@tanstack/react-query';
import { CircleStop, ExternalLink, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteButton } from '@/components/delete-button';
import { FormDialog } from '@/components/form-dialog';
import { FormField } from '@/components/form-field';
import { LookupSelect } from '@/components/lookup-select';
import { Timeline } from '@/components/timeline';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLookupItems } from '@/hooks/use-lookup';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';
import { todayUb } from '@/lib/dates';
import { formatDate } from '@/lib/format';
import { orNull, schemaFieldErrors } from '@/lib/form-errors';
import { useSession } from '@/lib/session';

/** Positions of a person as a timeline (newest first), with add / edit / end / delete. */
export function PositionsSection({ personId }: { personId: number }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const [editing, setEditing] = useState<AdminPosition | 'new' | null>(null);
  const [ending, setEnding] = useState<AdminPosition | null>(null);
  const query = useQuery({ queryKey: ['positions', { personId }], queryFn: () => api.admin.positions.list({ personId, pageSize: 100 }) });
  const rows = query.data?.data ?? [];
  const organizations = useLookupItems('organizations', [...new Set(rows.map((row) => row.organizationId))]);
  const remove = useSaveRecord((id: number) => api.admin.positions.remove(id), { invalidate: [['positions']], successMessage: t('form.deleted') });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('positions.title')}</CardTitle>
        <CardAction>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {t('positions.add')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Timeline
          label={t('positions.title')}
          empty={t('positions.empty')}
          entries={rows.map((row) => ({
            key: row.id,
            current: row.endDate === null,
            when: `${formatDate(row.startDate)} – ${row.endDate ? formatDate(row.endDate) : t('form.now')}`,
            title: row.titleMn,
            body: (
              <span className="flex flex-wrap items-center gap-2">
                <span>{organizations.get(row.organizationId)?.label ?? `#${row.organizationId}`}</span>
                <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                  <ExternalLink className="size-3" aria-hidden />
                  {t('form.openSource')}
                </a>
              </span>
            ),
            actions: (
              <>
                {row.endDate === null && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t('positions.end', { title: row.titleMn })} title={t('positions.endShort')} onClick={() => setEnding(row)}>
                    <CircleStop aria-hidden />
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t('positions.edit', { title: row.titleMn })} onClick={() => setEditing(row)}>
                  <Pencil aria-hidden />
                </Button>
                {user?.role === 'admin' && <DeleteButton label={t('positions.delete', { title: row.titleMn })} onConfirm={() => remove.submit(row.id)} />}
              </>
            ),
          }))}
        />
      </CardContent>
      {editing && <PositionDialog personId={personId} position={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {ending && <EndPositionDialog position={ending} onClose={() => setEnding(null)} />}
    </Card>
  );
}

function PositionDialog({ personId, position, onClose }: { personId: number; position: AdminPosition | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [organizationId, setOrganizationId] = useState<number | null>(position?.organizationId ?? null);
  const [titleMn, setTitleMn] = useState(position?.titleMn ?? '');
  const [titleEn, setTitleEn] = useState(position?.titleEn ?? '');
  const [startDate, setStartDate] = useState(position?.startDate ?? '');
  const [endDate, setEndDate] = useState(position?.endDate ?? '');
  const [sourceUrl, setSourceUrl] = useState(position?.sourceUrl ?? '');
  const save = useSaveRecord(
    (body: CreatePositionBody) => (position ? api.admin.positions.update(position.id, body) : api.admin.positions.create(body)),
    { invalidate: [['positions']], onSaved: onClose },
  );
  const errors = save.errors;

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(position ? 'positions.editTitle' : 'positions.newTitle')}
      submitting={save.pending}
      onSubmit={() => {
        const body = { personId, organizationId: organizationId ?? 0, titleMn: titleMn.trim(), titleEn: orNull(titleEn), startDate, endDate: endDate || null, sourceUrl: sourceUrl.trim() };
        save.submit(body, schemaFieldErrors(createPositionBodySchema.safeParse(body)));
      }}
    >
      <FormField id="position-organization" label={t('positions.fields.organization')} error={errors.organizationId} required>
        <LookupSelect
          id="position-organization"
          kind="organizations"
          value={organizationId}
          onChange={(id) => setOrganizationId(id)}
          label={t('positions.fields.organization')}
          withImages
          invalid={!!errors.organizationId}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="position-titleMn" label={t('positions.fields.titleMn')} error={errors.titleMn} required>
          <Input id="position-titleMn" value={titleMn} onChange={(event) => setTitleMn(event.target.value)} maxLength={200} aria-invalid={!!errors.titleMn} />
        </FormField>
        <FormField id="position-titleEn" label={t('positions.fields.titleEn')} error={errors.titleEn}>
          <Input id="position-titleEn" value={titleEn} onChange={(event) => setTitleEn(event.target.value)} maxLength={200} />
        </FormField>
        <FormField id="position-startDate" label={t('positions.fields.startDate')} error={errors.startDate} required>
          <Input id="position-startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-invalid={!!errors.startDate} />
        </FormField>
        <FormField id="position-endDate" label={t('positions.fields.endDate')} error={errors.endDate} hint={t('positions.endHint')}>
          <Input id="position-endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-invalid={!!errors.endDate} />
        </FormField>
      </div>
      <FormField id="position-sourceUrl" label={t('form.sourceUrl')} error={errors.sourceUrl} hint={t('form.sourceHint')} required>
        <Input id="position-sourceUrl" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" aria-invalid={!!errors.sourceUrl} />
      </FormField>
    </FormDialog>
  );
}

function EndPositionDialog({ position, onClose }: { position: AdminPosition; onClose: () => void }) {
  const { t } = useTranslation();
  const [endDate, setEndDate] = useState(todayUb());
  const save = useSaveRecord((date: string) => api.admin.positions.update(position.id, { endDate: date }), { invalidate: [['positions']], onSaved: onClose });

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('positions.endTitle', { title: position.titleMn })}
      submitLabel={t('positions.endShort')}
      submitting={save.pending}
      onSubmit={() => save.submit(endDate, endDate && endDate >= position.startDate ? {} : { endDate: t('positions.endBeforeStart') })}
    >
      <FormField id="position-end" label={t('positions.fields.endDate')} error={save.errors.endDate} required>
        <Input id="position-end" type="date" value={endDate} min={position.startDate} onChange={(event) => setEndDate(event.target.value)} />
      </FormField>
    </FormDialog>
  );
}
