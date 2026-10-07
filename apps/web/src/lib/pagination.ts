export type PageItem = number | 'gap';

/**
 * Page numbers to show around the current page: always the first and last, `siblings` on each side,
 * and 'gap' where pages are skipped. A gap that would hide a single page shows that page instead.
 */
export function pageRange(page: number, totalPages: number, siblings = 1): PageItem[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];
  // Few pages: show them all (a gap would save almost no space).
  if (totalPages <= 2 * siblings + 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = Math.max(2, current - siblings);
  const end = Math.min(totalPages - 1, current + siblings);
  const items: PageItem[] = [1];
  if (start === 3) items.push(2);
  else if (start > 3) items.push('gap');
  for (let n = start; n <= end; n++) items.push(n);
  if (end === totalPages - 2) items.push(totalPages - 1);
  else if (end < totalPages - 2) items.push('gap');
  items.push(totalPages);
  return items;
}
