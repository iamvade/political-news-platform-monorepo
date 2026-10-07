import { CORRECTION_ENTITY_TYPES, createCorrectionBodySchema, type AdminCorrection, type CorrectionEntityType, type LookupKind } from '@news/shared/schemas';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '@/components/form-dialog';
import { FormField } from '@/components/form-field';
import { LookupSelect } from '@/components/lookup-select';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';
import { todayUb } from '@/lib/dates';
import { schemaFieldErrors } from '@/lib/form-errors';

/** Correction targets that have a picker; the rest are entered by id. */
export const LOOKUP_TARGETS: Partial<Record<CorrectionEntityType, LookupKind>> = { person: 'persons', organization: 'organizations', bill: 'bills' };

interface CorrectionDialogProps {
  correction: AdminCorrection | null;
  /** Fixed target (e.g. the person being edited); hides the type and target fields. */
  target?: { entityType: CorrectionEntityType; entityId: number };
  onClose: () => void;
}

export function CorrectionDialog({ correction, target, onClose }: CorrectionDialogProps) {
  const { t } = useTranslation();
  const [entityType, setEntityType] = useState<CorrectionEntityType>(correction?.entityType ?? target?.entityType ?? 'person');
  const [entityId, setEntityId] = useState<number | null>(correction?.entityId ?? target?.entityId ?? null);
  const [date, setDate] = useState(correction?.date ?? todayUb());
  const [description, setDescription] = useState(correction?.description ?? '');
  const [reason, setReason] = useState(correction?.reason ?? '');
  const save = useSaveRecord(
    (body: ReturnType<typeof bodyOf>) => (correction ? api.admin.corrections.update(correction.id, body) : api.admin.corrections.create(body)),
    { invalidate: [['corrections']], onSaved: onClose },
  );
  const errors = save.errors;
  const lookupKind = LOOKUP_TARGETS[entityType];

  function bodyOf() {
    return { entityType, entityId: entityId ?? 0, date, description: description.trim(), reason: reason.trim() };
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(correction ? 'corrections.editTitle' : 'corrections.newTitle')}
      submitting={save.pending}
      onSubmit={() => {
        const body = bodyOf();
        save.submit(body, schemaFieldErrors(createCorrectionBodySchema.safeParse(body)));
      }}
    >
      {!target && (
        <>
          <FormField id="correction-type" label={t('corrections.fields.entityType')} required>
            <Select
              value={entityType}
              onValueChange={(value) => {
                setEntityType(value as CorrectionEntityType);
                setEntityId(null);
              }}
            >
              <SelectTrigger id="correction-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CORRECTION_ENTITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`status.correctionEntity.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="correction-target" label={t('corrections.fields.target')} error={errors.entityId} required>
            {lookupKind ? (
              <LookupSelect
                id="correction-target"
                kind={lookupKind}
                value={entityId}
                onChange={(id) => setEntityId(id)}
                label={t('corrections.fields.target')}
                invalid={!!errors.entityId}
              />
            ) : (
              <Input
                id="correction-target"
                inputMode="numeric"
                value={entityId ?? ''}
                onChange={(event) => setEntityId(/^\d+$/.test(event.target.value) ? Number(event.target.value) : null)}
                placeholder={t('corrections.idPlaceholder')}
                aria-invalid={!!errors.entityId}
              />
            )}
          </FormField>
        </>
      )}
      <FormField id="correction-date" label={t('corrections.fields.date')} error={errors.date} required>
        <Input id="correction-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={!!errors.date} />
      </FormField>
      <FormField id="correction-description" label={t('corrections.fields.description')} error={errors.description} required>
        <Textarea
          id="correction-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
          aria-invalid={!!errors.description}
        />
      </FormField>
      <FormField id="correction-reason" label={t('corrections.fields.reason')} error={errors.reason} required>
        <Input id="correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} aria-invalid={!!errors.reason} />
      </FormField>
    </FormDialog>
  );
}
