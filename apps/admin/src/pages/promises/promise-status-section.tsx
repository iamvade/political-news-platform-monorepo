import { PROMISE_STATUSES, promiseStatusChangeBodySchema, type AdminPromise, type PromiseStatus, type PromiseStatusChangeBody } from '@news/shared/schemas';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '@/components/form-dialog';
import { FormField } from '@/components/form-field';
import { StatusBadge } from '@/components/status-badge';
import { Timeline } from '@/components/timeline';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';
import { todayUb } from '@/lib/dates';
import { formatDate, formatDateTime } from '@/lib/format';
import { schemaFieldErrors } from '@/lib/form-errors';
import { useSession } from '@/lib/session';

/** Current status and its dated history; the status changes only through the dialog (note + evidence required). */
export function PromiseStatusSection({ promise }: { promise: AdminPromise }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const [changing, setChanging] = useState(false);
  const updates = useQuery({ queryKey: ['promise-updates', promise.id], queryFn: () => api.admin.promises.updates(promise.id, { pageSize: 100 }) });
  const rows = updates.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('promisesPage.status.title')}
          <StatusBadge group="promise" value={promise.status} />
        </CardTitle>
        <CardAction>
          <Button type="button" size="sm" onClick={() => setChanging(true)}>
            {t('promisesPage.status.change')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('promisesPage.status.lastReviewed', { date: formatDateTime(promise.lastReviewedAt) })}
        </p>
        <Timeline
          label={t('promisesPage.status.history')}
          empty={t('promisesPage.status.empty')}
          entries={rows.map((row, index) => ({
            key: row.id,
            current: index === 0,
            when: `${formatDate(row.date)} · ${row.createdBy === user?.id ? t('revision.you') : t('revision.editor', { id: row.createdBy })}`,
            title: <StatusBadge group="promise" value={row.status} />,
            body: (
              <span className="space-y-1">
                <span className="block text-foreground">{row.noteMn}</span>
                <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                  <ExternalLink className="size-3" aria-hidden />
                  {t('promisesPage.status.evidence')}
                </a>
              </span>
            ),
          }))}
        />
      </CardContent>
      {changing && <StatusChangeDialog promise={promise} onClose={() => setChanging(false)} />}
    </Card>
  );
}

function StatusChangeDialog({ promise, onClose }: { promise: AdminPromise; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PromiseStatus>(promise.status);
  const [date, setDate] = useState(todayUb());
  const [noteMn, setNoteMn] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const save = useSaveRecord((body: PromiseStatusChangeBody) => api.admin.promises.changeStatus(promise.id, body), {
    invalidate: [['promises'], ['promise-updates', promise.id]],
    onSaved: ({ data }) => {
      queryClient.setQueryData(['promise', data.id], { data });
      onClose();
    },
  });
  const errors = save.errors;

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('promisesPage.status.change')}
      description={t('promisesPage.status.changeHint')}
      submitting={save.pending}
      onSubmit={() => {
        const body = { status, date, noteMn: noteMn.trim(), sourceUrl: sourceUrl.trim() };
        save.submit(body, schemaFieldErrors(promiseStatusChangeBodySchema.safeParse(body)));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="status-value" label={t('promisesPage.status.newStatus')} required>
          <Select value={status} onValueChange={(value) => setStatus(value as PromiseStatus)}>
            <SelectTrigger id="status-value" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROMISE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`status.promise.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="status-date" label={t('promisesPage.status.date')} error={errors.date} required>
          <Input id="status-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={!!errors.date} />
        </FormField>
      </div>
      <FormField id="status-note" label={t('promisesPage.status.note')} error={errors.noteMn} required>
        <Textarea id="status-note" value={noteMn} onChange={(event) => setNoteMn(event.target.value)} rows={3} maxLength={2000} aria-invalid={!!errors.noteMn} />
      </FormField>
      <FormField id="status-source" label={t('promisesPage.status.evidenceUrl')} error={errors.sourceUrl} required>
        <Input id="status-source" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" aria-invalid={!!errors.sourceUrl} />
      </FormField>
    </FormDialog>
  );
}
