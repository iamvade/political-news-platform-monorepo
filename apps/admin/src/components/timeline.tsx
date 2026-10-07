import { cn } from 'cn';
import type { ReactNode } from 'react';

export interface TimelineEntry {
  key: string | number;
  /** e.g. "2024-07-01 – одоо" */
  when: ReactNode;
  title: ReactNode;
  /** Highlight the dot (current position, latest status…). */
  current?: boolean;
  body?: ReactNode;
  actions?: ReactNode;
}

/** Vertical dated list used for positions, bill stages and promise updates. */
export function Timeline({ entries, label, empty }: { entries: TimelineEntry[]; label: string; empty: string }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="space-y-4 border-l pl-5" aria-label={label}>
      {entries.map((entry) => (
        <li key={entry.key} className="relative">
          <span
            aria-hidden
            className={cn('absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-primary bg-background', entry.current && 'bg-primary')}
          />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs text-muted-foreground">{entry.when}</p>
              <div className="font-medium">{entry.title}</div>
              {entry.body && <div className="text-sm text-muted-foreground">{entry.body}</div>}
            </div>
            {entry.actions && <div className="flex shrink-0 gap-1">{entry.actions}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
