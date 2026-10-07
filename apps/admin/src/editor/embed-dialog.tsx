import { parseEmbedUrl, type ParsedEmbed } from '@news/shared/content';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (embed: ParsedEmbed) => void;
}

/** Paste a YouTube or Facebook URL; only URLs `parseEmbedUrl` recognises can be inserted. */
export function EmbedDialog({ open, onOpenChange, onSubmit }: EmbedDialogProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const parsed = url.trim() ? parseEmbedUrl(url) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setUrl('');
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!parsed) return;
            onSubmit(parsed);
            setUrl('');
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('editor.embed.title')}</DialogTitle>
            <DialogDescription>{t('editor.embed.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="embed-url">{t('editor.embed.url')}</Label>
            <Input id="embed-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" autoFocus />
            {url.trim() !== '' &&
              (parsed ? (
                <p className="text-sm text-muted-foreground">{t('editor.embed.detected', { provider: t(`editor.embed.providers.${parsed.provider}`) })}</p>
              ) : (
                <p className="text-sm text-destructive">{t('editor.embed.unsupported')}</p>
              ))}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!parsed}>
              {t('editor.embed.insert')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
