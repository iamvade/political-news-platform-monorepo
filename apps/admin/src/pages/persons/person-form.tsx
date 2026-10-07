import { GENDERS, createPersonBodySchema, type AdminPerson, type CreatePersonBody } from '@news/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { FormLeaveGuard } from '@/components/form-leave-guard';
import { MediaField } from '@/components/media-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';
import { orNull, schemaFieldErrors } from '@/lib/form-errors';
import { createFormStore, isFormDirty, useFormState } from '@/lib/form-store';
import { notify } from '@/lib/notify';

const NO_GENDER = 'none';

interface PersonValues {
  givenNameMn: string;
  patronymicMn: string;
  givenNameEn: string;
  patronymicEn: string;
  birthDate: string;
  gender: string;
  photoMediaId: number | null;
  bioMn: string;
}

function valuesOf(person: AdminPerson | null): PersonValues {
  return {
    givenNameMn: person?.givenNameMn ?? '',
    patronymicMn: person?.patronymicMn ?? '',
    givenNameEn: person?.givenNameEn ?? '',
    patronymicEn: person?.patronymicEn ?? '',
    birthDate: person?.birthDate ?? '',
    gender: person?.gender ?? '',
    photoMediaId: person?.photoMediaId ?? null,
    bioMn: person?.bioMn ?? '',
  };
}

function bodyOf(values: PersonValues): CreatePersonBody {
  return {
    givenNameMn: values.givenNameMn.trim(),
    patronymicMn: values.patronymicMn.trim(),
    givenNameEn: orNull(values.givenNameEn),
    patronymicEn: orNull(values.patronymicEn),
    birthDate: values.birthDate || null,
    gender: (values.gender || null) as CreatePersonBody['gender'],
    photoMediaId: values.photoMediaId,
    bioMn: orNull(values.bioMn),
  };
}

/** Profile fields of a person (create when `person` is null). The slug is generated and not editable here. */
export function PersonForm({ person }: { person: AdminPerson | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [store] = useState(() => createFormStore(valuesOf(person)));
  const state = useFormState(store);
  const { values } = state;
  const sentVersion = useRef(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useSaveRecord((body: CreatePersonBody) => (person ? api.admin.persons.update(person.id, body) : api.admin.persons.create(body)), {
    invalidate: [['persons']],
    successMessage: t(person ? 'form.saved' : 'form.created'),
    onSaved: ({ data }) => {
      store.markSaved(sentVersion.current);
      queryClient.setQueryData(['person', data.id], { data });
      if (!person) void navigate(`/persons/${data.id}`, { replace: true });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.admin.persons.remove(person!.id),
    onSuccess: () => {
      store.reset(store.get().values); // nothing left to protect
      void queryClient.invalidateQueries({ queryKey: ['persons'] });
      notify.success(t('form.deleted'));
      void navigate('/persons');
    },
    onError: (err) => notify.apiError(err),
  });
  const errors = save.errors;

  function submit() {
    const body = bodyOf(store.get().values);
    sentVersion.current = store.get().version;
    save.submit(body, schemaFieldErrors(createPersonBodySchema.safeParse(body)));
  }

  const text = (field: 'givenNameMn' | 'patronymicMn' | 'givenNameEn' | 'patronymicEn', label: string, required = false) => (
    <FormField id={`person-${field}`} label={label} error={errors[field]} required={required}>
      <Input id={`person-${field}`} value={values[field]} onChange={(event) => store.update({ [field]: event.target.value })} maxLength={200} aria-invalid={!!errors[field]} />
    </FormField>
  );

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
          <Button asChild variant="ghost" size="icon-sm" aria-label={t('persons.back')}>
            <Link to="/persons">
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{person ? person.displayName : t('persons.newTitle')}</h1>
          {person && <code className="text-xs text-muted-foreground">{person.slug}</code>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground" role="status">
            {isFormDirty(state) ? t('form.status.unsaved') : person ? t('form.status.saved') : ''}
          </span>
          {person && (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
              {t('form.delete')}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={save.pending || (person !== null && !isFormDirty(state))}>
            <Save aria-hidden />
            {t('form.save')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_12rem]">
          <div className="grid gap-4 sm:grid-cols-2">
            {text('patronymicMn', t('persons.fields.patronymicMn'), true)}
            {text('givenNameMn', t('persons.fields.givenNameMn'), true)}
            {text('patronymicEn', t('persons.fields.patronymicEn'))}
            {text('givenNameEn', t('persons.fields.givenNameEn'))}
            <FormField id="person-birthDate" label={t('persons.fields.birthDate')} error={errors.birthDate}>
              <Input id="person-birthDate" type="date" value={values.birthDate} onChange={(event) => store.update({ birthDate: event.target.value })} />
            </FormField>
            <FormField id="person-gender" label={t('persons.fields.gender')}>
              <Select value={values.gender || NO_GENDER} onValueChange={(value) => store.update({ gender: value === NO_GENDER ? '' : value })}>
                <SelectTrigger id="person-gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GENDER}>{t('form.none')}</SelectItem>
                  {GENDERS.map((gender) => (
                    <SelectItem key={gender} value={gender}>
                      {t(`status.gender.${gender}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="sm:col-span-2">
              <FormField id="person-bioMn" label={t('persons.fields.bioMn')} error={errors.bioMn}>
                <Textarea id="person-bioMn" value={values.bioMn} onChange={(event) => store.update({ bioMn: event.target.value })} rows={5} maxLength={10_000} />
              </FormField>
            </div>
          </div>
          <FormField id="person-photo" label={t('persons.fields.photo')}>
            <MediaField
              value={values.photoMediaId}
              onChange={(photoMediaId) => store.update({ photoMediaId })}
              purpose="portrait"
              labels={{ choose: t('persons.photo.choose'), change: t('persons.photo.change'), remove: t('persons.photo.remove') }}
            />
          </FormField>
        </CardContent>
      </Card>

      <FormLeaveGuard store={store} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('persons.deleteTitle')}
        description={t('persons.deleteDescription')}
        confirmLabel={t('form.delete')}
        destructive
        onConfirm={() => remove.mutate()}
      />
    </form>
  );
}
