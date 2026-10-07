import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ALLOWED_LINK } from './extensions';

export interface LinkValue {
  href: string;
  newTab: boolean;
}

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LinkValue | null;
  onSubmit: (value: LinkValue) => void;
  onRemove: () => void;
}

export function LinkDialog({ open, onOpenChange, initial, onSubmit, onRemove }: LinkDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed so the form resets each time the dialog opens. */}
        {open && <LinkForm key={initial?.href ?? ''} initial={initial} onSubmit={onSubmit} onRemove={onRemove} title={t('editor.link.title')} />}
      </DialogContent>
    </Dialog>
  );
}

function LinkForm({ initial, onSubmit, onRemove, title }: Omit<LinkDialogProps, 'open' | 'onOpenChange'> & { title: string }) {
  const { t } = useTranslation();
  const [href, setHref] = useState(initial?.href ?? '');
  const [newTab, setNewTab] = useState(initial?.newTab ?? true);
  const valid = ALLOWED_LINK.test(href.trim());

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSubmit({ href: href.trim(), newTab });
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="link-href">{t('editor.link.url')}</Label>
        <Input id="link-href" value={href} onChange={(event) => setHref(event.target.value)} placeholder="https://" autoFocus />
        {href.trim() !== '' && !valid && <p className="text-sm text-destructive">{t('editor.link.invalid')}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Switch id="link-new-tab" checked={newTab} onCheckedChange={setNewTab} />
        <Label htmlFor="link-new-tab">{t('editor.link.newTab')}</Label>
      </div>
      <DialogFooter>
        {initial && (
          <Button type="button" variant="outline" onClick={onRemove}>
            {t('editor.link.remove')}
          </Button>
        )}
        <Button type="submit" disabled={!valid}>
          {t('editor.link.apply')}
        </Button>
      </DialogFooter>
    </form>
  );
}
