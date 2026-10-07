import { VOTE_VALUES, sourceUrlSchema, type ImportResult, type VoteImportRow, type VoteRoster, type VoteValue } from '@news/shared/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { FormLeaveGuard } from '@/components/form-leave-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { todayUb } from '@/lib/dates';
import { formatDate } from '@/lib/format';
import { createFormStore, isFormDirty, useFormState } from '@/lib/form-store';
import { notify } from '@/lib/notify';
import { NotFoundPage } from '@/pages/status-pages';
import { parseId } from './bill-page';
import { voteGridPath } from './vote-sessions-section';

/** Motions offered when starting a new roll call (free text is allowed too). */
const COMMON_MOTIONS = ['consideration', 'first_reading', 'final_vote'];

/** `/bills/:id/votes?date=&motion=`: one row per MP serving on that date, saved through the votes import. */
export function VoteGridPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const billId = parseId(id);
  const [params] = useSearchParams();
  const date = params.get('date');
  const motion = params.get('motion');
  const bill = useQuery({ queryKey: ['bill', billId], queryFn: () => api.admin.bills.get(billId!), enabled: typeof billId === 'number' && !Number.isNaN(billId) });

  if (billId === null || Number.isNaN(billId)) return <NotFoundPage />;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm" aria-label={t('voteGrid.back')}>
          <Link to={`/bills/${billId}`}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{t('voteGrid.title')}</h1>
          <p className="truncate text-sm text-muted-foreground">{bill.data?.data.titleMn}</p>
        </div>
      </div>
      {date && motion ? <RosterLoader billId={billId} date={date} motion={motion} /> : <SessionPicker billId={billId} />}
    </div>
  );
}

function SessionPicker({ billId }: { billId: number }) {
  const { t } = useTranslation();
  const [, setParams] = useSearchParams();
  const [date, setDate] = useState(todayUb());
  const [motion, setMotion] = useState('');
  const sessions = useQuery({ queryKey: ['vote-sessions', billId], queryFn: () => api.admin.bills.voteSessions(billId, { pageSize: 100 }) });
  const suggestions = [...new Set([...(sessions.data?.data ?? []).map((s) => s.motion), ...COMMON_MOTIONS])];

  return (
    <Card>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (date && motion.trim()) setParams({ date, motion: motion.trim() });
          }}
        >
          <FormField id="session-date" label={t('votes.fields.date')} required>
            <Input id="session-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </FormField>
          <FormField id="session-motion" label={t('votes.fields.motion')} hint={t('voteGrid.motionHint')} required>
            <Input id="session-motion" list="session-motions" value={motion} onChange={(event) => setMotion(event.target.value)} maxLength={100} />
            <datalist id="session-motions">
              {suggestions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </FormField>
          <Button type="submit" disabled={!date || !motion.trim()}>
            {t('voteGrid.open')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RosterLoader({ billId, date, motion }: { billId: number; date: string; motion: string }) {
  const { t } = useTranslation();
  const roster = useQuery({
    queryKey: ['vote-roster', billId, date, motion],
    queryFn: () => api.admin.bills.voteRoster(billId, { date, motion }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  if (roster.isPending) return <Skeleton className="h-96 w-full" />;
  if (roster.isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {t('voteGrid.loadError')}
      </p>
    );
  }
  return <VoteGrid key={`${date}|${motion}|${roster.dataUpdatedAt}`} roster={roster.data.data} />;
}

interface GridValues {
  sourceUrl: string;
  votes: Record<number, VoteValue | null>;
}

/** The source most existing votes already cite (pre-fills the single source field). */
function commonSource(roster: VoteRoster): string {
  const counts = new Map<string, number>();
  for (const member of roster.members) if (member.sourceUrl) counts.set(member.sourceUrl, (counts.get(member.sourceUrl) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function VoteGrid({ roster }: { roster: VoteRoster }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [store] = useState(() =>
    createFormStore<GridValues>({ sourceUrl: commonSource(roster), votes: Object.fromEntries(roster.members.map((m) => [m.personId, m.value])) }),
  );
  const state = useFormState(store);
  const { values } = state;
  const [filter, setFilter] = useState('');
  const [sourceError, setSourceError] = useState<string | undefined>();
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const pending = useRef<{ rows: VoteImportRow[]; version: number } | null>(null);
  const dirty = isFormDirty(state);

  const counts = useMemo(() => {
    const result = { yes: 0, no: 0, abstain: 0, absent: 0, unset: 0 };
    for (const member of roster.members) result[values.votes[member.personId] ?? 'unset'] += 1;
    return result;
  }, [roster.members, values.votes]);

  const query = filter.trim().toLowerCase();
  const visible = query
    ? roster.members.filter((m) => m.displayName.toLowerCase().includes(query) || (m.partyShortName ?? '').toLowerCase().includes(query))
    : roster.members;

  const importVotes = useMutation({
    mutationFn: ({ rows, dryRun }: { rows: VoteImportRow[]; dryRun: boolean }) => api.admin.import.votes({ dryRun, rows }),
  });

  const setVote = (personId: number, value: VoteValue) => store.update({ votes: { ...store.get().values.votes, [personId]: value } });

  function fillAbsent() {
    const votes = { ...store.get().values.votes };
    for (const member of roster.members) votes[member.personId] ??= 'absent';
    store.update({ votes });
  }

  async function review() {
    const { sourceUrl, votes } = store.get().values;
    if (!sourceUrlSchema.safeParse(sourceUrl.trim()).success) {
      setSourceError(t('form.invalidUrl'));
      return;
    }
    setSourceError(undefined);
    const rows: VoteImportRow[] = roster.members.flatMap((member) => {
      const value = votes[member.personId];
      return value ? [{ billId: roster.billId, personId: member.personId, value, date: roster.date, motion: roster.motion, sourceUrl: sourceUrl.trim() }] : [];
    });
    if (rows.length === 0) return notify.error(t('voteGrid.nothingToSave'));
    try {
      const { data } = await importVotes.mutateAsync({ rows, dryRun: true });
      if (data.summary.create + data.summary.update === 0) {
        store.markSaved(store.get().version);
        return notify.info(t('voteGrid.noChanges'));
      }
      pending.current = { rows, version: store.get().version };
      setPreview(data);
    } catch (err) {
      notify.apiError(err);
    }
  }

  async function commit() {
    const batch = pending.current;
    if (!batch) return;
    try {
      await importVotes.mutateAsync({ rows: batch.rows, dryRun: false });
      store.markSaved(batch.version);
      notify.success(t('voteGrid.saved'));
      void queryClient.invalidateQueries({ queryKey: ['vote-sessions', roster.billId] });
      // Refetch the roster too (fresh vote ids); the grid remounts clean since everything is saved.
      void queryClient.invalidateQueries({ queryKey: ['vote-roster', roster.billId] });
      void queryClient.invalidateQueries({ queryKey: ['votes'] });
    } catch (err) {
      notify.apiError(err);
    } finally {
      pending.current = null;
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>
              <span className="font-medium">{formatDate(roster.date)}</span> · <code className="text-xs">{roster.motion}</code>
            </p>
            <Button asChild={!dirty} size="sm" variant="ghost" disabled={dirty} title={dirty ? t('voteGrid.saveFirst') : undefined}>
              {dirty ? <span>{t('voteGrid.changeSession')}</span> : <Link to={voteGridPath(roster.billId)}>{t('voteGrid.changeSession')}</Link>}
            </Button>
          </div>
          <FormField id="vote-source" label={t('voteGrid.sourceUrl')} hint={t('voteGrid.sourceHint')} error={sourceError} required>
            <Input
              id="vote-source"
              type="url"
              value={values.sourceUrl}
              onChange={(event) => store.update({ sourceUrl: event.target.value })}
              placeholder="https://"
              aria-invalid={!!sourceError}
            />
          </FormField>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t('voteGrid.filter')}
              aria-label={t('voteGrid.filter')}
              className="max-w-xs"
            />
            <p className="flex flex-wrap gap-1 text-sm" aria-live="polite">
              {VOTE_VALUES.map((value) => (
                <Badge key={value} variant="outline">
                  {t(`status.vote.${value}`)}: {counts[value]}
                </Badge>
              ))}
              <Badge variant={counts.unset ? 'destructive' : 'outline'}>
                {t('voteGrid.unset')}: {counts.unset}
              </Badge>
            </p>
            <div className="ml-auto flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={fillAbsent} disabled={counts.unset === 0}>
                {t('voteGrid.fillAbsent')}
              </Button>
              <Button type="button" size="sm" onClick={() => void review()} disabled={!dirty || importVotes.isPending}>
                <Save aria-hidden />
                {t('form.save')}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('voteGrid.noDeleteHint')}</p>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('voteGrid.member')}</TableHead>
            <TableHead>{t('voteGrid.party')}</TableHead>
            <TableHead>
              <div className="grid grid-cols-4 gap-2 text-center">
                {VOTE_VALUES.map((value) => (
                  <span key={value}>{t(`status.vote.${value}`)}</span>
                ))}
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((member) => (
            <TableRow key={member.personId}>
              <TableCell>
                <span className="font-medium">{member.displayName}</span>
                {!member.inOffice && (
                  <Badge variant="secondary" className="ml-2">
                    {t('voteGrid.notInOffice')}
                  </Badge>
                )}
              </TableCell>
              <TableCell>{member.partyShortName ?? '—'}</TableCell>
              <TableCell>
                <RadioGroup
                  value={values.votes[member.personId] ?? ''}
                  onValueChange={(value) => setVote(member.personId, value as VoteValue)}
                  aria-label={member.displayName}
                  className="grid grid-cols-4 justify-items-center gap-2"
                >
                  {VOTE_VALUES.map((value) => (
                    <RadioGroupItem key={value} value={value} aria-label={t(`status.vote.${value}`)} />
                  ))}
                </RadioGroup>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
        title={t('voteGrid.confirmTitle')}
        description={preview ? t('voteGrid.confirmDescription', preview.summary) : ''}
        confirmLabel={t('form.save')}
        onConfirm={() => void commit()}
      />
      <FormLeaveGuard store={store} />
    </div>
  );
}
