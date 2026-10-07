import type { PublicPerson } from '@news/shared/schemas';
import Link from 'next/link';
import { routes } from '@/lib/routes';

export type PartyRef = Pick<NonNullable<PublicPerson['party']>, 'slug' | 'nameMn' | 'shortNameMn' | 'color'>;

const HEX = /^#[0-9a-fA-F]{6}$/;

interface PartyBadgeProps {
  party: PartyRef;
  /** Link to the party page (off inside another link, e.g. a PersonCard). */
  link?: boolean;
}

/**
 * Party short name with the party colour as a small dot. The colour is decoration only (PRD §11.7): the name
 * is always written, and the full name is available to screen readers and as a tooltip.
 */
export function PartyBadge({ party, link = true }: PartyBadgeProps) {
  const short = party.shortNameMn ?? party.nameMn;
  const color = party.color && HEX.test(party.color) ? party.color : undefined;
  const content = (
    <>
      <span aria-hidden className="size-2.5 shrink-0 rounded-full border border-border-strong" style={color ? { backgroundColor: color } : undefined} />
      <span aria-hidden={short !== party.nameMn}>{short}</span>
      {short !== party.nameMn && <span className="sr-only">{party.nameMn}</span>}
    </>
  );
  const className = 'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-muted';
  return link ? (
    <Link href={routes.party(party.slug)} title={party.nameMn} className={`${className} hover:border-border-strong hover:text-ink`}>
      {content}
    </Link>
  ) : (
    <span title={party.nameMn} className={className}>
      {content}
    </span>
  );
}
