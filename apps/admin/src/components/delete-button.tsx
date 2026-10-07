import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';

interface DeleteButtonProps {
  /** Accessible label, e.g. "Албан тушаал устгах". */
  label: string;
  description?: string;
  onConfirm: () => void;
  disabled?: boolean;
}

/** Icon button + confirmation. Render it only for roles the API allows to delete. */
export function DeleteButton({ label, description, onConfirm, disabled }: DeleteButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} disabled={disabled} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('form.deleteTitle')}
        description={description ?? t('form.deleteDescription')}
        confirmLabel={t('form.delete')}
        destructive
        onConfirm={onConfirm}
      />
    </>
  );
}
