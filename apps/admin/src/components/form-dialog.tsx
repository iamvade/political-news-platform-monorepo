import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: () => void;
  /** Rendered only while open, so a form component inside starts fresh each time. */
  children: ReactNode;
  wide?: boolean;
}

/** A dialog that is one form: title, fields, cancel + submit. */
export function FormDialog({ open, onOpenChange, title, description, submitLabel, submitting, onSubmit, children, wide }: FormDialogProps) {
  const { t } = useTranslation();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}>
        {open && (
          <form className="space-y-4" onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <div className="space-y-3">{children}</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('form.cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitLabel ?? t('form.save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
