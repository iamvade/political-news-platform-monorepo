import type { ArticleSummary } from '@news/shared/schemas';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface ArticlePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already placed on the page (shown disabled). */
  usedIds: number[];
  onSelect: (article: ArticleSummary) => void;
}

/** Search published articles to pin on the homepage. */
export function ArticlePickerDialog({ open, onOpenChange, usedIds, onSelect }: ArticlePickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const results = useQuery({
    queryKey: ['articles', 'homepage-picker', debounced],
    queryFn: () => api.articles.list({ status: 'published', search: debounced || undefined, pageSize: 20 }),
    enabled: open,
  });
  const articles = results.data?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('homepage.picker.title')}</DialogTitle>
          <DialogDescription>{t('homepage.picker.description')}</DialogDescription>
        </DialogHeader>
        <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('homepage.picker.search')} aria-label={t('homepage.picker.search')} autoFocus />
        <ul className="max-h-96 divide-y overflow-y-auto" aria-label={t('homepage.picker.results')}>
          {articles.map((article) => {
            const used = usedIds.includes(article.id);
            return (
              <li key={article.id}>
                <button
                  type="button"
                  disabled={used}
                  onClick={() => {
                    onSelect(article);
                    onOpenChange(false);
                  }}
                  className="w-full px-2 py-2 text-left hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="block font-medium">{article.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(article.publishedAt)}
                    {used && ` · ${t('homepage.picker.used')}`}
                  </span>
                </button>
              </li>
            );
          })}
          {results.isSuccess && articles.length === 0 && <li className="py-2 text-sm text-muted-foreground">{t('homepage.picker.empty')}</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
