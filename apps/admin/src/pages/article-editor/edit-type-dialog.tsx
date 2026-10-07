import type { ArticleEdit } from '@news/shared/schemas';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

function EditTypeForm({ onDone }: { onDone: (edit: ArticleEdit | null) => void }) {
  const { t } = useTranslation();
  const [type, setType] = useState<ArticleEdit['type']>('minor');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const valid = type === 'minor' || (description.trim() !== '' && reason.trim() !== '');

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onDone(type === 'minor' ? { type } : { type, correction: { description: description.trim(), reason: reason.trim() } });
      }}
    >
      <DialogHeader>
        <DialogTitle>{t('editor.editType.title')}</DialogTitle>
        <DialogDescription>{t('editor.editType.description')}</DialogDescription>
      </DialogHeader>
      <RadioGroup value={type} onValueChange={(value) => setType(value as ArticleEdit['type'])}>
        <div className="flex items-start gap-2">
          <RadioGroupItem value="minor" id="edit-minor" />
          <Label htmlFor="edit-minor" className="flex-col items-start gap-0.5">
            <span>{t('editor.editType.minor')}</span>
            <span className="text-xs font-normal text-muted-foreground">{t('editor.editType.minorHint')}</span>
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem value="substantive" id="edit-substantive" />
          <Label htmlFor="edit-substantive" className="flex-col items-start gap-0.5">
            <span>{t('editor.editType.substantive')}</span>
            <span className="text-xs font-normal text-muted-foreground">{t('editor.editType.substantiveHint')}</span>
          </Label>
        </div>
      </RadioGroup>
      {type === 'substantive' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="correction-description">{t('editor.editType.correctionDescription')}</Label>
            <Textarea id="correction-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="correction-reason">{t('editor.editType.correctionReason')}</Label>
            <Input id="correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
          </div>
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t('editor.editType.confirm')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Edits to a published article must say whether they are minor or substantive (a substantive edit adds an
 * entry to the public corrections log). `ask()` resolves with the answer, or null when cancelled.
 */
export function useEditTypeDialog() {
  const [resolver, setResolver] = useState<((edit: ArticleEdit | null) => void) | null>(null);

  const ask = useCallback(() => new Promise<ArticleEdit | null>((resolve) => setResolver(() => resolve)), []);

  const finish = (edit: ArticleEdit | null) => {
    resolver?.(edit);
    setResolver(null);
  };

  const element = (
    <Dialog open={resolver !== null} onOpenChange={(open) => !open && finish(null)}>
      <DialogContent>{resolver && <EditTypeForm onDone={finish} />}</DialogContent>
    </Dialog>
  );

  return { ask, element };
}
