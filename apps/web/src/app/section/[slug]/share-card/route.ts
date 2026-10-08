import messages from '../../../../../messages/mn.json';
import { renderShareCard } from '@/lib/share-card';
import { loadCategory } from '../section-shared';

// The share card of a section. Pages link to it with `?v=<hash of the category name>` (categoryShareImage in
// lib/seo.ts), so one URL always shows the same card and the CDN may keep it for a year.
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=31536000, immutable';

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  // Same cached, tagged loader as the page: no extra API request; a malformed or unknown slug is not found.
  const category = await loadCategory((await params).slug);
  return renderShareCard({ title: category.nameMn, subtitle: messages.site.tagline, footer: messages.site.name }, { 'cache-control': CACHE_CONTROL });
}
