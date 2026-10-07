import Link from 'next/link';
import { routes } from '@/lib/routes';

/** Topic tag linking to its page. */
export function Tag({ tag }: { tag: { slug: string; nameMn: string } }) {
  return (
    <Link
      href={routes.tag(tag.slug)}
      className="inline-flex min-h-8 items-center rounded-md bg-surface-muted px-2.5 text-sm text-ink-muted hover:bg-border hover:text-ink"
    >
      {tag.nameMn}
    </Link>
  );
}
