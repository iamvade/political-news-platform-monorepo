import type { PublicParliamentWeek } from '@news/shared/schemas';
import { useFormatter, useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { SectionHeading } from '@/components/section-heading';
import { SourceLink } from '@/components/source-link';

type Tally = PublicParliamentWeek['votes'][number]['tally'];

const TALLY_ORDER = ['yes', 'no', 'abstain', 'absent'] as const;
const TALLY_COLOR: Record<(typeof TALLY_ORDER)[number], string> = {
  yes: 'bg-accent',
  no: 'bg-breaking',
  abstain: 'bg-ink-subtle',
  absent: 'bg-border-strong',
};

/** Proportional bar; decorative only — the numbers are always written next to it. */
function TallyBar({ tally }: { tally: Tally }) {
  const total = TALLY_ORDER.reduce((sum, key) => sum + tally[key], 0) || 1;
  return (
    <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-surface-muted">
      {TALLY_ORDER.map((key) => (
        <span key={key} className={TALLY_COLOR[key]} style={{ width: `${(tally[key] / total) * 100}%` }} />
      ))}
    </div>
  );
}

/** "Parliament this week": bill stage changes and roll calls from the last 7 days, each with its source. */
export function ParliamentWeek({ week }: { week: PublicParliamentWeek }) {
  const t = useTranslations('parliament');
  const format = useFormatter();
  const day = (date: string) => format.dateTime(new Date(`${date}T00:00:00Z`), { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const motion = (value: string) => (t.has(`motions.${value}`) ? t(`motions.${value}`) : value);
  const empty = week.stages.length === 0 && week.votes.length === 0;

  return (
    <section aria-labelledby="parliament-title" className="rounded-lg border border-border bg-surface p-4">
      <SectionHeading id="parliament-title" aside={`${day(week.from)} – ${day(week.to)}`}>
        {t('title')}
      </SectionHeading>
      {empty ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="space-y-5">
          {week.votes.length > 0 && (
            <div>
              <h3 className="type-label mb-2 text-ink-subtle">{t('votes')}</h3>
              <ul className="space-y-4">
                {week.votes.map((vote) => (
                  <li key={`${vote.bill.slug}-${vote.date}-${vote.motion}`} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif font-semibold leading-snug text-ink">{vote.bill.titleMn}</p>
                      <SourceLink href={vote.sourceUrl} variant="icon" />
                    </div>
                    <p className="type-meta text-ink-subtle">
                      {day(vote.date)} · {motion(vote.motion)}
                    </p>
                    <TallyBar tally={vote.tally} />
                    <p className="flex flex-wrap gap-x-3 text-sm text-ink-muted">
                      {TALLY_ORDER.map((key) => (
                        <span key={key}>
                          {t(`tally.${key}`)} <strong className="tabular-nums text-ink">{vote.tally[key]}</strong>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {week.stages.length > 0 && (
            <div>
              <h3 className="type-label mb-2 text-ink-subtle">{t('stages')}</h3>
              <ul className="divide-y divide-border">
                {week.stages.map((stage, index) => (
                  <li key={`${stage.bill.slug}-${stage.date}-${index}`} className="flex items-start justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="font-serif font-semibold leading-snug text-ink">{stage.bill.titleMn}</p>
                      <p className="type-meta text-ink-subtle">
                        {day(stage.date)} · {t(`stageNames.${stage.stage}`)}
                      </p>
                      {stage.noteMn && <p className="mt-0.5 text-sm text-ink-muted">{stage.noteMn}</p>}
                    </div>
                    <SourceLink href={stage.sourceUrl} variant="icon" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
