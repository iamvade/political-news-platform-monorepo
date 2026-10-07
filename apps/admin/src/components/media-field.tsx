import { useQuery } from '@tanstack/react-query';
import { ImageIcon, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MediaPickerDialog } from '@/components/media-picker-dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { variantUrl } from '@/lib/media';

interface MediaFieldProps {
  value: number | null;
  onChange: (mediaId: number | null) => void;
  disabled?: boolean;
  /** Both purposes require alt text and credit. */
  purpose: 'cover' | 'portrait';
  labels: { choose: string; change: string; remove: string };
}

/** One image from the media library (article cover, person portrait) with a preview and its alt · credit. */
export function MediaField({ value, onChange, disabled, purpose, labels }: MediaFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ['media', value], queryFn: () => api.admin.media.get(value!), enabled: value !== null });
  const media = query.data?.data;
  const url = media ? variantUrl(media, 640) : null;
  const missingMeta = media && (!media.alt || !media.credit);

  return (
    <div className="space-y-2">
      {value !== null && (
        <div className="relative overflow-hidden rounded-md border">
          {url ? (
            <img src={url} alt={media?.alt ?? ''} className={purpose === 'cover' ? 'aspect-video w-full object-cover' : 'aspect-square w-40 object-cover'} />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-muted">
              <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
            </div>
          )}
          {!disabled && (
            <Button type="button" size="icon-sm" variant="secondary" className="absolute top-2 right-2" aria-label={labels.remove} onClick={() => onChange(null)}>
              <X aria-hidden />
            </Button>
          )}
          {media && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {media.alt} · {media.credit}
            </p>
          )}
        </div>
      )}
      {missingMeta && <p className="text-xs text-destructive">{t(purpose === 'cover' ? 'mediaPicker.coverNeedsMeta' : 'mediaPicker.needsMeta')}</p>}
      <Button type="button" variant="outline" size="sm" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        <ImageIcon aria-hidden />
        {value === null ? labels.choose : labels.change}
      </Button>
      <MediaPickerDialog open={open} onOpenChange={setOpen} purpose={purpose} onSelect={(chosen) => onChange(chosen.id)} />
    </div>
  );
}
