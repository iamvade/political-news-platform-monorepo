import type { PublicPerson } from '@news/shared/schemas';
import Link from 'next/link';
import { imageSources, type PublicMedia } from '@/lib/media';
import { routes } from '@/lib/routes';
import { PartyBadge, type PartyRef } from './party-badge';

export interface PersonCardData {
  id: PublicPerson['id'];
  slug: PublicPerson['slug'];
  displayName: PublicPerson['displayName'];
  photo: PublicMedia | null;
  /** Current role, e.g. "УИХ-ын гишүүн". */
  role: string | null;
  party: PartyRef | null;
  /** Constituency name, if any. */
  constituency: string | null;
}

function initials(displayName: string): string {
  return Array.from(displayName.replace(/^.\./, '').trim())[0]?.toUpperCase() ?? '?';
}

/** Compact profile teaser: photo, name, role, party and constituency. The whole card links to the profile. */
export function PersonCard({ person }: { person: PersonCardData }) {
  const image = person.photo ? imageSources(person.photo) : null;
  return (
    <article className="group relative flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-border-strong">
      <div className="size-14 shrink-0 overflow-hidden rounded-full bg-surface-muted">
        {image ? (
          <img src={image.src} srcSet={image.srcSet} sizes="56px" alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span aria-hidden className="flex size-full items-center justify-center font-serif text-xl font-bold text-ink-subtle">
            {initials(person.displayName)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold text-ink">
          <Link href={routes.person(person)} className="after:absolute after:inset-0 group-hover:underline group-hover:underline-offset-2">
            {person.displayName}
          </Link>
        </p>
        {person.role && <p className="truncate text-sm text-ink-muted">{person.role}</p>}
        {(person.party || person.constituency) && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Not a link: the card itself is the link (no nested interactive elements). */}
            {person.party && <PartyBadge party={person.party} link={false} />}
            {person.constituency && <span className="type-meta text-ink-subtle">{person.constituency}</span>}
          </div>
        )}
      </div>
    </article>
  );
}
