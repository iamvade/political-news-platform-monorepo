import type { ContentDoc } from '@news/shared/content';
import { diffWords, type Change } from 'diff';
import type { ArticleFormValues } from './editor-store';

/** Plain text of a document, one line per block (for word diffs). */
export function docPlainText(doc: unknown): string {
  const lines: string[] = [];
  const walk = (node: { type?: string; text?: string; content?: unknown[]; attrs?: Record<string, unknown> }, line: string[]) => {
    if (node.type === 'text' && node.text) line.push(node.text);
    if (node.type === 'hardBreak') line.push(' ');
    if (node.type === 'image' && typeof node.attrs?.caption === 'string') line.push(`[${node.attrs.caption}]`);
    if (node.type === 'embed' && typeof node.attrs?.url === 'string') line.push(`[${node.attrs.url}]`);
    for (const child of (node.content ?? []) as (typeof node)[]) walk(child, line);
  };
  for (const block of ((doc as ContentDoc | null)?.content ?? []) as Parameters<typeof walk>[0][]) {
    const line: string[] = [];
    walk(block, line);
    lines.push(line.join(''));
  }
  return lines.filter((line) => line.trim() !== '').join('\n');
}

export const SCALAR_FIELDS = ['categoryId', 'coverMediaId', 'isBreaking'] as const;
export const LINK_FIELDS = ['tagIds', 'personIds', 'organizationIds', 'billIds'] as const;
export type ScalarField = (typeof SCALAR_FIELDS)[number];
export type LinkField = (typeof LINK_FIELDS)[number];

export interface RevisionDiff {
  /** Word diffs (revision → current); null when the text is identical. */
  title: Change[] | null;
  lede: Change[] | null;
  body: Change[] | null;
  scalars: { field: ScalarField; before: unknown; after: unknown }[];
  links: { field: LinkField; added: number[]; removed: number[] }[];
}

// jsdiff's default word tokenizer only knows Latin letters (Cyrillic would diff letter by letter).
const segmenter = new Intl.Segmenter('mn', { granularity: 'word' });

const textDiff = (before: string, after: string) => (before === after ? null : diffWords(before, after, { intlSegmenter: segmenter }));

const idList = (value: unknown): number[] | null =>
  Array.isArray(value) && value.every((v) => typeof v === 'number') ? (value as number[]) : null;

/**
 * What changed from a revision snapshot to the current form values. Fields a snapshot does not have (link
 * arrays before they were tracked) are skipped rather than shown as "everything added".
 */
export function revisionDiff(snapshot: Record<string, unknown>, current: ArticleFormValues): RevisionDiff {
  const str = (value: unknown) => (typeof value === 'string' ? value : '');
  const scalars = SCALAR_FIELDS.flatMap((field) => {
    if (!(field in snapshot)) return [];
    const before = snapshot[field];
    const after = current[field];
    return before === after ? [] : [{ field, before, after }];
  });
  const links = LINK_FIELDS.flatMap((field) => {
    const before = idList(snapshot[field]);
    if (!before) return [];
    const after = current[field];
    const added = after.filter((id) => !before.includes(id));
    const removed = before.filter((id) => !after.includes(id));
    return added.length || removed.length ? [{ field, added, removed }] : [];
  });
  return {
    title: textDiff(str(snapshot.title), current.title),
    lede: textDiff(str(snapshot.lede), current.lede),
    body: textDiff(docPlainText(snapshot.bodyJson), docPlainText(current.bodyJson)),
    scalars,
    links,
  };
}

export const hasChanges = (diff: RevisionDiff) =>
  Boolean(diff.title || diff.lede || diff.body || diff.scalars.length || diff.links.length);
