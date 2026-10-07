import type { ReactNode } from 'react';

/** Section title with the accent rule used across the site. */
export function SectionHeading({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 border-b-2 border-ink pb-1.5">
      <h2 id={id} className="type-label text-sm text-ink">
        {children}
      </h2>
      {aside && <div className="type-meta text-ink-subtle">{aside}</div>}
    </div>
  );
}
