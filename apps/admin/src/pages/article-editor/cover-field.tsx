import { useQuery } from '@tanstack/react-query';
import { ImageIcon, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MediaPickerDialog } from '@/components/media-picker-dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { variantUrl } from '@/lib/media';

interface CoverFieldProps {
  value: number | null;
  onChange: (mediaId: number | null) => void;
  disabled?: boolean;
}

/** Cover image: chosen from the media library; alt text and credit are required (API: MEDIA_NOT_USABLE). */
export function CoverField({ value, onChange, disabled }: CoverFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cover = useQuery({ queryKey: ['media', value], queryFn: () => api.admin.media.get(value!), enabled: value !== null });
  const media = cover.data?.data;
  const url = media ? variantUrl(media, 640) : null;
  const missingMeta = media && (!media.alt || !media.credit);

  return (
    <div className="space-y-2">
      {value !== null && (
        <div className="relative overflow-hidden rounded-md border">
          {url ? (
            <img src={url} alt={media?.alt ?? ''} className="aspect-video w-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-muted">
              <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
            </div>
          )}
          {!disabled && (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="absolute top-2 right-2"
              aria-label={t('editor.cover.remove')}
              onClick={() => onChange(null)}
            >
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
      {missingMeta && <p className="text-xs text-destructive">{t('mediaPicker.coverNeedsMeta')}</p>}
      <Button type="button" variant="outline" size="sm" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        <ImageIcon aria-hidden />
        {t(value === null ? 'editor.cover.choose' : 'editor.cover.change')}
      </Button>
      <MediaPickerDialog open={open} onOpenChange={setOpen} purpose="cover" onSelect={(chosen) => onChange(chosen.id)} />
    </div>
  );
}
