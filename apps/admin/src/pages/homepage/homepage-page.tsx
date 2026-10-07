import { isApiError } from '@news/shared/api-client';
import { HOMEPAGE_FEATURED_SLOTS, type AdminHomepage, type ArticleSummary, type HomepageZones } from '@news/shared/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { ArrowDown, ArrowUp, GripVertical, History, Save, TriangleAlert, X } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FormLeaveGuard } from '@/components/form-leave-guard';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { createFormStore, isFormDirty, useFormState, type FormStore } from '@/lib/form-store';
import { errorMessage, notify } from '@/lib/notify';
import { useSession } from '@/lib/session';
import { ArticlePickerDialog } from './article-picker-dialog';

/** `list` with the item at `from` moved to `to`. */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** `/homepage`: hero, featured slots and the order of category sections. Saving makes a new live version. */
export function HomepagePage() {
  const { t } = useTranslation();
  const [generation, setGeneration] = useState(0);
  const query = useQuery({ queryKey: ['homepage'], queryFn: () => api.homepage.get(), staleTime: Infinity, refetchOnWindowFocus: false });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-destructive">{errorMessage(query.error)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t('table.retry')}
        </Button>
      </div>
    );
  }
  return (
    <HomepageEditor
      key={`${query.data.data.version}:${generation}`}
      homepage={query.data.data}
      onReload={async () => {
        await query.refetch();
        setGeneration((n) => n + 1);
      }}
    />
  );
}

function HomepageEditor({ homepage, onReload }: { homepage: AdminHomepage; onReload: () => Promise<void> }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [store] = useState(() => createFormStore<HomepageZones>(homepage.zones));
  const state = useFormState(store);
  const zones = state.values;
  const [version, setVersion] = useState(homepage.version);
  const [known, setKnown] = useState(() => new Map(homepage.articles.map((article) => [article.id, article])));
  const [picking, setPicking] = useState<'hero' | 'featured' | null>(null);
  const [conflict, setConflict] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const categories = useQuery({ queryKey: ['lookup', 'categories', 'all'], queryFn: () => api.lookup.search('categories', { limit: 50 }), staleTime: 5 * 60_000 });
  const categoryName = (id: number) =>
    categories.data?.data.find((c) => c.id === id)?.label ?? homepage.categories.find((c) => c.id === id)?.nameMn ?? `#${id}`;
  const usedIds = [...(zones.heroArticleId ? [zones.heroArticleId] : []), ...zones.featuredArticleIds];
  const unpublished = usedIds.filter((id) => known.get(id) && known.get(id)!.status !== 'published');

  const save = useMutation({ mutationFn: (body: Parameters<typeof api.homepage.save>[0]) => api.homepage.save(body) });

  async function submit() {
    const sent = store.get();
    try {
      const { data } = await save.mutateAsync({ zones: sent.values, expectedVersion: version });
      store.markSaved(sent.version);
      setVersion(data.version);
      queryClient.setQueryData(['homepage'], { data });
      notify.success(t('homepage.saved'));
    } catch (err) {
      if (isApiError(err) && err.code === 'EDIT_CONFLICT') setConflict(true);
      else notify.apiError(err);
    }
  }

  function remember(article: ArticleSummary) {
    setKnown((map) => new Map(map).set(article.id, article));
  }

  async function loadVersion(next: HomepageZones) {
    const missing = [next.heroArticleId, ...next.featuredArticleIds].filter((id): id is number => id !== null && !known.has(id));
    try {
      const fetched = await Promise.all(missing.map((id) => api.articles.get(id)));
      setKnown((map) => {
        const copy = new Map(map);
        for (const { data } of fetched) copy.set(data.id, data);
        return copy;
      });
    } catch {
      // Labels fall back to "#id"; the API validates the pins on save anyway.
    }
    store.update(next);
    setVersionsOpen(false);
    notify.info(t('homepage.versions.loaded'));
  }

  const articleCard = (id: number, actions: ReactNode) => {
    const article = known.get(id);
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{article?.title ?? `#${id}`}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {article && <StatusBadge group="article" value={article.status} />}
            {article?.publishedAt && <span>{formatDateTime(article.publishedAt)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">{actions}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pages.homepage.title')}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" role="status">
              {isFormDirty(state)
                ? t('form.status.unsaved')
                : version
                  ? t('homepage.liveVersion', { version, date: formatDateTime(homepage.createdAt) })
                  : t('homepage.neverSaved')}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setVersionsOpen(true)}>
              <History aria-hidden />
              {t('homepage.versions.open')}
            </Button>
            <Button type="button" size="sm" onClick={() => void submit()} disabled={!isFormDirty(state) || save.isPending || conflict}>
              <Save aria-hidden />
              {t('homepage.save')}
            </Button>
          </div>
        }
      />

      {conflict && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>{t('homepage.conflict.title')}</AlertTitle>
          <AlertDescription>{t('homepage.conflict.description')}</AlertDescription>
          <AlertAction>
            <Button type="button" size="sm" variant="outline" onClick={() => void onReload()}>
              {t('homepage.conflict.reload')}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {unpublished.length > 0 && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle>{t('homepage.unpublished.title')}</AlertTitle>
          <AlertDescription>{t('homepage.unpublished.description')}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('homepage.hero.title')}</CardTitle>
            <CardDescription>{t('homepage.hero.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {zones.heroArticleId ? (
              articleCard(
                zones.heroArticleId,
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPicking('hero')}>
                    {t('homepage.change')}
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={t('homepage.hero.remove')} onClick={() => store.update({ heroArticleId: null })}>
                    <X aria-hidden />
                  </Button>
                </>,
              )
            ) : (
              <EmptySlot label={t('homepage.hero.empty')} action={t('homepage.hero.choose')} onClick={() => setPicking('hero')} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('homepage.featured.title')}</CardTitle>
            <CardDescription>{t('homepage.featured.description', { count: HOMEPAGE_FEATURED_SLOTS })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2" aria-label={t('homepage.featured.title')}>
              {zones.featuredArticleIds.map((id, index) => (
                <li key={id}>
                  {articleCard(
                    id,
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t('homepage.moveUp', { name: known.get(id)?.title ?? `#${id}` })}
                        disabled={index === 0}
                        onClick={() => store.update({ featuredArticleIds: move(zones.featuredArticleIds, index, index - 1) })}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t('homepage.moveDown', { name: known.get(id)?.title ?? `#${id}` })}
                        disabled={index === zones.featuredArticleIds.length - 1}
                        onClick={() => store.update({ featuredArticleIds: move(zones.featuredArticleIds, index, index + 1) })}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t('homepage.remove', { name: known.get(id)?.title ?? `#${id}` })}
                        onClick={() => store.update({ featuredArticleIds: zones.featuredArticleIds.filter((other) => other !== id) })}
                      >
                        <X aria-hidden />
                      </Button>
                    </>,
                  )}
                </li>
              ))}
              {zones.featuredArticleIds.length < HOMEPAGE_FEATURED_SLOTS && (
                <li>
                  <EmptySlot label={t('homepage.featured.empty')} action={t('homepage.featured.add')} onClick={() => setPicking('featured')} />
                </li>
              )}
            </ol>
          </CardContent>
        </Card>
      </div>

      <SectionsCard store={store} zones={zones} categoryName={categoryName} options={categories.data?.data ?? []} />

      <ArticlePickerDialog
        open={picking !== null}
        onOpenChange={(open) => !open && setPicking(null)}
        usedIds={usedIds}
        onSelect={(article) => {
          remember(article);
          if (picking === 'hero') store.update({ heroArticleId: article.id });
          else store.update({ featuredArticleIds: [...store.get().values.featuredArticleIds, article.id] });
        }}
      />
      <VersionsSheet open={versionsOpen} onOpenChange={setVersionsOpen} current={version} onLoad={(next) => void loadVersion(next)} />
      <FormLeaveGuard store={store} />
    </div>
  );
}

function EmptySlot({ label, action, onClick }: { label: string; action: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
      <span>{label}</span>
      <Button type="button" size="sm" variant="outline" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}

interface SectionsCardProps {
  store: FormStore<HomepageZones>;
  zones: HomepageZones;
  categoryName: (id: number) => string;
  options: { id: number; label: string }[];
}

/** Category rails in display order: native drag and drop, plus up/down buttons for keyboard users. */
function SectionsCard({ store, zones, categoryName, options }: SectionsCardProps) {
  const { t } = useTranslation();
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const sections = zones.sectionCategoryIds;
  const setSections = (sectionCategoryIds: number[]) => store.update({ sectionCategoryIds });
  const available = options.filter((option) => !sections.includes(option.id));

  const dragProps = (index: number) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      dragFrom.current = index;
      event.dataTransfer?.setData('text/plain', String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      setOver(index);
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (dragFrom.current !== null) setSections(move(sections, dragFrom.current, index));
      dragFrom.current = null;
      setOver(null);
    },
    onDragEnd: () => {
      dragFrom.current = null;
      setOver(null);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('homepage.sections.title')}</CardTitle>
        <CardDescription>{t('homepage.sections.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sections.length === 0 && <p className="text-sm text-muted-foreground">{t('homepage.sections.empty')}</p>}
        <ol className="space-y-2" aria-label={t('homepage.sections.title')}>
          {sections.map((id, index) => {
            const name = categoryName(id);
            return (
              <li
                key={id}
                {...dragProps(index)}
                data-testid={`section-${id}`}
                className={cn('flex items-center gap-2 rounded-md border bg-background p-2', over === index && 'border-primary')}
              >
                <GripVertical className="size-4 cursor-grab text-muted-foreground" aria-hidden />
                <span className="w-6 text-sm text-muted-foreground tabular-nums">{index + 1}.</span>
                <span className="flex-1 font-medium">{name}</span>
                <Button type="button" size="icon-sm" variant="ghost" aria-label={t('homepage.moveUp', { name })} disabled={index === 0} onClick={() => setSections(move(sections, index, index - 1))}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('homepage.moveDown', { name })}
                  disabled={index === sections.length - 1}
                  onClick={() => setSections(move(sections, index, index + 1))}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label={t('homepage.remove', { name })} onClick={() => setSections(sections.filter((other) => other !== id))}>
                  <X aria-hidden />
                </Button>
              </li>
            );
          })}
        </ol>
        {available.length > 0 && (
          <Select value="" onValueChange={(value) => setSections([...sections, Number(value)])}>
            <SelectTrigger className="w-64" aria-label={t('homepage.sections.add')}>
              <SelectValue placeholder={t('homepage.sections.add')} />
            </SelectTrigger>
            <SelectContent>
              {available.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}

function VersionsSheet({
  open,
  onOpenChange,
  current,
  onLoad,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: number | null;
  onLoad: (zones: HomepageZones) => void;
}) {
  const { t } = useTranslation();
  const { user } = useSession();
  const versions = useQuery({ queryKey: ['homepage', 'versions'], queryFn: () => api.homepage.versions({ pageSize: 50 }), enabled: open, refetchOnMount: 'always' });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('homepage.versions.title')}</SheetTitle>
          <SheetDescription>{t('homepage.versions.description')}</SheetDescription>
        </SheetHeader>
        <ul className="divide-y px-4" aria-label={t('homepage.versions.title')}>
          {versions.data?.data.map((entry) => (
            <li key={entry.version} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">
                  #{entry.version}
                  {entry.version === current && <span className="ml-2 text-xs text-muted-foreground">{t('homepage.versions.live')}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(entry.createdAt)} · {entry.createdBy === user?.id ? t('revision.you') : t('revision.editor', { id: entry.createdBy })}
                </p>
              </div>
              {entry.version !== current && (
                <Button type="button" size="sm" variant="outline" onClick={() => onLoad(entry.zones)}>
                  {t('homepage.versions.load')}
                </Button>
              )}
            </li>
          ))}
          {versions.isSuccess && versions.data.data.length === 0 && <li className="py-2 text-sm text-muted-foreground">{t('homepage.versions.empty')}</li>}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
