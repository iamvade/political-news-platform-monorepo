import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { notify } from '@/lib/notify';

interface Options<R> {
  /** Query key prefixes to refetch after a successful save. */
  invalidate: QueryKey[];
  onSaved?: (result: R) => void;
  successMessage?: string;
}

/**
 * Create/update/delete one record through the API: field errors from VALIDATION_ERROR land in `errors`,
 * any other error is a toast; on success the given queries refetch.
 */
export function useSaveRecord<V, R>(save: (vars: V) => Promise<R>, { invalidate, onSaved, successMessage }: Options<R>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useMutation({
    mutationFn: save,
    onSuccess: (result) => {
      for (const queryKey of invalidate) void queryClient.invalidateQueries({ queryKey });
      setErrors({});
      notify.success(successMessage ?? t('form.saved'));
      onSaved?.(result);
    },
    onError: (err) => {
      const fields = apiFieldErrors(err);
      setErrors(fields);
      notify.apiError(err);
    },
  });

  /** Runs the save unless `localErrors` (from a schema check) has entries. */
  const submit = (vars: V, localErrors: FieldErrors = {}) => {
    setErrors(localErrors);
    if (Object.keys(localErrors).length === 0) mutation.mutate(vars);
  };

  return { submit, pending: mutation.isPending, errors };
}
