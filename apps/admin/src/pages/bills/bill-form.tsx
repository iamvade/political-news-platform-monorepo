import { BILL_INITIATORS, BILL_STATUSES, createBillBodySchema, type AdminBill, type BillInitiator, type BillStatus, type CreateBillBody } from '@news/shared/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { FormField } from '@/components/form-field';
import { FormLeaveGuard } from '@/components/form-leave-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';
import { orNull, schemaFieldErrors } from '@/lib/form-errors';
import { createFormStore, isFormDirty, useFormState } from '@/lib/form-store';

interface BillValues {
  titleMn: string;
  titleEn: string;
  registrationNumber: string;
  initiatorType: BillInitiator;
  status: BillStatus;
  submittedOn: string;
  sourceUrl: string;
}

function valuesOf(bill: AdminBill | null): BillValues {
  return {
    titleMn: bill?.titleMn ?? '',
    titleEn: bill?.titleEn ?? '',
    registrationNumber: bill?.registrationNumber ?? '',
    initiatorType: bill?.initiatorType ?? 'government',
    status: bill?.status ?? 'submitted',
    submittedOn: bill?.submittedOn ?? '',
    sourceUrl: bill?.sourceUrl ?? '',
  };
}

function bodyOf(values: BillValues): CreateBillBody {
  return {
    titleMn: values.titleMn.trim(),
    titleEn: orNull(values.titleEn),
    registrationNumber: orNull(values.registrationNumber),
    initiatorType: values.initiatorType,
    status: values.status,
    submittedOn: values.submittedOn || null,
    sourceUrl: values.sourceUrl.trim(),
  };
}

/** Bill fields (create when `bill` is null). Status is set here; stages below record the dated history. */
export function BillForm({ bill }: { bill: AdminBill | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [store] = useState(() => createFormStore(valuesOf(bill)));
  const state = useFormState(store);
  const { values } = state;
  const sentVersion = useRef(0);
  const save = useSaveRecord((body: CreateBillBody) => (bill ? api.admin.bills.update(bill.id, body) : api.admin.bills.create(body)), {
    invalidate: [['bills']],
    successMessage: t(bill ? 'form.saved' : 'form.created'),
    onSaved: ({ data }) => {
      store.markSaved(sentVersion.current);
      queryClient.setQueryData(['bill', data.id], { data });
      if (!bill) void navigate(`/bills/${data.id}`, { replace: true });
    },
  });
  const errors = save.errors;

  function submit() {
    const body = bodyOf(store.get().values);
    sentVersion.current = store.get().version;
    save.submit(body, schemaFieldErrors(createBillBodySchema.safeParse(body)));
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
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label={t('bills.back')}>
            <Link to="/bills">
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
          <h1 className="truncate text-xl font-semibold tracking-tight">{bill ? bill.titleMn : t('bills.newTitle')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground" role="status">
            {isFormDirty(state) ? t('form.status.unsaved') : bill ? t('form.status.saved') : ''}
          </span>
          <Button type="submit" size="sm" disabled={save.pending || (bill !== null && !isFormDirty(state))}>
            <Save aria-hidden />
            {t('form.save')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField id="bill-titleMn" label={t('bills.fields.titleMn')} error={errors.titleMn} required>
              <Input id="bill-titleMn" value={values.titleMn} onChange={(event) => store.update({ titleMn: event.target.value })} maxLength={500} aria-invalid={!!errors.titleMn} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField id="bill-titleEn" label={t('bills.fields.titleEn')} error={errors.titleEn}>
              <Input id="bill-titleEn" value={values.titleEn} onChange={(event) => store.update({ titleEn: event.target.value })} maxLength={500} />
            </FormField>
          </div>
          <FormField id="bill-registrationNumber" label={t('bills.fields.registrationNumber')} error={errors.registrationNumber}>
            <Input id="bill-registrationNumber" value={values.registrationNumber} onChange={(event) => store.update({ registrationNumber: event.target.value })} maxLength={100} />
          </FormField>
          <FormField id="bill-submittedOn" label={t('bills.fields.submittedOn')} error={errors.submittedOn}>
            <Input id="bill-submittedOn" type="date" value={values.submittedOn} onChange={(event) => store.update({ submittedOn: event.target.value })} />
          </FormField>
          <FormField id="bill-initiatorType" label={t('bills.fields.initiatorType')} required>
            <Select value={values.initiatorType} onValueChange={(value) => store.update({ initiatorType: value as BillInitiator })}>
              <SelectTrigger id="bill-initiatorType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILL_INITIATORS.map((initiator) => (
                  <SelectItem key={initiator} value={initiator}>
                    {t(`status.billInitiator.${initiator}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="bill-status" label={t('bills.fields.status')} required>
            <Select value={values.status} onValueChange={(value) => store.update({ status: value as BillStatus })}>
              <SelectTrigger id="bill-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILL_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.bill.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="bill-sourceUrl" label={t('form.sourceUrl')} error={errors.sourceUrl} hint={t('bills.sourceHint')} required>
              <Input id="bill-sourceUrl" type="url" value={values.sourceUrl} onChange={(event) => store.update({ sourceUrl: event.target.value })} placeholder="https://" aria-invalid={!!errors.sourceUrl} />
            </FormField>
          </div>
        </CardContent>
      </Card>
      <FormLeaveGuard store={store} />
    </form>
  );
}
