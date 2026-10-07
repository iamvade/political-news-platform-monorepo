import { BILL_STAGES, createBillStageBodySchema, type AdminBillStage, type BillStage, type CreateBillStageBody } from '@news/shared/schemas';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteButton } from '@/components/delete-button';
import { FormDialog } from '@/components/form-dialog';
import { FormField } from '@/components/form-field';
import { Timeline } from '@/components/timeline';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { orNull, schemaFieldErrors } from '@/lib/form-errors';
import { useSession } from '@/lib/session';

/** Dated stages of a bill (newest first). */
export function StagesSection({ billId }: { billId: number }) {
  const { t } = useTranslation();
  const isAdmin = useSession().user?.role === 'admin';
  const [editing, setEditing] = useState<AdminBillStage | 'new' | null>(null);
  const query = useQuery({ queryKey: ['bill-stages', { billId }], queryFn: () => api.admin.billStages.list({ billId, pageSize: 100 }) });
  const remove = useSaveRecord((id: number) => api.admin.billStages.remove(id), { invalidate: [['bill-stages']], successMessage: t('form.deleted') });
  const rows = [...(query.data?.data ?? [])].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stages.title')}</CardTitle>
        <CardAction>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {t('stages.add')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">{t('stages.statusHint')}</p>
        <Timeline
          label={t('stages.title')}
          empty={t('stages.empty')}
          entries={rows.map((row, index) => ({
            key: row.id,
            current: index === 0,
            when: formatDate(row.date),
            title: t(`status.billStage.${row.stage}`),
            body: (
              <span className="flex flex-wrap items-center gap-2">
                {row.noteMn && <span>{row.noteMn}</span>}
                <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                  <ExternalLink className="size-3" aria-hidden />
                  {t('form.openSource')}
                </a>
              </span>
            ),
            actions: (
              <>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t('stages.edit', { stage: t(`status.billStage.${row.stage}`) })} onClick={() => setEditing(row)}>
                  <Pencil aria-hidden />
                </Button>
                {isAdmin && <DeleteButton label={t('stages.delete', { stage: t(`status.billStage.${row.stage}`) })} onConfirm={() => remove.submit(row.id)} />}
              </>
            ),
          }))}
        />
      </CardContent>
      {editing && <StageDialog billId={billId} stage={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function StageDialog({ billId, stage, onClose }: { billId: number; stage: AdminBillStage | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<BillStage>(stage?.stage ?? 'submitted');
  const [date, setDate] = useState(stage?.date ?? '');
  const [noteMn, setNoteMn] = useState(stage?.noteMn ?? '');
  const [sourceUrl, setSourceUrl] = useState(stage?.sourceUrl ?? '');
  const save = useSaveRecord(
    (body: CreateBillStageBody) => (stage ? api.admin.billStages.update(stage.id, body) : api.admin.billStages.create(body)),
    { invalidate: [['bill-stages']], onSaved: onClose },
  );
  const errors = save.errors;

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(stage ? 'stages.editTitle' : 'stages.newTitle')}
      submitting={save.pending}
      onSubmit={() => {
        const body = { billId, stage: kind, date, noteMn: orNull(noteMn), sourceUrl: sourceUrl.trim() };
        save.submit(body, schemaFieldErrors(createBillStageBodySchema.safeParse(body)));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="stage-kind" label={t('stages.fields.stage')} required>
          <Select value={kind} onValueChange={(value) => setKind(value as BillStage)}>
            <SelectTrigger id="stage-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILL_STAGES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`status.billStage.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="stage-date" label={t('stages.fields.date')} error={errors.date} required>
          <Input id="stage-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={!!errors.date} />
        </FormField>
      </div>
      <FormField id="stage-note" label={t('stages.fields.noteMn')} error={errors.noteMn}>
        <Textarea id="stage-note" value={noteMn} onChange={(event) => setNoteMn(event.target.value)} maxLength={2000} />
      </FormField>
      <FormField id="stage-source" label={t('form.sourceUrl')} error={errors.sourceUrl} hint={t('form.sourceHint')} required>
        <Input id="stage-source" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" aria-invalid={!!errors.sourceUrl} />
      </FormField>
    </FormDialog>
  );
}
