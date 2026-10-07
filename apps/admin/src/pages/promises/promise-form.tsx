import { createPromiseBodySchema, type AdminPromise, type CreatePromiseBody, type PromiseEvidence } from '@news/shared/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Save, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { FormField } from '@/components/form-field';
import { FormLeaveGuard } from '@/components/form-leave-guard';
import { LookupSelect } from '@/components/lookup-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';
import { schemaFieldErrors } from '@/lib/form-errors';
import { createFormStore, isFormDirty, useFormState } from '@/lib/form-store';

type Subject = 'person' | 'organization';

interface EvidenceRow {
  url: string;
  label: string;
  date: string;
}

interface PromiseValues {
  subject: Subject;
  personId: number | null;
  organizationId: number | null;
  textMn: string;
  madeOn: string;
  evidence: EvidenceRow[];
  sourceUrl: string;
}

function valuesOf(promise: AdminPromise | null, defaults: { personId?: number }): PromiseValues {
  return {
    subject: promise?.organizationId ? 'organization' : 'person',
    personId: promise?.personId ?? defaults.personId ?? null,
    organizationId: promise?.organizationId ?? null,
    textMn: promise?.textMn ?? '',
    madeOn: promise?.madeOn ?? '',
    evidence: (promise?.evidence ?? []).map((e) => ({ url: e.url, label: e.label, date: e.date ?? '' })),
    sourceUrl: promise?.sourceUrl ?? '',
  };
}

function bodyOf(values: PromiseValues): CreatePromiseBody {
  const evidence: PromiseEvidence[] = values.evidence
    .filter((e) => e.url.trim() || e.label.trim())
    .map((e) => ({ url: e.url.trim(), label: e.label.trim(), ...(e.date && { date: e.date }) }));
  return {
    personId: values.subject === 'person' ? values.personId : null,
    organizationId: values.subject === 'organization' ? values.organizationId : null,
    textMn: values.textMn.trim(),
    madeOn: values.madeOn,
    evidence,
    sourceUrl: values.sourceUrl.trim(),
  };
}

/** What was promised, by whom, and supporting links. The status is changed separately (with a note). */
export function PromiseForm({ promise, defaultPersonId }: { promise: AdminPromise | null; defaultPersonId?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [store] = useState(() => createFormStore(valuesOf(promise, { personId: defaultPersonId })));
  const state = useFormState(store);
  const { values } = state;
  const sentVersion = useRef(0);
  const save = useSaveRecord((body: CreatePromiseBody) => (promise ? api.admin.promises.update(promise.id, body) : api.admin.promises.create(body)), {
    invalidate: [['promises']],
    successMessage: t(promise ? 'form.saved' : 'form.created'),
    onSaved: ({ data }) => {
      store.markSaved(sentVersion.current);
      queryClient.setQueryData(['promise', data.id], { data });
      if (!promise) void navigate(`/promises/${data.id}`, { replace: true });
    },
  });
  const errors = save.errors;
  const setEvidence = (index: number, patch: Partial<EvidenceRow>) =>
    store.update({ evidence: store.get().values.evidence.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  function submit() {
    const body = bodyOf(store.get().values);
    sentVersion.current = store.get().version;
    save.submit(body, schemaFieldErrors(createPromiseBodySchema.safeParse(body)));
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label={t('promisesPage.back')}>
            <Link to="/promises">
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{t(promise ? 'promisesPage.editTitle' : 'promisesPage.newTitle')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground" role="status">
            {isFormDirty(state) ? t('form.status.unsaved') : promise ? t('form.status.saved') : ''}
          </span>
          <Button type="submit" size="sm" disabled={save.pending || (promise !== null && !isFormDirty(state))}>
            <Save aria-hidden />
            {t('form.save')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('promisesPage.fields.subject')}</legend>
            <RadioGroup value={values.subject} onValueChange={(value) => store.update({ subject: value as Subject })} className="flex gap-4">
              {(['person', 'organization'] as const).map((subject) => (
                <div key={subject} className="flex items-center gap-2">
                  <RadioGroupItem value={subject} id={`promise-subject-${subject}`} />
                  <Label htmlFor={`promise-subject-${subject}`}>{t(`promisesPage.subjects.${subject}`)}</Label>
                </div>
              ))}
            </RadioGroup>
            {values.subject === 'person' ? (
              <LookupSelect kind="persons" value={values.personId} onChange={(personId) => store.update({ personId })} label={t('promisesPage.subjects.person')} withImages invalid={!!errors.personId} />
            ) : (
              <LookupSelect
                kind="organizations"
                value={values.organizationId}
                onChange={(organizationId) => store.update({ organizationId })}
                label={t('promisesPage.subjects.organization')}
                withImages
                invalid={!!errors.personId}
              />
            )}
            {errors.personId && <p className="text-xs text-destructive">{t('promisesPage.subjectRequired')}</p>}
          </fieldset>
          <FormField id="promise-text" label={t('promisesPage.fields.textMn')} error={errors.textMn} required>
            <Textarea id="promise-text" value={values.textMn} onChange={(event) => store.update({ textMn: event.target.value })} rows={3} maxLength={5000} aria-invalid={!!errors.textMn} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <FormField id="promise-madeOn" label={t('promisesPage.fields.madeOn')} error={errors.madeOn} required>
              <Input id="promise-madeOn" type="date" value={values.madeOn} onChange={(event) => store.update({ madeOn: event.target.value })} aria-invalid={!!errors.madeOn} />
            </FormField>
            <FormField id="promise-source" label={t('form.sourceUrl')} error={errors.sourceUrl} hint={t('promisesPage.sourceHint')} required>
              <Input id="promise-source" type="url" value={values.sourceUrl} onChange={(event) => store.update({ sourceUrl: event.target.value })} placeholder="https://" aria-invalid={!!errors.sourceUrl} />
            </FormField>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('promisesPage.fields.evidence')}</legend>
            {errors.evidence && <p className="text-xs text-destructive">{t('promisesPage.evidenceInvalid')}</p>}
            {values.evidence.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
                <Input value={row.label} onChange={(event) => setEvidence(index, { label: event.target.value })} placeholder={t('promisesPage.evidenceLabel')} aria-label={t('promisesPage.evidenceLabel')} />
                <Input type="url" value={row.url} onChange={(event) => setEvidence(index, { url: event.target.value })} placeholder="https://" aria-label={t('promisesPage.evidenceUrl')} />
                <Input type="date" value={row.date} onChange={(event) => setEvidence(index, { date: event.target.value })} aria-label={t('promisesPage.evidenceDate')} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('promisesPage.evidenceRemove')}
                  onClick={() => store.update({ evidence: store.get().values.evidence.filter((_, i) => i !== index) })}
                >
                  <X aria-hidden />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => store.update({ evidence: [...store.get().values.evidence, { url: '', label: '', date: '' }] })}>
              <Plus aria-hidden />
              {t('promisesPage.evidenceAdd')}
            </Button>
          </fieldset>
        </CardContent>
      </Card>
      <FormLeaveGuard store={store} />
    </form>
  );
}
