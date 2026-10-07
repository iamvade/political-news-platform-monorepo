import { MEDIA_MIME_TYPES, type AdminMedia } from '@news/shared/schemas';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { ImageIcon, LoaderCircle, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { api } from '@/lib/api';
import { thumbnailUrl, variantUrl } from '@/lib/media';
import { notify } from '@/lib/notify';

export type MediaPickerPurpose = 'inline' | 'cover' | 'portrait';

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `cover` and `portrait` require alt text and credit (the API refuses a cover without them: MEDIA_NOT_USABLE). */
  purpose: MediaPickerPurpose;
  onSelect: (media: AdminMedia, extra: { caption: string | null }) => void;
}

const POLL_MS = 1500;

/** Pick a ready image from the library or upload a new one; alt/credit can be fixed before choosing. */
export function MediaPickerDialog({ open, onOpenChange, purpose, onSelect }: MediaPickerDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [alt, setAlt] = useState('');
  const [credit, setCredit] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const list = useQuery({
    queryKey: ['media', 'picker', debouncedSearch],
    queryFn: () => api.admin.media.list({ search: debouncedSearch || undefined, status: 'ready', pageSize: 24 }),
    enabled: open,
  });

  // The selected item, polled while a fresh upload is still being processed.
  const selected = useQuery({
    queryKey: ['media', selectedId],
    queryFn: () => api.admin.media.get(selectedId!),
    enabled: open && selectedId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.data.status;
      return status === 'pending' || status === 'processing' ? POLL_MS : false;
    },
  });
  const media = selected.data?.data;

  function choose(item: AdminMedia) {
    setSelectedId(item.id);
    setAlt(item.alt ?? '');
    setCredit(item.credit ?? '');
    queryClient.setQueryData(['media', item.id], { data: item });
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await api.admin.media.uploadFile(file, { filename: file.name, alt: alt.trim() || undefined, credit: credit.trim() || undefined });
      choose(data);
      void queryClient.invalidateQueries({ queryKey: ['media', 'picker'] });
    } catch (err) {
      notify.apiError(err);
    } finally {
      setUploading(false);
    }
  }

  const needsMeta = purpose !== 'inline' && (!alt.trim() || !credit.trim());
  const ready = media?.status === 'ready';

  async function confirm() {
    if (!media) return;
    setSaving(true);
    try {
      let chosen = media;
      const nextAlt = alt.trim() || null;
      const nextCredit = credit.trim() || null;
      if (nextAlt !== media.alt || nextCredit !== media.credit) {
        chosen = (await api.admin.media.update(media.id, { alt: nextAlt, credit: nextCredit })).data;
        queryClient.setQueryData(['media', chosen.id], { data: chosen });
      }
      onSelect(chosen, { caption: caption.trim() || null });
      setCaption('');
      onOpenChange(false);
    } catch (err) {
      notify.apiError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t(`mediaPicker.titles.${purpose}`)}</DialogTitle>
          <DialogDescription>{t('mediaPicker.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('mediaPicker.search')}
                aria-label={t('mediaPicker.search')}
              />
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? <LoaderCircle className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                {t(uploading ? 'mediaPicker.uploading' : 'mediaPicker.upload')}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept={MEDIA_MIME_TYPES.join(',')}
                className="hidden"
                onChange={upload}
                data-testid="media-upload-input"
              />
            </div>
            <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4" role="listbox" aria-label={t('mediaPicker.library')}>
              {list.data?.data.map((item) => {
                const url = thumbnailUrl(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={item.id === selectedId}
                    aria-label={item.alt ?? item.originalFilename ?? String(item.id)}
                    onClick={() => choose(item)}
                    className={cn(
                      'aspect-square overflow-hidden rounded-md border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      item.id === selectedId && 'ring-2 ring-primary',
                    )}
                  >
                    {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <ImageIcon className="m-auto size-5 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
            {list.data?.data.length === 0 && <p className="text-sm text-muted-foreground">{t('mediaPicker.empty')}</p>}
          </div>

          <div className="space-y-3">
            {media ? (
              <>
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-muted">
                  {ready ? (
                    <img src={variantUrl(media, 640) ?? ''} alt="" className="size-full object-contain" />
                  ) : (
                    <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-hidden />
                  )}
                </div>
                <StatusBadge group="media" value={media.status} />
                <div className="space-y-1.5">
                  <Label htmlFor="media-alt">{t('mediaPicker.alt')}</Label>
                  <Input id="media-alt" value={alt} onChange={(event) => setAlt(event.target.value)} maxLength={500} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="media-credit">{t('mediaPicker.credit')}</Label>
                  <Input id="media-credit" value={credit} onChange={(event) => setCredit(event.target.value)} maxLength={300} />
                </div>
                {purpose === 'inline' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="media-caption">{t('mediaPicker.caption')}</Label>
                    <Input id="media-caption" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={1000} />
                  </div>
                )}
                {needsMeta && <p className="text-sm text-destructive">{t(purpose === 'cover' ? 'mediaPicker.coverNeedsMeta' : 'mediaPicker.needsMeta')}</p>}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('mediaPicker.nothingSelected')}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={confirm} disabled={!media || !ready || needsMeta || saving}>
            {t('mediaPicker.select')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
